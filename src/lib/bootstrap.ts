/** Seeded stationary block bootstrap (Politis and Romano), shared by the lead-lag test and the growth range of NEAR bought. */
import { monthlyRate } from "@/lib/metrics";

/** Pseudo-random numbers in [0, 1) from a fixed seed (mulberry32), so a test drawn with them gives the same result every run. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Fills `into` with one stationary block bootstrap draw of `x`: wrapping blocks of consecutive values whose length averages
    `meanBlock`, so the draw keeps the series' short-term pattern but not its order. */
export function blockDraw(x: number[], meanBlock: number, random: () => number, into: number[]): void {
  const n = x.length;
  let at = Math.floor(random() * n);
  for (let i = 0; i < n; i++) {
    if (i > 0) at = random() < 1 / meanBlock ? Math.floor(random() * n) : (at + 1) % n;
    into[i] = x[at]!;
  }
}

/** Value at share `p` of `sorted`, interpolating between neighbors (the usual sample quantile). */
function quantile(sorted: number[], p: number): number {
  const at = (sorted.length - 1) * p;
  const below = Math.floor(at);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below]! + (at - below) * (sorted[above]! - sorted[below]!);
}

/** Settings of a bootstrap range: central share covered, average block length in values, draws and seed. */
type RangeSettings = { level: number; meanBlock: number; draws: number; seed: number };

/** Central `level` range of the compound growth over `months` from the sum of `prior` to the sum of `latest`, over `draws` draws
    that resample each window's daily values in blocks. Draws with no growth (an earlier window summing to zero) are skipped; null when all are. */
export function windowGrowthRange(latest: number[], prior: number[], months: number, settings: RangeSettings): { low: number; high: number } | null {
  if (latest.length === 0 || prior.length === 0) return null;
  const random = seededRandom(settings.seed);
  const latestDraw = new Array<number>(latest.length);
  const priorDraw = new Array<number>(prior.length);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const growths: number[] = [];
  for (let draw = 0; draw < settings.draws; draw++) {
    blockDraw(latest, settings.meanBlock, random, latestDraw);
    blockDraw(prior, settings.meanBlock, random, priorDraw);
    const before = sum(priorDraw);
    const growth = before > 0 ? monthlyRate(sum(latestDraw) / before - 1, months) : null;
    if (growth !== null) growths.push(growth);
  }
  if (growths.length === 0) return null;
  growths.sort((a, b) => a - b);
  const tail = (1 - settings.level) / 2;
  return { low: quantile(growths, tail), high: quantile(growths, 1 - tail) };
}
