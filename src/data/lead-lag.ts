import "server-only";
import { cacheLife } from "next/cache";
import { getSeries } from "@/data/series";
import { SERIES } from "@/db/schema";
import { runLeadLag, type LeadLagResult } from "@/lib/lead-lag";
import { dayTime } from "@/lib/metrics";

/** The lead-lag test on the weeks ending on `throughDay` (the data-through day). It takes about a second, and a new day
    is a new key, so a result is kept for the whole day. No result (histories still being stored) is cached only as long
    as other reads, so the test runs again as soon as they arrive. */
export async function getLeadLag(throughDay: string | null): Promise<LeadLagResult | null> {
  "use cache";
  if (throughDay === null) {
    cacheLife("db");
    return null;
  }
  const [volume, nearPrices, btcPrices, ethPrices, active] = await Promise.all([
    getSeries(SERIES.intentsVolumeUsd),
    getSeries(SERIES.nearPriceHistoryUsd),
    getSeries(SERIES.btcPriceUsd),
    getSeries(SERIES.ethPriceUsd),
    getSeries(SERIES.nearActiveAccounts),
  ]);
  const result = runLeadLag({ intentsVolumeUsd: volume, nearPriceUsd: nearPrices, btcPriceUsd: btcPrices, ethPriceUsd: ethPrices, activeAccounts: active, endTime: dayTime(throughDay) });
  if (result) cacheLife({ stale: 3600, revalidate: 86_400, expire: 86_400 });
  else cacheLife("db");
  return result;
}
