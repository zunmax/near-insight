import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MAX_PULL_BACK_DAYS } from "../src/config/ingest.ts";
import { flowContext } from "../src/data/thesis-metrics/flow-context.ts";
import type { ThesisInputs } from "../src/data/thesis-metrics/inputs.ts";
import { DAY_SECONDS, dayTime, isoDay, type DailyPoint } from "../src/lib/metrics.ts";

const LAST = "2026-11-09";

/** `days` daily points of `value` ending on `last`. */
const daily = (days: number, value: number, last = LAST): DailyPoint[] =>
  Array.from({ length: days }, (_, i) => ({ time: dayTime(last) - (days - 1 - i) * DAY_SECONDS, value }));

const without = (points: DailyPoint[], iso: string) => points.filter((point) => point.time !== dayTime(iso));

/** A market reading taken on `day`; flowContext reads only its time. */
const marketOn = (day: string): ThesisInputs["market"] => ({
  near: { id: "near", symbol: "near", name: "NEAR Protocol", rank: 21, priceUsd: 2, marketCapUsd: 2.6e9, fdvUsd: 2.6e9, athUsd: 20, change1y: 30 },
  peers: [],
  fetchedAt: `${day}T08:00:00.000Z`,
});

/** 90 days of every flow ending on LAST, at $2 NEAR, with `change` applied. */
function inputs(change: Partial<Parameters<typeof flowContext>[0]> = {}): Parameters<typeof flowContext>[0] {
  return {
    volume: daily(90, 100_000_000),
    buybacks: daily(90, 50_000),
    fees: daily(90, 2_000),
    prices: daily(90, 2),
    minted: daily(90, 90_000),
    burnt: daily(90, 1_000),
    market: marketOn("2026-11-11"),
    ...change,
  };
}

describe("flowContext", () => {
  test("windows end on the last day the core flow series share", () => {
    const flow = flowContext(inputs({ fees: daily(89, 2_000, "2026-11-08") }));
    assert.equal(flow.throughDay, "2026-11-08");
    assert.equal(flow.sum(flow.boughtNear, 30), 30 * 25_000);
  });

  test("a missing day of a core series, or of NEAR minted or burned, moves the windows to before it", () => {
    assert.equal(flowContext(inputs({ volume: without(daily(90, 100_000_000), "2026-11-05") })).throughDay, "2026-11-04");
    assert.equal(flowContext(inputs({ minted: without(daily(90, 90_000), "2026-11-07") })).throughDay, "2026-11-06");
    assert.equal(flowContext(inputs({ burnt: without(daily(90, 1_000), LAST) })).throughDay, "2026-11-08");
  });

  test("moved windows are complete, so their 30-day sums are whole", () => {
    const minted = without(daily(90, 90_000), "2026-11-07");
    const flow = flowContext(inputs({ minted }));
    assert.ok(flow.measured(30));
    assert.equal(flow.sum(minted, 30), 30 * 90_000);
  });

  test("windows move back at most MAX_PULL_BACK_DAYS; when none of those has a whole window they keep the last shared day", () => {
    /** One gap on the oldest end day the rule may try and one 15 days later leave every 30-day window it tries incomplete. */
    const oldest = isoDay(dayTime(LAST) - MAX_PULL_BACK_DAYS * DAY_SECONDS);
    const middle = isoDay(dayTime(oldest) + 15 * DAY_SECONDS);
    const flow = flowContext(inputs({ minted: without(without(daily(90, 90_000), oldest), middle) }));
    assert.equal(flow.throughDay, LAST);
    assert.equal(flow.measured(30), false);
  });

  test("a history too short for any complete window keeps the last shared day", () => {
    const short = (series: DailyPoint[]) => series.slice(-10);
    const i = inputs();
    const flow = flowContext({ ...i, volume: short(i.volume), buybacks: short(i.buybacks), fees: short(i.fees), prices: short(i.prices) });
    assert.equal(flow.throughDay, LAST);
    assert.equal(flow.covered(flow.boughtNear, 30), false);
  });

  test("has no data-through day while a core series is empty", () => {
    const flow = flowContext(inputs({ buybacks: [] }));
    assert.equal(flow.through, null);
    assert.equal(flow.throughDay, null);
    assert.equal(flow.covered(daily(90, 1), 30), false);
  });

  test("is current while the windows trail the newest market reading by at most the usual lag plus a day", () => {
    assert.equal(flowContext(inputs({ market: marketOn("2026-11-12") })).current, true);
    assert.equal(flowContext(inputs({ market: marketOn("2026-11-13") })).current, false);
    assert.equal(flowContext(inputs({ market: null })).current, false);
  });
});
