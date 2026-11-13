import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatMoveFromZero, formatPercent, formatUsd } from "@/lib/format";
import { dayTime, YEAR_SECONDS } from "@/lib/metrics";

const TITLE = "Funds held in NEAR Intents";

/** NEAR Intents TVL and its confidential part over the 12 months to the newest stored day. */
export async function IntentsTvlPanel() {
  await io();
  const [tvl, confidential, { intentsTvl }] = await Promise.all([getSeries(SERIES.intentsTvlUsd), getSeries(SERIES.intentsConfidentialTvlUsd), getThesisMetrics()]);
  if (!intentsTvl) return <NoData title={TITLE} />;
  const end = dayTime(intentsTvl.day);
  /** The chart reads its series by index, so both carry the same days;
      days before confidential balances began count as zero. */
  const confidentialByDay = new Map(confidential.map((p) => [p.time, p.value]));
  const firstConfidential = confidential[0]?.time ?? Infinity;
  const days = tvl.filter((p) => p.time > end - YEAR_SECONDS && p.time <= end && (p.time < firstConfidential || confidentialByDay.has(p.time)));
  const share = intentsTvl.confidentialShare === null ? "" : `, ${formatPercent(intentsTvl.confidentialShare, 0)} of it in confidential balances`;
  const change =
    intentsTvl.change30d === null || intentsTvl.change30d <= -1
      ? ""
      : `, ${formatMoveFromZero(intentsTvl.change30d)} from ${formatUsd(intentsTvl.totalUsd / (1 + intentsTvl.change30d))} 30 days earlier`;

  return (
    <Panel
      title={TITLE}
      description={`${formatUsd(intentsTvl.totalUsd)} was held in NEAR Intents on ${intentsTvl.day}${share}${change}.`}
      sources={["dune"]}
      through={`Data through ${intentsTvl.day}`}
      sqlId="intents-tvl"
    >
      <LineChart
        series={[
          { name: "All balances", points: days },
          { name: "Confidential", points: days.map((p) => ({ time: p.time, value: confidentialByDay.get(p.time) ?? 0 })) },
        ]}
        format="usd"
        title="NEAR Intents TVL, all balances and confidential, last 12 months"
        zeroBaseline
      />
    </Panel>
  );
}

/** Loading placeholder of IntentsTvlPanel. */
export function IntentsTvlPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={124} tabs="Chart">
      <LineChartSkeleton legend={["All balances".length, "Confidential".length]} />
    </PanelSkeleton>
  );
}
