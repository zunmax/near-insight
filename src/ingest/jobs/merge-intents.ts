/** NEAR Intents volume and fees as the dashboard reads them, rebuilt from the Dune and DefiLlama series. */
import type { DatabaseSync } from "node:sqlite";
import { SERIES, type SeriesName } from "../../db/schema.ts";

/** [merged, primary, fallback, newest fallback days left out]: Dune counts public and confidential swaps on every day; DefiLlama
    counted only public swaps from April to August 2026 and is the same as Dune otherwise, so it fills the days Dune does not
    have. DefiLlama's fees copy Dune's, whose newest fee day is still filling, so the fee fallback stops a day before its newest. */
const MERGED: Array<[SeriesName, SeriesName, SeriesName, number]> = [
  [SERIES.intentsVolumeUsd, SERIES.duneIntentsVolumeUsd, SERIES.defillamaIntentsVolumeUsd, 0],
  [SERIES.intentsFeesUsd, SERIES.duneIntentsFeesUsd, SERIES.defillamaIntentsFeesUsd, 1],
];

/** Rebuilds each merged series: the primary source's value on each day it has one, the fallback's otherwise. Call inside a transaction. */
export function mergeIntentsFlows(db: DatabaseSync) {
  const clear = db.prepare("DELETE FROM daily_series WHERE series = ?");
  const fill = db.prepare(
    `INSERT INTO daily_series (series, day, value)
     SELECT ?1, day, value FROM daily_series WHERE series = ?2
     UNION ALL
     SELECT ?1, f.day, f.value FROM daily_series f
     WHERE f.series = ?3 AND NOT EXISTS (SELECT 1 FROM daily_series p WHERE p.series = ?2 AND p.day = f.day)
       AND f.day <= (SELECT date(MAX(day), '-' || ?4 || ' days') FROM daily_series WHERE series = ?3)`,
  );
  for (const [merged, primary, fallback, newestLeftOut] of MERGED) {
    clear.run(merged);
    fill.run(merged, primary, fallback, newestLeftOut);
  }
}
