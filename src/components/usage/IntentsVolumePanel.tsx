import { io } from "next/cache";
import { ColumnChart, ColumnChartSkeleton } from "@/components/charts/ColumnChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatCount, formatShortDate, formatUsd } from "@/lib/format";
import { DAY_SECONDS, dayTime, rollingWindows } from "@/lib/metrics";

const TITLE = "NEAR Intents volume, 30-day totals";
/** Days in each column's window, and the number of columns. */
const WINDOW_DAYS = 30;
const WINDOWS = 12;

export async function IntentsVolumePanel() {
  await io();
  const [daily, { intents, dataThrough }] = await Promise.all([getSeries(SERIES.intentsVolumeUsd), getThesisMetrics()]);
  if (!intents || !dataThrough) return <NoData title="NEAR Intents volume" />;
  const end = dayTime(dataThrough);
  const first = daily[0]?.time ?? end;
  /** Only windows whose 30 days all fall inside the stored history, so no column shows a short or empty total. */
  const points = rollingWindows(
    daily.filter((point) => point.time <= end),
    WINDOW_DAYS,
    WINDOWS,
  )
    .filter((w) => w.end - (WINDOW_DAYS - 1) * DAY_SECONDS >= first)
    .map((w) => ({ label: formatShortDate(w.end), value: w.value }));
  if (points.length === 0) return <NoData title="NEAR Intents volume" />;
  /** The sentence totals the windows drawn, so it adds up to the columns. */
  const shownTotal = points.reduce((sum, point) => sum + point.value, 0);

  return (
    <Panel
      title={TITLE}
      description={`NEAR Intents volume was ${formatUsd(shownTotal)} over the ${points.length * WINDOW_DAYS} days to ${dataThrough}, shown as ${formatCount(points.length, "consecutive total")} of ${WINDOW_DAYS} days.`}
      sources={["dune", "defillama"]}
      through={`Data through ${dataThrough}`}
      sqlId="intents-volume"
    >
      <ColumnChart points={points} periodPrefix="30 days to" title="NEAR Intents swap volume, consecutive 30-day windows (USD)" />
    </Panel>
  );
}

/** Loading placeholder of IntentsVolumePanel. */
export function IntentsVolumePanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={107} tabs="Chart">
      <ColumnChartSkeleton columns={WINDOWS} />
    </PanelSkeleton>
  );
}
