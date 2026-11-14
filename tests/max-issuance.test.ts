import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TRIGGERS } from "../src/config/thesis-triggers.ts";
import { formatMaxIssuance, maxIssuanceDigits } from "../src/lib/thesis/max-issuance.ts";

describe("formatMaxIssuance", () => {
  test("prints one decimal at the ceiling and for rates apart from it at one decimal", () => {
    assert.equal(TRIGGERS.maxIssuanceCeiling, 0.025);
    assert.equal(formatMaxIssuance(0.025), "2.5%");
    assert.equal(formatMaxIssuance(0.016), "1.6%");
    assert.equal(formatMaxIssuance(0.05), "5.0%");
  });

  test("adds decimals so a rate slightly off the ceiling never prints as the ceiling", () => {
    assert.equal(formatMaxIssuance(0.0251), "2.51%");
    assert.equal(formatMaxIssuance(0.0249), "2.49%");
    assert.equal(formatMaxIssuance(0.025004), "2.5004%");
    assert.equal(maxIssuanceDigits(0.0251), 2);
  });

  test("keeps one decimal for a rate apart only beyond four decimals", () => {
    assert.equal(maxIssuanceDigits(0.02500001), 1);
    assert.equal(formatMaxIssuance(0.02500001), "2.5%");
  });
});
