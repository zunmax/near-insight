/** NEAR Intents Explorer API job: completed 1Click swaps, volume and app fees per day by referral. */
import type { DatabaseSync } from "node:sqlite";
import { INGEST_SCHEDULE_MS, INTENTS_EXPLORER_DAYS, PAGED_RUN_BUDGET_MS } from "../../config/ingest.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS } from "../../db/schema.ts";
import { ShapeError } from "../../lib/validate.ts";
import { addDays, today } from "../days.ts";
import { fetchReferralDay } from "../sources/intents-explorer.ts";
import type { Job } from "./job.ts";

/** Days not stored yet, newest first: from the first stored day, or the first day of a new history, through the newest
    day whose swaps have settled. */
function unreadDays(db: DatabaseSync): string[] {
  const last = addDays(today(), -INTENTS_EXPLORER_DAYS.lagDays);
  const start = addDays(last, 1 - INTENTS_EXPLORER_DAYS.days);
  const firstStored = db.prepare("SELECT MIN(day) AS day FROM intents_referral_daily").get()?.day;
  const first = firstStored != null && String(firstStored) < start ? String(firstStored) : start;
  const stored = new Set(db.prepare("SELECT DISTINCT day FROM intents_referral_daily WHERE day >= ?").all(first).map((r) => String(r.day)));
  const days: string[] = [];
  for (let day = last; day >= first; day = addDays(day, -1)) if (!stored.has(day)) days.push(day);
  return days;
}

/** Explorer API, every 10 minutes: reads each unread day whole and stores it in one transaction, so a day is either fully
    stored or not at all. A day starts only within PAGED_RUN_BUDGET_MS of the run's start; the next run reads the rest. */
export const intentsExplorerJob: Job = {
  name: JOBS.intentsExplorer,
  everyMs: INGEST_SCHEDULE_MS.intentsExplorer,
  async run(db) {
    const deadline = Date.now() + PAGED_RUN_BUDGET_MS;
    const insert = db.prepare("INSERT INTO intents_referral_daily (day, referral, swaps, volume_usd, fees_usd) VALUES (?, ?, ?, ?, ?)");
    let rows = 0;
    for (const day of unreadDays(db)) {
      if (Date.now() >= deadline) break;
      const totals = await fetchReferralDay(day);
      /** Every settled day has completed swaps, so an empty one is a failed read, not a day to store. */
      if (totals.size === 0) throw new ShapeError(`transactions ${day}`, "at least one completed swap");
      rows += transaction(db, () => {
        for (const [referral, t] of totals) insert.run(day, referral, t.swaps, t.volumeUsd, t.feesUsd);
        return totals.size;
      });
    }
    return rows;
  },
  backlog: (db) => unreadDays(db).length > 0,
};
