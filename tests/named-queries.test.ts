import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { MAX_PULL_BACK_DAYS } from "../src/config/ingest.ts";
import { feesEnd, flowContext } from "../src/data/thesis-metrics/flow-context.ts";
import { intentsMetrics } from "../src/data/thesis-metrics/intents.ts";
import { DUNE_THROUGH, FEES_THROUGH, THROUGH } from "../src/db/named-queries/fragments.ts";
import { NAMED_QUERIES, namedQuery } from "../src/db/named-queries/index.ts";
import { MIGRATIONS, SERIES, type SeriesName } from "../src/db/schema.ts";
import { DAY_SECONDS, dayTime, isoDay, type DailyPoint } from "../src/lib/metrics.ts";

/** An in-memory database with the current schema and the 30 days to 2026-11-01 of flows, so every query runs against real
    tables and the 30-day windows are complete. */
function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const sql of MIGRATIONS) db.exec(sql);
  const insert = db.prepare("INSERT INTO daily_series (series, day, value) VALUES (?, ?, ?)");
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 3 + i)).toISOString().slice(0, 10));
  for (const day of days) {
    for (const [series, value] of [
      [SERIES.intentsVolumeUsd, 100],
      [SERIES.intentsFeesUsd, 10],
      [SERIES.intentsRevenueUsd, 4],
      [SERIES.intentsBuybacksUsd, 4],
      [SERIES.nearChainFeesUsd, 2],
      [SERIES.nearPriceUsd, 2],
      [SERIES.mintedNear, 50],
      [SERIES.burntNear, 1],
    ] as const) {
      insert.run(series, day, value);
    }
  }
  return db;
}

describe("named queries", () => {
  test("ids are unique and URL-safe", () => {
    const ids = NAMED_QUERIES.map((query) => query.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
  });

  test("every query is a single read-only statement that runs on the current schema", () => {
    const db = database();
    for (const query of NAMED_QUERIES) {
      const statement = db.prepare(query.sql);
      assert.ok(statement.columns().length > 0, `${query.id} returns no columns`);
      assert.doesNotThrow(() => statement.all(), query.id);
      assert.doesNotMatch(query.sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|PRAGMA)\b/i, query.id);
    }
  });

  test("every panel's sqlId names a query in the catalog", () => {
    const components = new URL("../src/components/", import.meta.url);
    const files = readdirSync(components, { recursive: true }).map(String).filter((file) => file.endsWith(".tsx"));
    const ids = files.flatMap((file) => [...readFileSync(new URL(file.replaceAll("\\", "/"), components), "utf8").matchAll(/sqlId="([^"]+)"/g)].map((m) => m[1]!));
    assert.ok(ids.length > 0);
    for (const id of ids) assert.ok(namedQuery(id), `no query "${id}"`);
  });

  test("the fee chain converts buybacks to NEAR at each day's price", () => {
    const row = database().prepare(namedQuery("fee-chain-30d")!.sql).get();
    assert.equal(row?.days, 30);
    assert.equal(row?.bought_near, 60);
    assert.equal(row?.capture_rate, 0.4);
  });
});

const LAST = "2026-11-09";

/** `days` daily points of `value` ending on `last`. */
const daily = (days: number, value: number, last = LAST): DailyPoint[] =>
  Array.from({ length: days }, (_, i) => ({ time: dayTime(last) - (days - 1 - i) * DAY_SECONDS, value }));

const without = (points: DailyPoint[], ...days: string[]) => points.filter((point) => !days.includes(isoDay(point.time)));

/** The stored series the data-through days read, by their ThesisInputs names. */
const STORED = {
  volume: SERIES.intentsVolumeUsd,
  buybacks: SERIES.intentsBuybacksUsd,
  fees: SERIES.nearChainFeesUsd,
  prices: SERIES.nearPriceUsd,
  minted: SERIES.mintedNear,
  burnt: SERIES.burntNear,
  intentsFees: SERIES.intentsFeesUsd,
  intentsRevenue: SERIES.intentsRevenueUsd,
  swaps: SERIES.intentsSwaps,
  confidentialVolume: SERIES.intentsConfidentialVolumeUsd,
} satisfies Record<string, SeriesName>;

type Flows = Record<keyof typeof STORED, DailyPoint[]>;

/** 90 days of every series ending on LAST, with `change` applied. */
function flows(change: Partial<Flows> = {}): Flows {
  const all = Object.fromEntries(Object.keys(STORED).map((name) => [name, daily(90, 10)])) as Flows;
  return { ...all, ...change };
}

/** The data-through, Dune and fee days the SQL fragments select from `data` stored in an in-memory database. */
function sqlDays(data: Flows) {
  const db = new DatabaseSync(":memory:");
  for (const sql of MIGRATIONS) db.exec(sql);
  const insert = db.prepare("INSERT INTO daily_series (series, day, value) VALUES (?, ?, ?)");
  for (const [name, series] of Object.entries(STORED)) {
    for (const point of data[name as keyof Flows]) insert.run(series, isoDay(point.time), point.value);
  }
  const row = db
    .prepare(`WITH ${THROUGH}, ${DUNE_THROUGH}, ${FEES_THROUGH}
SELECT (SELECT day FROM through) AS through, (SELECT day FROM dune_through) AS dune, (SELECT day FROM fees_through) AS fees`)
    .get();
  return { ...row };
}

/** The same days as the thesis metrics compute them: FlowContext.through, intents.duneThrough and feesEnd. */
function typeScriptDays(data: Flows) {
  const flow = flowContext({ ...data, market: null });
  const dune = intentsMetrics(data, flow)?.duneThrough ?? null;
  return { through: flow.throughDay, dune, fees: flow.through === null ? null : isoDay(feesEnd(data, flow)) };
}

/** Asserts the SQL and TypeScript agree on `data`, and on the expected days. */
function assertDays(data: Flows, expected: { through: string | null; dune: string | null; fees: string | null }) {
  assert.deepEqual(typeScriptDays(data), expected);
  assert.deepEqual(sqlDays(data), expected);
}

describe("SQL data-through days match the TypeScript rule", () => {
  test("end on the last day while every series is complete", () => {
    assertDays(flows(), { through: LAST, dune: LAST, fees: LAST });
  });

  test("move every window before a day missing from a core series", () => {
    assertDays(flows({ volume: without(daily(90, 10), "2026-11-05") }), { through: "2026-11-04", dune: "2026-11-04", fees: "2026-11-04" });
    assertDays(flows({ prices: without(daily(90, 10), "2026-10-20") }), { through: "2026-10-19", dune: "2026-10-19", fees: "2026-10-19" });
  });

  test("move every window before a day missing from NEAR minted or burned", () => {
    assertDays(flows({ minted: without(daily(90, 10), "2026-11-07") }), { through: "2026-11-06", dune: "2026-11-06", fees: "2026-11-06" });
    assertDays(flows({ burnt: without(daily(90, 10), LAST) }), { through: "2026-11-08", dune: "2026-11-08", fees: "2026-11-08" });
  });

  test("move only the Dune windows before a day missing from swaps or confidential volume", () => {
    assertDays(flows({ swaps: without(daily(90, 10), "2026-11-03") }), { through: LAST, dune: "2026-11-02", fees: LAST });
    assertDays(flows({ confidentialVolume: daily(89, 10, "2026-11-08") }), { through: LAST, dune: "2026-11-08", fees: LAST });
  });

  test("move only the fee windows before a day missing from Intents fees or revenue", () => {
    assertDays(flows({ intentsFees: without(daily(90, 10), "2026-11-06") }), { through: LAST, dune: LAST, fees: "2026-11-05" });
    assertDays(flows({ intentsRevenue: daily(89, 10, "2026-11-08") }), { through: LAST, dune: LAST, fees: "2026-11-08" });
  });

  test("keep the last shared day when no window within MAX_PULL_BACK_DAYS is complete", () => {
    /** One gap on the oldest end day the rule may try and one 15 days later leave every 30-day window it tries incomplete. */
    const oldest = isoDay(dayTime(LAST) - MAX_PULL_BACK_DAYS * DAY_SECONDS);
    const middle = isoDay(dayTime(oldest) + 15 * DAY_SECONDS);
    assertDays(flows({ minted: without(daily(90, 10), oldest, middle) }), { through: LAST, dune: LAST, fees: LAST });
  });

  test("have no days while a core series or a Dune series is empty", () => {
    assertDays(flows({ buybacks: [] }), { through: null, dune: null, fees: null });
    assertDays(flows({ swaps: [] }), { through: LAST, dune: null, fees: LAST });
  });
});
