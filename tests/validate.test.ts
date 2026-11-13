import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asArray,
  asRecord,
  errorMessage,
  isRecord,
  readDailySeries,
  readNumber,
  readOptionalNumber,
  readPositiveNumber,
  readRatio,
  readString,
  readYocto,
  ShapeError,
  toHttpUrl,
  yoctoToNear,
} from "../src/lib/validate.ts";

/** Asserts `read` throws a ShapeError naming `path` and `expected`. */
function assertShapeError(read: () => unknown, path: string, expected: string) {
  assert.throws(read, (error: unknown) => {
    assert.ok(error instanceof ShapeError);
    assert.equal(error.name, "ShapeError");
    assert.equal(error.message, `Unexpected upstream data at ${path}: expected ${expected}`);
    return true;
  });
}

describe("toHttpUrl", () => {
  test("returns an absolute http(s) URL in normalized form, trimmed", () => {
    assert.equal(toHttpUrl("https://near.org"), "https://near.org/");
    assert.equal(toHttpUrl("  http://example.com/a?b=1  "), "http://example.com/a?b=1");
    assert.equal(toHttpUrl("HTTPS://NEAR.ORG/Path"), "https://near.org/Path");
  });

  test("returns null for other schemes, relative or malformed URLs and non-strings", () => {
    for (const value of ["javascript:alert(1)", "ftp://example.com", "data:text/html,x", "/relative", "near.org", "not a url", "", 42, null, undefined]) {
      assert.equal(toHttpUrl(value), null, String(value));
    }
  });
});

describe("yoctoToNear", () => {
  test("converts yoctoNEAR to NEAR with micro-NEAR precision", () => {
    assert.equal(yoctoToNear("1000000000000000000000000", "p"), 1);
    assert.equal(yoctoToNear("1500000000000000000000000", "p"), 1.5);
    assert.equal(yoctoToNear("1234567890000000000000000000", "p"), 1234.56789);
    assert.equal(yoctoToNear("0", "p"), 0);
  });

  test("drops amounts below a micro-NEAR", () => {
    assert.equal(yoctoToNear("999999999999999999", "p"), 0);
    assert.equal(yoctoToNear("1999999999999999999", "p"), 0.000001);
  });

  test("throws for anything but a non-negative integer string", () => {
    for (const value of ["-1", "1.5", "1e24", "", " 1"]) assertShapeError(() => yoctoToNear(value, "p"), "p", "a yoctoNEAR integer string");
  });
});

describe("readYocto", () => {
  test("reads a yoctoNEAR string exactly as a bigint", () => {
    assert.equal(readYocto({ v: "1234567890123456789012345" }, "v", "r"), 1234567890123456789012345n);
  });

  test("throws for a string that is not an integer, or a number", () => {
    assertShapeError(() => readYocto({ v: "12.5" }, "v", "r"), "r.v", "a yoctoNEAR integer string");
    assertShapeError(() => readYocto({ v: 12 }, "v", "r"), "r.v", "a string");
  });
});

describe("readRatio", () => {
  test("divides a [numerator, denominator] pair", () => {
    assert.equal(readRatio({ r: [1, 10] }, "r", "config"), 0.1);
    assert.equal(readRatio({ r: [0, 3] }, "r", "config"), 0);
  });

  test("throws for a zero denominator, a missing or non-number part, or a non-array", () => {
    assertShapeError(() => readRatio({ r: [1, 0] }, "r", "config"), "config.r", "a [numerator, denominator] pair");
    assertShapeError(() => readRatio({ r: [1, "2"] }, "r", "config"), "config.r", "a [numerator, denominator] pair");
    assertShapeError(() => readRatio({ r: [3] }, "r", "config"), "config.r", "a [numerator, denominator] pair");
    assertShapeError(() => readRatio({ r: "1/10" }, "r", "config"), "config.r", "an array");
  });
});

describe("errorMessage", () => {
  test("returns an Error's message and anything else as text", () => {
    assert.equal(errorMessage(new Error("boom")), "boom");
    assert.equal(errorMessage(new ShapeError("a.b", "a number")), "Unexpected upstream data at a.b: expected a number");
    assert.equal(errorMessage("plain"), "plain");
    assert.equal(errorMessage(42), "42");
    assert.equal(errorMessage(null), "null");
  });
});

describe("record readers", () => {
  test("readString returns a string and throws with the field path otherwise", () => {
    assert.equal(readString({ a: "" }, "a", "root"), "");
    assertShapeError(() => readString({ a: 1 }, "a", "root"), "root.a", "a string");
    assertShapeError(() => readString({}, "a", "root"), "root.a", "a string");
  });

  test("readNumber accepts finite numbers only", () => {
    assert.equal(readNumber({ n: -2.5 }, "n", "root"), -2.5);
    for (const n of [Number.NaN, Infinity, "1", null]) assertShapeError(() => readNumber({ n }, "n", "root"), "root.n", "a number");
  });

  test("readPositiveNumber rejects zero and negative numbers", () => {
    assert.equal(readPositiveNumber({ n: 0.01 }, "n", "root"), 0.01);
    assertShapeError(() => readPositiveNumber({ n: 0 }, "n", "root"), "root.n", "a number above zero");
    assertShapeError(() => readPositiveNumber({ n: -1 }, "n", "root"), "root.n", "a number above zero");
  });

  test("readOptionalNumber returns null for null or a missing field and checks anything else", () => {
    assert.equal(readOptionalNumber({ n: null }, "n", "root"), null);
    assert.equal(readOptionalNumber({}, "n", "root"), null);
    assert.equal(readOptionalNumber({ n: 0 }, "n", "root"), 0);
    assertShapeError(() => readOptionalNumber({ n: "1" }, "n", "root"), "root.n", "a number");
  });

  test("isRecord, asRecord and asArray tell objects from arrays and null", () => {
    assert.equal(isRecord({}), true);
    assert.equal(isRecord([]), false);
    assert.equal(isRecord(null), false);
    assert.deepEqual(asRecord({ a: 1 }, "root"), { a: 1 });
    assertShapeError(() => asRecord([], "root"), "root", "an object");
    assert.deepEqual(asArray([1], "root"), [1]);
    assertShapeError(() => asArray({}, "root"), "root", "an array");
  });

  test("readDailySeries reads [timestamp, value] pairs and names the bad pair", () => {
    assert.deepEqual(readDailySeries([[1, 2], [3, 4]], "s"), [{ time: 1, value: 2 }, { time: 3, value: 4 }]);
    assert.deepEqual(readDailySeries([], "s"), []);
    assertShapeError(() => readDailySeries([[1, 2], [3, "4"]], "s"), "s[1]", "a [timestamp, number] pair");
    assertShapeError(() => readDailySeries([[1, 2], 3], "s"), "s[1]", "an array");
  });
});
