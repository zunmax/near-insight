import { NO_REFERRAL } from "../../config/intents.ts";
import { bearer, SOURCES } from "../../config/sources.ts";
import { asArray, asRecord, readNumber, readString, ShapeError } from "../../lib/validate.ts";
import { fetchJson, serialGate } from "../http.ts";

const { baseUrl, apiKey, pacingMs, pageSize } = SOURCES.intentsExplorer;

const gate = serialGate(pacingMs);

/** One referral's completed swaps on a day: the count, dollars swapped in and app fees. */
type DayTotals = { swaps: number; volumeUsd: number; feesUsd: number };

/** A dollar amount the API writes as a decimal string ("1368.48"). */
function readUsd(r: Record<string, unknown>, key: string, at: string): number {
  const value = Number(readString(r, key, at));
  if (!Number.isFinite(value) || value < 0) throw new ShapeError(`${at}.${key}`, "a decimal string of dollars");
  return value;
}

/** App fees of one swap in dollars: each fee's basis points of the dollars swapped in. */
function appFeesUsd(r: Record<string, unknown>, volumeUsd: number, at: string): number {
  return asArray(r.appFees, `${at}.appFees`).reduce<number>((sum, fee, i) => {
    const bps = readNumber(asRecord(fee, `${at}.appFees[${i}]`), "fee", `${at}.appFees[${i}]`);
    if (bps < 0) throw new ShapeError(`${at}.appFees[${i}].fee`, "basis points of zero or more");
    return sum + (volumeUsd * bps) / 10_000;
  }, 0);
}

/** Totals by referral of the completed swaps created on the UTC day `day` (GET /transactions, newest first, one page at a
    time after the last page's deposit address and memo). Each swap is added to its referral's totals and dropped, so no
    record outlives the call. */
export async function fetchReferralDay(day: string): Promise<Map<string, DayTotals>> {
  const start = Date.parse(`${day}T00:00:00Z`);
  /** Both bounds are exclusive, so the window opens a millisecond before the day. */
  const window = {
    numberOfTransactions: String(pageSize),
    statuses: "SUCCESS",
    startTimestamp: new Date(start - 1).toISOString(),
    endTimestamp: new Date(start + 86_400_000).toISOString(),
  };
  const totals = new Map<string, DayTotals>();
  /** A page boundary can repeat a swap, so each deposit address and memo is counted once. */
  const seen = new Set<string>();
  let after: Record<string, string> = {};
  for (let page = 0; ; page++) {
    const path = `transactions ${day} page ${page}`;
    const params = new URLSearchParams({ ...window, ...after });
    const rows = asArray(await gate(() => fetchJson(`${baseUrl}/transactions?${params}`, { headers: bearer(apiKey) }, pacingMs)), path);
    let last: { address: string; memo: string | null } | null = null;
    let unseen = 0;
    for (const [i, row] of rows.entries()) {
      const at = `${path}[${i}]`;
      const r = asRecord(row, at);
      const address = readString(r, "depositAddress", at);
      const memo = r.depositMemo == null ? null : readString(r, "depositMemo", at);
      last = { address, memo };
      const id = `${address}\u0000${memo ?? ""}`;
      if (seen.has(id)) continue;
      seen.add(id);
      unseen += 1;
      if (readString(r, "status", at) !== "SUCCESS" || readString(r, "createdAt", at).slice(0, 10) !== day) continue;
      const referral = r.referral == null || r.referral === "" ? NO_REFERRAL : readString(r, "referral", at);
      const volumeUsd = readUsd(r, "amountInUsd", at);
      const sum = totals.get(referral) ?? { swaps: 0, volumeUsd: 0, feesUsd: 0 };
      sum.swaps += 1;
      sum.volumeUsd += volumeUsd;
      sum.feesUsd += appFeesUsd(r, volumeUsd, at);
      totals.set(referral, sum);
    }
    if (rows.length < pageSize || last === null) return totals;
    /** A full page of swaps already read means the cursor did not move, so reading on would repeat it without end. */
    if (unseen === 0) throw new ShapeError(path, "swaps after the previous page's last one");
    after = last.memo === null ? { lastDepositAddress: last.address } : { lastDepositAddress: last.address, lastDepositMemo: last.memo };
  }
}
