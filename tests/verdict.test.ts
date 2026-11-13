import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ThesisMetrics } from "../src/data/thesis-metrics.ts";
import { dataCheck, dayTime } from "../src/lib/metrics.ts";
import { thesisVerdict } from "../src/lib/thesis/verdict.ts";
import { absorbed, assertWellFormed, DATA_THROUGH, holdingMetrics } from "./thesis-metrics-fixture.ts";

/** The verdict on the holding metrics with `change` applied; fails the test when there is none. */
function verdict(change: (m: ThesisMetrics) => void = () => {}) {
  const m = holdingMetrics();
  change(m);
  const v = thesisVerdict(m);
  assert.ok(v, "expected a verdict");
  for (const text of [v.summary, ...v.points]) assertWellFormed(text);
  return v;
}

/** The point about the three fee wallets on chain. */
const walletPoint = (points: string[]) => points.find((point) => point.startsWith("On chain, the three fee wallets"));

describe("thesisVerdict", () => {
  test("is null until the 30-day buying and absorption are measured", () => {
    const noBuying = holdingMetrics();
    noBuying.buybacks = null;
    assert.equal(thesisVerdict(noBuying), null);
    const noAbsorption = holdingMetrics();
    noAbsorption.absorption!.d30 = null;
    assert.equal(thesisVerdict(noAbsorption), null);
  });

  test("supports the mechanism but not yet the outcome while burn plus buybacks absorb part of issuance", () => {
    const v = verdict();
    assert.match(v.summary, /^The latest data supports the mechanism but not yet the outcome/);
    assert.match(v.summary, /growing faster than needed at today's price/);
    assert.equal(v.points[0], "Of the 4 core breaking points (the pillars and valuation), 4 hold. Of the 3 supporting breaking points (technology, network and peers), 3 hold.");
  });

  test("supports the whole thesis once burn plus buybacks absorb all issuance and every breaking point holds", () => {
    const v = verdict((m) => (m.absorption!.d30 = absorbed(30, 1.2)));
    assert.match(v.summary, /^The latest data supports the whole thesis/);
    assert.match(v.summary, /exceeds all the NEAR minted/);
  });

  test("names a broken breaking point in the summary", () => {
    const v = verdict((m) => {
      m.absorption!.d30 = absorbed(30, 1);
      m.peers!.nearGrowth1y = 0.03;
    });
    assert.match(v.summary, /^The latest data supports the mechanism and the outcome/);
    assert.match(v.summary, /equals all the NEAR minted/);
    assert.match(v.summary, /The breaking point of \*\*No supply overhang left to unlock\*\* is broken\./);
    assert.match(v.points[0]!, /2 hold and 1 is broken/);
  });

  test("does not show the mechanism working when the capture breaking point breaks, and says how", () => {
    assert.match(verdict((m) => (m.feeWallets!.bought30dNear = 0)).summary, /NEAR Intents fees bought no NEAR/);
    assert.match(verdict((m) => (m.feeWallets!.gain30dNear = -5_000)).summary, /NEAR left the fee wallets/);
    const soldOut = verdict((m) => (m.feeWallets!.shortfall30dNear = 100_000));
    assert.match(soldOut.summary, /^The latest data does not show the mechanism working: NEAR bought was sold or moved out/);
    /** Balances at the window's end cannot clear a daily gap, so the wallet point does not claim the NEAR is still held. */
    assert.doesNotMatch(walletPoint(soldOut.points)!, /still held/);
    assert.match(walletPoint(soldOut.points)!, /held at least what was counted as bought at the window's end/);
  });

  test("cannot test the mechanism without the fee wallets' history", () => {
    assert.match(verdict((m) => (m.feeWallets = null)).summary, /^The latest data cannot test the mechanism yet/);
  });

  test("the wallet point says the NEAR bought is still held, and stays when the wallets lost NEAR", () => {
    assert.match(walletPoint(verdict().points)!, /differ by 0\.7%, so the NEAR bought is still held\.$/);
    const lost = verdict((m) => {
      m.feeWallets!.gain30dNear = -10_000;
      m.dataChecks.boughtVsWallets = dataCheck(403_800, -10_000, 30, dayTime(DATA_THROUGH));
    });
    assert.match(walletPoint(lost.points)!, /^On chain, the three fee wallets lost 10K NEAR over the last 30 days, against 403\.8K NEAR counted as bought/);
  });

  test("states that burn alone covers issuance rather than a growth of −100%", () => {
    const v = verdict((m) => (m.valuation!.requiredMonthlyGrowth = -1));
    assert.ok(v.points.some((point) => /burn alone already matches monthly issuance/.test(point)));
    assert.ok(v.points.every((point) => !/−100/.test(point)));
  });

  test("dates its windows once the flows are no longer current", () => {
    const v = verdict((m) => (m.flowsCurrent = false));
    assert.match(v.points.join(" "), /over the 30 days to 2026-11-09/);
    assert.doesNotMatch(v.points.join(" "), /last 30 days/);
  });
});
