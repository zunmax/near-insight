import { io } from "next/cache";
import { ColumnChart, ColumnChartSkeleton } from "@/components/charts/ColumnChart";
import { monthLabel } from "@/components/charts/chart-format";
import { lastCompleteIndex, partialMonthIndexes, partialMonthsNote } from "@/components/charts/partial-months";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatBps, formatUsd } from "@/lib/format";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "NEAR Intents fees per $1M swapped, by month";

/** Gross fees ÷ volume each calendar month, as dollars of fees per $1 million swapped. */
export async function FeeRatePanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { feeChain } = metrics;
  const months = (feeChain?.monthly ?? []).flatMap((m) => (m.feeRate !== null && m.volumeUsd > 0 ? [{ month: m.month, days: m.days, value: m.feeRate * 1_000_000 }] : []));
  if (!feeChain || months.length === 0) return <NoData title={TITLE} />;
  const { d30, d90 } = feeChain.feeRates;
  const partial = partialMonthsNote(months);
  const description =
    d30 === null
      ? undefined
      : `NEAR Intents users paid ${formatUsd(d30 * 1_000_000)} in fees for every $1 million swapped over the ${windowName(metrics, "30 days", feeChain.through)} (${formatBps(d30)})${d90 === null ? "" : `, and ${formatUsd(d90 * 1_000_000)} over the ${windowName(metrics, "90 days", feeChain.through)}`}. Fees include the protocol fee and every front end's own fee.`;

  return (
    <Panel
      title={TITLE}
      description={description}
      sources={["dune", "defillama"]}
      through={`Data through ${feeChain.through}`}
      sqlId="fee-rate-monthly"
    >
      <ColumnChart
        points={months.map((m) => ({ label: monthLabel(m.month), value: m.value }))}
        format="usd"
        selected={lastCompleteIndex(months)}
        partial={partialMonthIndexes(months)}
        title="NEAR Intents fees per $1 million swapped, by calendar month (USD)"
      />
      {partial ? <p className="mt-3 text-[12px] leading-relaxed text-muted">{partial}</p> : null}
    </Panel>
  );
}

/** Loading placeholder of FeeRatePanel. */
export function FeeRatePanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={214} tabs="Chart">
      <ColumnChartSkeleton columns={24} />
      <NoteSkeleton chars={52} />
    </PanelSkeleton>
  );
}
