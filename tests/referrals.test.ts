import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NO_REFERRAL } from "../src/config/intents.ts";
import type { ThesisMetrics } from "../src/data/thesis-metrics.ts";
import { largestReferral, referralLabel } from "../src/lib/referrals.ts";

/** 30 days of 1Click swaps in which swaps without a referral paid the most fees. */
const referrals: NonNullable<ThesisMetrics["referrals"]> = {
  through: "2026-11-12",
  swaps: 300,
  volumeUsd: 1_000,
  feesUsd: 100,
  byReferral: [
    { referral: NO_REFERRAL, swaps: 100, volumeUsd: 500, feesUsd: 50 },
    { referral: "swapkit", swaps: 100, volumeUsd: 300, feesUsd: 40 },
    { referral: "lifi", swaps: 100, volumeUsd: 200, feesUsd: 10 },
  ],
};

describe("largestReferral", () => {
  test("takes the named referral with the most fees, as shares of every swap's fees and volume", () => {
    assert.deepEqual(largestReferral(referrals), { referral: "swapkit", feeShare: 0.4, volumeShare: 0.3 });
  });

  test("is null without a named referral or without fees", () => {
    assert.equal(largestReferral(null), null);
    assert.equal(largestReferral({ ...referrals, byReferral: [referrals.byReferral[0]!] }), null);
    assert.equal(largestReferral({ ...referrals, feesUsd: 0 }), null);
  });
});

describe("referralLabel", () => {
  test("names referral accounts, id-only partners and swaps without a referral", () => {
    assert.equal(referralLabel("swapkit"), "swapkit");
    assert.equal(referralLabel("near-intents.intents-referral.near"), "near-intents (referral)");
    assert.equal(referralLabel("e1a72603-64b3-4be1-8265-8bae5970d396"), "Unnamed partner e1a72603");
    assert.equal(referralLabel(NO_REFERRAL), "No referral");
  });
});
