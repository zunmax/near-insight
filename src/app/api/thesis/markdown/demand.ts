/** Thesis section 1: NEAR Intents volume, swaps, confidential share and TVL, and its share of NEAR's DEX volume and transactions. */
import { DASH, DEFILLAMA, daysTo, NEARBLOCKS_V1, NEARBLOCKS_V3, show, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section } from "@/app/api/thesis/markdown/section";
import { DEFILLAMA_PUBLIC_ONLY } from "@/config/intents";
import { INTENTS_CONTRACT, SOURCES } from "@/config/sources";
import { formatChangeFromZero, formatCompact, formatPercent, formatUsd } from "@/lib/format";
import { DAY_SECONDS, dayTime, isoDay } from "@/lib/metrics";

const { baseUrl, dashboard, queries } = SOURCES.dune;

/** The day 365 days before `through`, the end of the year-earlier window the 30-day comparisons use. */
const yearEarlier = (through: string | null) => (through === null ? null : isoDay(dayTime(through) - 365 * DAY_SECONDS));

/** The DEX share's label, saying when its window holds days on which DefiLlama left out confidential swaps. */
const dexShareLabel = (publicOnly: boolean | undefined) =>
  `NEAR Intents share of all DEX volume on NEAR${publicOnly ? `; the window overlaps ${DEFILLAMA_PUBLIC_ONLY.label}, when DefiLlama counted only public swaps` : ""}`;

export function demandSection(input: ThesisDocumentInput): string {
  const { intents: i, intentsTvl, dexShare, intentsTxnShare, dataThrough: t } = input.metrics;
  return section(
    1,
    "demand",
    input,
    [
      ["NEAR Intents volume", show(i?.total30d, formatUsd), daysTo(30, t)],
      ["NEAR Intents volume, same 30 days a year earlier", show(i?.changeYoY30d == null ? null : i.yearAgo30d, formatUsd), daysTo(30, yearEarlier(t))],
      ["Change in NEAR Intents volume against the same 30 days a year earlier", show(i?.changeYoY30d, formatChangeFromZero), daysTo(30, t)],
      ["NEAR Intents volume", show(i?.total1y, formatUsd), daysTo(365, t)],
      ["Change in NEAR Intents volume, 90 days against the 90 days before", show(i?.change90d, formatChangeFromZero), `${daysTo(90, t)}, against the 90 days before`],
      ["NEAR Intents swaps, public and confidential", show(i?.swaps30d, (v) => formatCompact(v, 2)), daysTo(30, i?.duneThrough ?? null)],
      ["NEAR Intents swaps, same 30 days a year earlier", show(i?.swapsYearAgo30d, (v) => formatCompact(v, 2)), daysTo(30, yearEarlier(i?.duneThrough ?? null))],
      ["Change in swaps against the same 30 days a year earlier", show(i?.swapsChangeYoY30d, formatChangeFromZero), daysTo(30, i?.duneThrough ?? null)],
      ["Average swap (volume ÷ swaps)", show(i?.avgSwapUsd30d, formatUsd), daysTo(30, i?.duneThrough ?? null)],
      ["Average swap (volume ÷ swaps), same 30 days a year earlier", show(i?.avgSwapUsdYearAgo30d, formatUsd), daysTo(30, yearEarlier(i?.duneThrough ?? null))],
      ["Confidential swaps' share of volume", show(i?.confidentialShare30d, (v) => formatPercent(v, 1)), daysTo(30, i?.duneThrough ?? null)],
      ["Funds held in NEAR Intents (TVL)", show(intentsTvl?.totalUsd, formatUsd), intentsTvl?.day ?? DASH],
      [dexShareLabel(dexShare?.d30PublicOnly), show(dexShare?.d30, (v) => formatPercent(v, 1)), daysTo(30, t)],
      [dexShareLabel(dexShare?.d180PublicOnly), show(dexShare?.d180, (v) => formatPercent(v, 1)), daysTo(180, t)],
      [`${INTENTS_CONTRACT} share of all NEAR transactions`, show(intentsTxnShare?.avg30d, (v) => formatPercent(v, 1)), daysTo(30, intentsTxnShare?.through ?? null)],
    ],
    [],
    `Dune: the NEAR team's dashboard \`${baseUrl}/${dashboard.handle}/${dashboard.slug}\`, queries ${queries.volume} (volume, public and confidential), ${queries.swaps} (swaps), ${queries.chainVolume} (volume by chain), ${queries.symbolVolume} (volume by token) and ${queries.tvl} (TVL), each at \`${baseUrl}/queries/{id}\`; DefiLlama \`GET ${DEFILLAMA}/summary/dexs/near-intents?excludeTotalDataChartBreakdown=true\` (Intents volume on days Dune does not have, and for the DEX share) and \`GET ${DEFILLAMA}/overview/dexs/near?excludeTotalDataChartBreakdown=true\` (every DEX on NEAR); NearBlocks \`GET ${NEARBLOCKS_V3}/accounts/${INTENTS_CONTRACT}/stats/txns?limit=${SOURCES.nearblocks.maxDailyRows}\`, \`GET ${NEARBLOCKS_V3}/txn-stats?limit=${SOURCES.nearblocks.maxDailyRows}\` and \`GET ${NEARBLOCKS_V1}/charts\` (active and new accounts, and transactions before v3's ${SOURCES.nearblocks.maxDailyRows} days).`,
  );
}
