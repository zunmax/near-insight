import { io } from "next/cache";
import { ColumnChart, ColumnChartSkeleton } from "@/components/charts/ColumnChart";
import { monthLabel } from "@/components/charts/chart-format";
import { lastCompleteIndex, partialMonthIndexes, partialMonthsNote } from "@/components/charts/partial-months";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatPercent } from "@/lib/format";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "Share of fees that buys NEAR, by month";

/** NEAR Intents fees spent buying NEAR as a share of all NEAR Intents fees, per calendar month since buybacks began. */
export async function CaptureRatePanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { feeChain } = metrics;
  /** A month counts its days since buying began, so the month buybacks began is marked as partial. */
  const months = (feeChain?.monthly ?? []).flatMap((m) => (m.buybacksUsd > 0 && m.captureRate !== null ? [{ month: m.month, days: m.buyingDays, value: m.captureRate }] : []));
  if (!feeChain || months.length === 0) return <NoData title={TITLE} />;
  const d90 = feeChain.d90?.captureRate ?? null;
  const partial = partialMonthsNote(months);

  return (
    <Panel
      title={TITLE}
      description={d90 === null ? undefined : `${formatPercent(d90, 1)} of NEAR Intents fees were spent buying NEAR over the ${windowName(metrics, "90 days", feeChain.through)}.`}
      sources={["dune", "defillama"]}
      through={`Data through ${feeChain.through}`}
      sqlId="capture-rate-monthly"
    >
      <ColumnChart
        points={months.map((m) => ({ label: monthLabel(m.month), value: m.value }))}
        format="percent"
        selected={lastCompleteIndex(months)}
        partial={partialMonthIndexes(months)}
        title="Share of NEAR Intents fees spent buying NEAR each month"
      />
      {partial ? <p className="mt-3 text-[12px] leading-relaxed text-muted">{partial}</p> : null}
    </Panel>
  );
}

/** Loading placeholder of CaptureRatePanel. */
export function CaptureRatePanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={81} tabs="Chart">
      <ColumnChartSkeleton columns={12} />
      <NoteSkeleton chars={52} />
    </PanelSkeleton>
  );
}
