/** The lead-lag test of whether NEAR Intents volume leads NEAR's price or usage, and its score. */
import { DASH, DEFILLAMA_COINS, sectionHeading, show, table, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { COIN_PRICE_HISTORY_START } from "@/config/ingest";
import { LEAD_LAG } from "@/config/lead-lag";
import { SOURCES } from "@/config/sources";
import { leadLagQuestionText } from "@/content/lead-lag";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import { formatCorrelation, formatMultiple, formatPercent, formatPValue, formatUsd } from "@/lib/format";

/** "0 of 17" tests significant after the Holm correction, or null before the test has enough weeks. */
function leadLagScore(m: ThesisMetrics): string | null {
  return m.leadLag ? `${m.leadLag.tests.filter((t) => t.significant).length} of ${m.leadLag.tests.length}` : null;
}

/** How far one series leads the other: "same week" or "2 wk". */
const lagText = (lag: number) => (lag === 0 ? "same week" : `${lag} wk`);

/** The lead-lag section of THESIS.md, tested on weekly changes: does Intents volume lead NEAR's price or usage? */
export function leadLagSection(input: ThesisDocumentInput): string {
  const result = input.metrics.leadLag;
  const title = sectionHeading("Test: does NEAR Intents volume lead NEAR's price or usage?", "🧪");
  if (!result) return [title, `The database does not cover ${LEAD_LAG.minWeeks} weeks of the needed series yet.`].join("\n\n");
  const significant = result.tests.filter((t) => t.significant);
  const rows = result.tests.map((t) => [
    leadLagQuestionText(t.question, t.lag),
    lagText(t.lag),
    show(t.r, formatCorrelation),
    show(t.p, (p) => formatPValue(p, LEAD_LAG.alpha)),
    show(t.pAdjusted, (p) => formatPValue(p, LEAD_LAG.alpha)),
  ]);
  return [
    title,
    `**Result:** ${leadLagScore(input.metrics)} tests ${significant.length === 1 ? "is" : "are"} significant at ${formatPercent(LEAD_LAG.alpha, 0)} after the Holm correction${
      significant.length === 0 ? ": no test finds a link, same-week or lagged, in either direction." : `: ${significant.map((t) => `${leadLagQuestionText(t.question, t.lag)}, ${lagText(t.lag)}`).join("; ")}.`
    }`,
    `**Sample:** ${result.weeks} weekly changes from ${result.from} to ${result.to}, in 7-day blocks ending on ${input.metrics.dataThrough ?? DASH}, from the first week with at least ${formatUsd(LEAD_LAG.minWeeklyVolumeUsd)} of Intents volume. NEAR's weekly return moved ${formatMultiple(result.marketBeta, 2)} the market's (the average of BTC and ETH); that market part is removed before NEAR's return is tested against Intents volume, while the tests of NEAR's return against active accounts use its whole return.`,
    table(["Test", "Lag", "Correlation", "p", "p, adjusted"], rows),
    `**Re-run:** DefiLlama \`GET ${DEFILLAMA_COINS}/chart/coingecko:{near|bitcoin|ethereum}?start={unix}&span=${SOURCES.defillama.coinsMaxPoints}&period=1d&searchWidth=600\` (daily prices from ${COIN_PRICE_HISTORY_START}), Intents volume and NearBlocks active accounts as in section 1.`,
  ].join("\n\n");
}
