import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { csvLines } from "../src/lib/csv.ts";

/** The one data line of a single-column CSV holding `value`. */
const cell = (value: unknown) => csvLines(["v"], [{ v: value }])[1];

describe("csvLines", () => {
  test("writes the header, then each row's values in column order, ignoring other keys", () => {
    const rows = [
      { value: 1.5, day: "2026-11-01", extra: "x" },
      { value: 2, day: "2026-11-02" },
    ];
    assert.deepEqual(csvLines(["day", "value"], rows), ["day,value", "2026-11-01,1.5", "2026-11-02,2"]);
  });

  test("writes only the header for no rows, and reads rows from any iterable", () => {
    assert.deepEqual(csvLines(["day", "value"], []), ["day,value"]);
    function* rows() {
      yield { day: "2026-11-01" };
    }
    assert.deepEqual(csvLines(["day"], rows()), ["day", "2026-11-01"]);
  });

  test("leaves null, undefined and missing values empty", () => {
    assert.deepEqual(csvLines(["a", "b", "c"], [{ a: null, b: undefined }]), ["a,b,c", ",,"]);
  });

  test("quotes a value with a quote, comma, semicolon, CR or LF and doubles its quotes", () => {
    assert.equal(cell('say "hi"'), '"say ""hi"""');
    assert.equal(cell("a,b"), '"a,b"');
    assert.equal(cell("a;b"), '"a;b"');
    assert.equal(cell("a\nb"), '"a\nb"');
    assert.equal(cell("a\rb"), '"a\rb"');
    assert.equal(cell("plain text"), "plain text");
  });

  test("prefixes text that starts like a formula with an apostrophe", () => {
    assert.equal(cell("=SUM(A1)"), "'=SUM(A1)");
    assert.equal(cell("+1"), "'+1");
    assert.equal(cell("-1"), "'-1");
    assert.equal(cell("@x"), "'@x");
    assert.equal(cell("\tx"), "'\tx");
    assert.equal(cell("a=b"), "a=b");
  });

  test("quotes a guarded value that also needs quoting", () => {
    assert.equal(cell("\rx"), "\"'\rx\"");
    assert.equal(cell('=HYPERLINK("a","b")'), '"\'=HYPERLINK(""a"",""b"")"');
  });

  test("writes numbers, negative ones included, and other values as they are", () => {
    assert.equal(cell(-5), "-5");
    assert.equal(cell(-0.25), "-0.25");
    assert.equal(cell(0), "0");
    assert.equal(cell(false), "false");
    assert.equal(cell(10n), "10");
  });
});
