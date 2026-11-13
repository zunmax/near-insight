/** NEAR Intents volume, swaps, confidential share and TVL, its share of DEX volume and of NEAR transactions, and its reach. */
import { DEFILLAMA_PUBLIC_ONLY } from "@/config/intents";
import { commonEnd, coversWindow, DAY_SECONDS, dayTime, flowYoY, isoDay, monthlyTable, ratio, ratioByDay, sharedDays, sumWindow, valueAt, windowChange, type DailyPoint } from "@/lib/metrics";
import type { FlowContext } from "./flow-context";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

export function intentsMetrics(
  { volume, swaps, confidentialVolume }: Pick<ThesisInputs, "volume" | "swaps" | "confidentialVolume">,
  { through, end, sum, covered, completeEnd }: FlowContext,
): ThesisMetrics["intents"] {
  /** Every day of the 30-day window must be stored, so a missing day never prints a short total as the last 30 days. */
  if (through === null || !covered(volume, 30)) return null;
  const yoy = flowYoY(volume, end);
  /** Swaps and confidential volume come from Dune alone, so their windows end on the last day both have, at most `end`, or
      before a day missing from them; on those days the merged volume is Dune's own. */
  const duneLast = swaps.length > 0 && confidentialVolume.length > 0 ? Math.min(end, commonEnd(swaps, confidentialVolume)) : null;
  const duneEnd = duneLast === null ? null : (completeEnd([swaps, confidentialVolume, volume], duneLast) ?? duneLast);
  /** A Dune sum only when every day of its window is stored. */
  const duneSum = (daily: DailyPoint[], offsetDays: number) =>
    duneEnd !== null && coversWindow(daily, 30, offsetDays, duneEnd) ? sumWindow(daily, 30, offsetDays, duneEnd) : null;
  const swaps30d = duneSum(swaps, 0);
  const swapsYearAgo30d = duneSum(swaps, 365);
  const confidentialShare = (offsetDays: number) => {
    const confidential = duneSum(confidentialVolume, offsetDays);
    return confidential === null || duneEnd === null || !coversWindow(volume, 30, offsetDays, duneEnd) ? null : ratio(confidential, sumWindow(volume, 30, offsetDays, duneEnd));
  };
  const has90d = covered(volume, 180);
  return {
    total30d: sum(volume, 30),
    change90d: has90d ? windowChange(volume, 90, end) : null,
    total90d: has90d ? sum(volume, 90) : null,
    prior90d: has90d ? sumWindow(volume, 90, 90, end) : null,
    yearAgo30d: yoy.yearAgo30d,
    changeYoY30d: yoy.change,
    total1y: covered(volume, 365) ? sum(volume, 365) : null,
    duneThrough: duneEnd === null ? null : isoDay(duneEnd),
    swaps30d,
    swapsYearAgo30d,
    swapsChangeYoY30d: swaps30d !== null && swapsYearAgo30d !== null && swapsYearAgo30d > 0 ? swaps30d / swapsYearAgo30d - 1 : null,
    avgSwapUsd30d: swaps30d === null || duneEnd === null || !coversWindow(volume, 30, 0, duneEnd) ? null : ratio(sumWindow(volume, 30, 0, duneEnd), swaps30d),
    avgSwapUsdYearAgo30d:
      swapsYearAgo30d === null || duneEnd === null || !coversWindow(volume, 30, 365, duneEnd) ? null : ratio(sumWindow(volume, 30, 365, duneEnd), swapsYearAgo30d),
    confidentialShare30d: confidentialShare(0),
    confidentialShare30dPrior90d: confidentialShare(90),
  };
}

/** TVL on its own newest day: a level, so it is read where it ends rather than on the flows' data-through day. */
export function intentsTvlMetrics({ tvl, confidentialTvl }: ThesisInputs): ThesisMetrics["intentsTvl"] {
  const last = tvl.at(-1);
  if (!last) return null;
  const monthEarlier = last.time - 30 * DAY_SECONDS;
  return {
    day: isoDay(last.time),
    totalUsd: last.value,
    confidentialShare: confidentialTvl.at(-1)?.time === last.time ? ratio(confidentialTvl.at(-1)!.value, last.value) : null,
    change30d: tvl[0]!.time <= monthEarlier && valueAt(tvl, monthEarlier) > 0 ? last.value / valueAt(tvl, monthEarlier) - 1 : null,
  };
}

/** DefiLlama's own Intents volume against DefiLlama's DEX volume on NEAR, which counts Intents among its DEXes. */
export function dexShareMetrics({ defillamaVolume, dexVolume }: ThesisInputs, { through, end, covered, monthlyEnd, sum }: FlowContext): ThesisMetrics["dexShare"] {
  const volume = defillamaVolume;
  /** The monthly shares sum both series over the same days, as the intents-dex-share query does. */
  const [volumeOnDexDays, dexOnVolumeDays] = sharedDays(volume, dexVolume);
  const dexShareOver = (days: number) => (covered(dexVolume, days) && covered(volume, days) ? ratio(sum(volume, days), sum(dexVolume, days)) : null);
  const includesPublicOnly = (days: number) =>
    end - (days - 1) * DAY_SECONDS <= dayTime(DEFILLAMA_PUBLIC_ONLY.through) && end >= dayTime(DEFILLAMA_PUBLIC_ONLY.from);
  const monthsEnd = monthlyEnd(dexVolume, volume);
  return through !== null
    ? {
        d30: dexShareOver(30),
        d180: dexShareOver(180),
        d30PublicOnly: includesPublicOnly(30),
        d180PublicOnly: includesPublicOnly(180),
        monthly: monthlyTable({ intents: volumeOnDexDays, dex: dexOnVolumeDays }, monthsEnd).map(({ month, days, sums }) => ({
          month,
          days,
          share: ratio(sums.intents, sums.dex),
        })),
        monthlyThrough: isoDay(monthsEnd),
      }
    : null;
}

/** Ends on the last day both NearBlocks series have, which can differ from dataThrough. */
export function intentsTxnShareMetrics({ intentsTxns, txns }: ThesisInputs): ThesisMetrics["intentsTxnShare"] {
  const shareEnd = intentsTxns.length > 0 && txns.length > 0 ? commonEnd(intentsTxns, txns) : null;
  return shareEnd !== null
    ? {
        through: isoDay(shareEnd),
        avg30d: coversWindow(intentsTxns, 30, 0, shareEnd) && coversWindow(txns, 30, 0, shareEnd) ? ratio(sumWindow(intentsTxns, 30, 0, shareEnd), sumWindow(txns, 30, 0, shareEnd)) : null,
        daily: ratioByDay(intentsTxns, txns),
      }
    : null;
}
