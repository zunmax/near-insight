import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatPercent } from "@/lib/format";
import { DAY_SECONDS, dayTime, isoDay, ratio, rollingWindows } from "@/lib/metrics";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "Confidential share of NEAR Intents volume";
const WEEKS = 52;

/** Confidential swaps' share of NEAR Intents volume in consecutive 7-day blocks to Dune's last day,
    and over 30 days against 90 days earlier. */
export async function IntentsConfidentialPanel() {
  await io();
  const [volume, confidential, metrics] = await Promise.all([
    getSeries(SERIES.duneIntentsVolumeUsd),
    getSeries(SERIES.intentsConfidentialVolumeUsd),
    getThesisMetrics(),
  ]);
  const { intents } = metrics;
  const through = intents?.duneThrough;
  const first = confidential[0];
  if (!intents || !through || !first || intents.confidentialShare30d === null) return <NoData title={TITLE} />;
  const end = dayTime(through);
  const upToEnd = (daily: typeof volume) => daily.filter((p) => p.time <= end);
  const totals = rollingWindows(upToEnd(volume), 7, WEEKS);
  const parts = rollingWindows(upToEnd(confidential), 7, WEEKS);
  /** Only blocks whose seven days all fall inside the stored history. */
  const weekly = totals.flatMap((w, i) => {
    const share = ratio(parts[i]!.value, w.value);
    return w.end - 6 * DAY_SECONDS >= first.time && share !== null ? [{ time: w.end, value: share }] : [];
  });
  if (weekly.length < 2) return <NoData title={TITLE} />;
  const prior = intents.confidentialShare30dPrior90d;
  const comparison = prior === null ? "" : `, against ${formatPercent(prior, 1)} in the 30 days to ${isoDay(end - 90 * DAY_SECONDS)}`;

  return (
    <Panel
      title={TITLE}
      description={`Confidential swaps (run in a private NEAR shard, not on the public chain) made up ${formatPercent(intents.confidentialShare30d, 1)} of NEAR Intents volume over the ${windowName(metrics, "30 days", through)}${comparison}. Public swaps made up the rest.`}
      sources={["dune"]}
      through={`Data through ${through}`}
      sqlId="intents-confidential"
    >
      <LineChart series={[{ name: "Confidential share", points: weekly }]} format="percent" title="Confidential swaps' share of NEAR Intents volume, 7-day blocks, last 12 months" zeroBaseline />
    </Panel>
  );
}

/** Loading placeholder of IntentsConfidentialPanel. */
export function IntentsConfidentialPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={207} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}
