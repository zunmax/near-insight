/** Dune: query results from the NEAR team's NEAR Intents dashboard, read by the Python helper dune.py (curl_cffi), which runs the
    requests in order (dashboard queries, each query's latest finished run, its rows) with retries. This module starts the
    helper, checks the shape of what it returns, and reads each query's rows into typed values. */
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../../config/sources.ts";
import { asArray, asRecord, errorMessage, readNumber, readOptionalNumber, readString, ShapeError } from "../../lib/validate.ts";
import type { DayValue } from "../days.ts";

const HELPER = fileURLToPath(new URL("./dune.py", import.meta.url));

/** Largest helper output read: the biggest result (volume by token) is about 3 MB. */
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

/** One query's rows from its latest finished run; `generatedAt` is when Dune ran it (ISO 8601). */
export type DuneRows = { executionId: string; generatedAt: string; columns: string[]; rows: Array<Record<string, unknown>> };

/** A query's outcome: rows from a new run, the same run as `known` (nothing to store), or why it could not be read. */
type DuneResult = ({ unchanged: false } & DuneRows) | { unchanged: true } | { error: string };

type DuneRun = { signingKey: string; results: Map<number, DuneResult> };

/** Reads the given queries of the dashboard in SOURCES.dune. `known` maps a query to the run already stored, which is not
    read again; `signingKey` signs result requests (the helper returns a new one if the site changed it). Rejects when the
    helper cannot start or cannot read the dashboard; a failing query is reported in its own result. */
export function fetchDuneResults(queryIds: number[], known: Map<number, string>, signingKey: string): Promise<DuneRun> {
  const { baseUrl, dashboard, python, retries, browsers, runBudgetMs, runTimeoutMs } = SOURCES.dune;
  const input = JSON.stringify({ baseUrl, dashboard, queries: queryIds, known: Object.fromEntries(known), signingKey, retries, browsers, budgetSeconds: runBudgetMs / 1000 });
  return new Promise((resolve, reject) => {
    const child = execFile(python, [HELPER], { timeout: runTimeoutMs, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        /** A Python traceback's last line is its error; the lines above it name local file paths, so they are not kept. */
        const reason = stderr.trim().split("\n").at(-1)?.trim() || error.message;
        reject(new Error(`Dune reader failed: ${reason.slice(0, 400)}`));
        return;
      }
      try {
        resolve(readRun(JSON.parse(stdout)));
      } catch (parseError) {
        reject(parseError);
      }
    });
    /** A helper that cannot start also fails this write; the callback above already reports that failure. */
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}

function readRun(value: unknown): DuneRun {
  const body = asRecord(value, "dune");
  const results = new Map<number, DuneResult>();
  for (const [id, raw] of Object.entries(asRecord(body.results, "dune.results"))) {
    try {
      results.set(Number(id), readResult(raw, `dune.results.${id}`));
    } catch (error) {
      results.set(Number(id), { error: errorMessage(error) });
    }
  }
  return { signingKey: readString(body, "signingKey", "dune"), results };
}

/** One query's result; throws when its shape is wrong, which readRun reports as that query's error. */
function readResult(raw: unknown, at: string): DuneResult {
  const r = asRecord(raw, at);
  if (typeof r.error === "string") return { error: r.error };
  if (r.unchanged === true) return { unchanged: true };
  const generatedAt = readString(r, "generatedAt", at);
  if (!/^\d{4}-\d{2}-\d{2}/.test(generatedAt)) throw new ShapeError(`${at}.generatedAt`, "an ISO 8601 time");
  return {
    unchanged: false,
    executionId: readString(r, "executionId", at),
    generatedAt,
    columns: asArray(r.columns, `${at}.columns`).map((c, i) => {
      if (typeof c !== "string") throw new ShapeError(`${at}.columns[${i}]`, "a column name");
      return c;
    }),
    rows: asArray(r.rows, `${at}.rows`).map((row, i) => asRecord(row, `${at}.rows[${i}]`)),
  };
}

/** Throws unless the result has every column the reader needs, so a query its owner reshaped is not stored. */
function requireColumns(result: DuneRows, names: string[], query: string) {
  const missing = names.filter((name) => !result.columns.includes(name));
  if (missing.length > 0) throw new ShapeError(`${query}.columns`, `columns ${names.join(", ")} (missing ${missing.join(", ")})`);
}

/** The UTC day of a Dune date value ("2026-11-08", or with a time after it). */
function readDay(r: Record<string, unknown>, key: string, at: string): string {
  const day = readString(r, key, at).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ShapeError(`${at}.${key}`, "a YYYY-MM-DD date");
  return day;
}

/** The first day the run had not finished: its rows are kept only for the days before it. */
export const runDay = (result: DuneRows) => result.generatedAt.slice(0, 10);

/** Daily volume and its confidential part (volume − public volume; zero before confidential swaps began). Days without volume are left out. */
export function readVolume(result: DuneRows): { total: DayValue[]; confidential: DayValue[] } {
  requireColumns(result, ["date_at", "volume_usd", "public_volume_usd"], "volume");
  const total: DayValue[] = [];
  const confidential: DayValue[] = [];
  result.rows.forEach((r, i) => {
    const at = `volume[${i}]`;
    const volume = readOptionalNumber(r, "volume_usd", at);
    if (volume === null) return;
    const day = readDay(r, "date_at", at);
    total.push({ day, value: volume });
    const publicVolume = readOptionalNumber(r, "public_volume_usd", at);
    if (publicVolume !== null) confidential.push({ day, value: Math.max(0, volume - publicVolume) });
  });
  return { total, confidential };
}

export function readSwaps(result: DuneRows): DayValue[] {
  requireColumns(result, ["date_at", "total_swaps"], "swaps");
  return result.rows.map((r, i) => {
    const swaps = readNumber(r, "total_swaps", `swaps[${i}]`);
    if (!Number.isInteger(swaps) || swaps < 0) throw new ShapeError(`swaps[${i}].total_swaps`, "a whole number");
    return { day: readDay(r, "date_at", `swaps[${i}]`), value: swaps };
  });
}

/** Fees per day (USD). */
export function readFees(result: DuneRows): DayValue[] {
  requireColumns(result, ["date_at", "fees"], "fees");
  return result.rows.map((r, i) => ({ day: readDay(r, "date_at", `fees[${i}]`), value: readNumber(r, "fees", `fees[${i}]`) }));
}

/** Fees since launch by channel (USD); a row without a referral names no channel, so it is left out, as the panel says. */
export function readFeeChannels(result: DuneRows): Array<{ channel: string; feesUsd: number }> {
  requireColumns(result, ["referral", "fees"], "feeChannels");
  return result.rows.flatMap((r, i) =>
    typeof r.referral === "string" && r.referral.trim() !== "" ? [{ channel: r.referral, feesUsd: readNumber(r, "fees", `feeChannels[${i}]`) }] : [],
  );
}

/** Volume per day and per key column (a chain or a token symbol); rows without volume are left out, and a row without a
    key is counted as "unattributed", so the shares still add up to all volume. */
export function readVolumeBy(result: DuneRows, key: "blockchain" | "symbol"): Array<{ day: string; key: string; volumeUsd: number }> {
  requireColumns(result, ["date_at", key, "volume_usd"], key);
  return result.rows.flatMap((r, i) => {
    const at = `${key}[${i}]`;
    const volume = readOptionalNumber(r, "volume_usd", at);
    const name = r[key];
    if (name !== null && name !== undefined && typeof name !== "string") throw new ShapeError(`${at}.${key}`, "a string or null");
    return volume === null ? [] : [{ day: readDay(r, "date_at", at), key: typeof name === "string" && name.trim() !== "" ? name : "unattributed", volumeUsd: volume }];
  });
}

/** TVL per day and its confidential part (TVL − public TVL; zero before confidential balances began). Days without TVL are left out. */
export function readTvl(result: DuneRows): { total: DayValue[]; confidential: DayValue[] } {
  requireColumns(result, ["date_at", "tvl_usd", "public_tvl_usd"], "tvl");
  const total: DayValue[] = [];
  const confidential: DayValue[] = [];
  result.rows.forEach((r, i) => {
    const at = `tvl[${i}]`;
    const tvl = readOptionalNumber(r, "tvl_usd", at);
    if (tvl === null) return;
    const day = readDay(r, "date_at", at);
    total.push({ day, value: tvl });
    const publicTvl = readOptionalNumber(r, "public_tvl_usd", at);
    if (publicTvl !== null) confidential.push({ day, value: Math.max(0, tvl - publicTvl) });
  });
  return { total, confidential };
}
