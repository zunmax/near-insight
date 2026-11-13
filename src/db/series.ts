import type { DatabaseSync } from "node:sqlite";
import { CORE_SERIES } from "./schema.ts";

/** The last day every core series has (the oldest of their last days), or null while one of them has no rows. */
export function coreLastDay(db: DatabaseSync): string | null {
  const ends = db
    .prepare(`SELECT MAX(day) AS day FROM daily_series WHERE series IN (${CORE_SERIES.map(() => "?").join(", ")}) GROUP BY series`)
    .all(...CORE_SERIES)
    .map((row) => String(row.day));
  return ends.length === CORE_SERIES.length ? ends.reduce((a, b) => (a < b ? a : b)) : null;
}
