import "server-only";
import { cacheLife } from "next/cache";
import { getIntentsReach } from "@/data/intents-flows";
import { getNearAndPeers } from "@/data/market";
import { getNearPrices, getSeries } from "@/data/series";
import { flowContext } from "@/data/thesis-metrics/flow-context";
import { intentsMetrics } from "@/data/thesis-metrics/intents";
import { boughtNear30d } from "@/data/thesis-metrics/revenue";
import { absorptionMetrics, issuanceMetrics } from "@/data/thesis-metrics/supply";
import { SERIES, type SeriesName } from "@/db/schema";
import type { DailyPoint } from "@/lib/metrics";
import { landingFigures, type LandingFigure, type LandingMetrics } from "@/lib/thesis/landing-figures";

/** A read that resolves to `empty` when it fails, so one failing source removes only the figures built on it. */
const orEmpty = <T>(read: Promise<T>, empty: T): Promise<T> => read.catch(() => empty);

/** A metric that is null when building it throws, for the same reason. */
function orNull<T>(build: () => T | null): T | null {
  try {
    return build();
  } catch {
    return null;
  }
}

/** The landing page's live figures, read only from the inputs they need. Each input that fails to read counts as empty and
    each metric that fails counts as missing, so the figures that do not depend on it still show. */
export async function getLandingFigures(): Promise<LandingFigure[]> {
  "use cache";
  cacheLife("db");

  const none: DailyPoint[] = [];
  const series = (name: SeriesName) => orEmpty(getSeries(name), none);
  const [market, volume, buybacks, fees, prices, minted, burnt, supply, swaps, confidentialVolume, intentsReach] = await Promise.all([
    orEmpty(getNearAndPeers(), null),
    series(SERIES.intentsVolumeUsd),
    series(SERIES.intentsBuybacksUsd),
    series(SERIES.nearChainFeesUsd),
    orEmpty(getNearPrices(), none),
    series(SERIES.mintedNear),
    series(SERIES.burntNear),
    series(SERIES.nearTotalSupply),
    series(SERIES.intentsSwaps),
    series(SERIES.intentsConfidentialVolumeUsd),
    orEmpty(getIntentsReach(), null),
  ]);
  const flow = flowContext({ volume, buybacks, fees, prices, minted, burnt, market });
  const metrics: LandingMetrics = {
    dataThrough: flow.throughDay,
    flowsCurrent: flow.current,
    intents: orNull(() => intentsMetrics({ volume, swaps, confidentialVolume }, flow)),
    bought30dNear: orNull(() => boughtNear30d(flow)),
    issuance: orNull(() => issuanceMetrics({ minted, supply }, flow)),
    absorption: orNull(() => absorptionMetrics({ minted, burnt }, flow)),
    intentsReach,
  };
  return landingFigures(metrics);
}
