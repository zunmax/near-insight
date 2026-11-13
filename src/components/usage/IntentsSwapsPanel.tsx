import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatCompact, formatCount, formatMoveFromZero } from "@/lib/format";
import { dayTime, YEAR_SECONDS } from "@/lib/metrics";
import { averageSwap } from "@/lib/thesis/findings";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "NEAR Intents swaps per day";

/** NEAR Intents swaps per day, public and confidential, over the 12 months to Dune's last day, with the average
    swap size and the chains and tokens of the newest day. */
export async function IntentsSwapsPanel() {
  await io();
  const [swaps, metrics] = await Promise.all([getSeries(SERIES.intentsSwaps), getThesisMetrics()]);
  const { intents, intentsReach } = metrics;
  const through = intents?.duneThrough;
  if (!intents || !through || intents.swaps30d === null) return <NoData title={TITLE} />;
  const end = dayTime(through);
  const shown = swaps.filter((p) => p.time > end - YEAR_SECONDS && p.time <= end);
  const yearOnYear =
    intents.swapsChangeYoY30d === null || intents.swapsYearAgo30d === null
      ? ""
      : `, ${formatMoveFromZero(intents.swapsChangeYoY30d)} from ${formatCompact(intents.swapsYearAgo30d, 2)} in the same 30 days a year earlier`;
  const reach = intentsReach
    ? ` On ${intentsReach.day}, volume was counted under ${formatCount(intentsReach.tokens, "token symbol")} on ${formatCount(intentsReach.chains, "chain")}.`
    : "";

  return (
    <Panel
      title={TITLE}
      description={`${formatCompact(intents.swaps30d, 2)} ${intents.swaps30d === 1 ? "swap" : "swaps"} over the ${windowName(metrics, "30 days", through)}${yearOnYear}.${averageSwap(intents)}${reach}`}
      sources={["dune"]}
      through={`Data through ${through}${intentsReach && intentsReach.day !== through ? `; chains and tokens on ${intentsReach.day}` : ""}`}
      sqlId="intents-swaps"
    >
      <LineChart series={[{ name: "Swaps", points: shown }]} format="number" title="NEAR Intents swaps per day, public and confidential, last 12 months" zeroBaseline />
    </Panel>
  );
}

/** Loading placeholder of IntentsSwapsPanel. */
export function IntentsSwapsPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={264} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}
