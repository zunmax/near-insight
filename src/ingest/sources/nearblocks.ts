import { bearer, SOURCES } from "../../config/sources.ts";
import { asArray, asRecord, readString, ShapeError, yoctoToNear } from "../../lib/validate.ts";
import type { DayValue } from "../days.ts";
import { fetchJson, serialGate } from "../http.ts";

const gate = serialGate(SOURCES.nearblocks.pacingMs);

/** GET from NearBlocks at the free tier's pace, retries included, with the optional API key. */
const get = (url: string) => gate(() => fetchJson(url, { headers: bearer(SOURCES.nearblocks.apiKey) }, SOURCES.nearblocks.pacingMs));

/** `data` of a v3 response: every v3 endpoint answers `{ data, meta? }`. */
const v3Data = async (path: string) => asRecord(await get(`${SOURCES.nearblocks.v3BaseUrl}${path}`), path).data;

/** Rows of a v3 daily list, newest first. */
const v3Rows = async (path: string) => asArray(await v3Data(path), `${path}.data`).map((row, i) => asRecord(row, `${path}.data[${i}]`));

/** A count NearBlocks writes as a number or as a string of digits. */
function readCount(r: Record<string, unknown>, key: string, at: string): number {
  const value = r[key];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  throw new ShapeError(`${at}.${key}`, "a whole number");
}

/** A decimal amount NearBlocks writes as a string ("734.6766"), already in whole units. */
function readDecimal(r: Record<string, unknown>, key: string, at: string): number {
  const value = readString(r, key, at);
  if (!/^\d+(\.\d+)?$/.test(value)) throw new ShapeError(`${at}.${key}`, "a decimal string");
  return Number(value);
}

/** A yoctoNEAR amount NearBlocks writes as a decimal string ("123.00000000"), in NEAR; the fraction of a yoctoNEAR is dropped. */
const readDecimalYocto = (r: Record<string, unknown>, key: string, at: string) =>
  yoctoToNear(readString(r, key, at).split(".")[0] ?? "", `${at}.${key}`);

/** The UTC day of a row's `date` ("2026-11-03" or "2026-11-03T00:00:00.000Z"). */
function readDay(r: Record<string, unknown>, at: string): string {
  const day = readString(r, "date", at).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ShapeError(`${at}.date`, "a YYYY-MM-DD date");
  return day;
}

/** One series per field from daily rows. */
function columns<K extends string>(rows: Array<Record<string, unknown>>, path: string, read: (r: Record<string, unknown>, at: string) => Record<K, number>) {
  const parsed = rows.map((r, i) => ({ day: readDay(r, `${path}[${i}]`), values: read(r, `${path}[${i}]`) }));
  return (key: K): DayValue[] => parsed.map((p) => ({ day: p.day, value: p.values[key] }));
}

/** Last UTC day NearBlocks has finished its daily stats for (GET /v3/sync/status/daily-stats). */
export async function fetchDailyStatsThrough(): Promise<string> {
  return readDay(asRecord(await v3Data("/sync/status/daily-stats"), "sync.data"), "sync.data");
}

type ChartHistory = {
  txns: DayValue[];
  activeAccounts: DayValue[];
  newAccounts: DayValue[];
  totalSupplyNear: DayValue[];
  txnFeesNear: DayValue[];
};

/** Daily chain activity since genesis from GET /v1/charts, the only NearBlocks endpoint with the active and new account
    counts NEAR reports (v3 counts relayed users as active and has no new accounts). */
export async function fetchChartHistory(): Promise<ChartHistory> {
  const body = asRecord(await get(`${SOURCES.nearblocks.baseUrl}/charts`), "charts");
  const rows = asArray(body.charts, "charts.charts").map((row, i) => {
    const at = `charts.charts[${i}]`;
    const r = asRecord(row, at);
    return {
      day: readDay(r, at),
      txns: readCount(r, "txns", at),
      activeAccounts: readCount(r, "active_accounts", at),
      newAccounts: readCount(r, "new_accounts", at),
      totalSupplyNear: readDecimalYocto(r, "total_supply", at),
      txnFeesNear: readDecimalYocto(r, "txn_fee", at),
    };
  });
  return {
    txns: rows.map((r) => ({ day: r.day, value: r.txns })),
    activeAccounts: rows.map((r) => ({ day: r.day, value: r.activeAccounts })),
    newAccounts: rows.map((r) => ({ day: r.day, value: r.newAccounts })),
    totalSupplyNear: rows.map((r) => ({ day: r.day, value: r.totalSupplyNear })),
    txnFeesNear: rows.map((r) => ({ day: r.day, value: r.txnFeesNear })),
  };
}

type DailyStats = {
  txns: DayValue[];
  /** Transactions a relayer signed for another account (NEP-366 meta transactions). */
  relayedTxns: DayValue[];
  txnFeesNear: DayValue[];
  totalSupplyNear: DayValue[];
  /** Accounts whose actions a relayer submitted and paid gas for. */
  relayedAccounts: DayValue[];
};

/** The last `days` days of v3 daily stats: GET /v3/txn-stats, /v3/block-stats and /v3/address-stats. */
export async function fetchDailyStats(days: number): Promise<DailyStats> {
  const txnPath = `/txn-stats?limit=${days}`;
  const blockPath = `/block-stats?limit=${days}`;
  const addressPath = `/address-stats?limit=${days}`;
  const txn = columns(await v3Rows(txnPath), txnPath, (r, at) => ({
    txns: readCount(r, "txns", at),
    relayedTxns: readCount(r, "meta_txns", at),
    txnFeesNear: readDecimal(r, "txn_fee", at),
  }));
  const block = columns(await v3Rows(blockPath), blockPath, (r, at) => ({ totalSupplyNear: yoctoToNear(readString(r, "total_supply", at), `${at}.total_supply`) }));
  const address = columns(await v3Rows(addressPath), addressPath, (r, at) => ({ relayedAccounts: readCount(r, "meta_accounts", at) }));
  return {
    txns: txn("txns"),
    relayedTxns: txn("relayedTxns"),
    txnFeesNear: txn("txnFeesNear"),
    totalSupplyNear: block("totalSupplyNear"),
    relayedAccounts: address("relayedAccounts"),
  };
}

/** Daily transactions of an account over the last `days` days. */
export async function fetchAccountDailyTxns(accountId: string, days: number): Promise<DayValue[]> {
  const path = `/accounts/${encodeURIComponent(accountId)}/stats/txns?limit=${days}`;
  return columns(await v3Rows(path), path, (r, at) => ({ txns: readCount(r, "txns", at) }))("txns");
}

/** End-of-day NEAR balance of an account (liquid `amount` plus its own `amount_staked`, the balance view_account gives as amount
    plus locked) on each of its last `limit` days with a change (GET /v3/accounts/{id}/stats/balance). Days without a change have no row. */
export async function fetchBalanceChanges(accountId: string, limit: number): Promise<DayValue[]> {
  const path = `/accounts/${encodeURIComponent(accountId)}/stats/balance?limit=${limit}`;
  return (await v3Rows(path)).map((r, i) => {
    const at = `${path}[${i}]`;
    const liquid = yoctoToNear(readString(r, "amount", at), `${at}.amount`);
    const staked = yoctoToNear(readString(r, "amount_staked", at), `${at}.amount_staked`);
    return { day: readDay(r, at), value: liquid + staked };
  });
}
