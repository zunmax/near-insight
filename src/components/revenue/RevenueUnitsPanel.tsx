import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { formatMonth, monthStart } from "@/components/charts/chart-format";
import { MILESTONES } from "@/components/charts/milestones";
import { isCompleteMonth } from "@/components/charts/partial-months";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatChange } from "@/lib/format";
import { indexTo100 } from "@/lib/metrics";

const TITLE = "NEAR Intents revenue in dollars and in NEAR";
/** The two change tiles, side by side at every width: their values are short. */
const CHANGES_CLASS = "m-0 mb-4 grid grid-cols-2 gap-2";

/** NEAR Intents revenue a day by month, in USD and in NEAR (each day at its own price), indexed to 100 in the first month with
    revenue on every day. Issuance is paid in NEAR, so growth in NEAR is what counts against it; the gap is the price move. */
export async function RevenueUnitsPanel() {
  await io();
  const { feeChain } = await getThesisMetrics();
  /** Only months with revenue on every day: earlier revenue arrived in occasional lumps, which would make a misleading base. */
  const months = (feeChain?.monthly ?? [])
    .filter((m) => isCompleteMonth({ month: m.month, days: m.revenueDays }) && m.revenueNear > 0)
    .map((m) => ({ month: m.month, usdPerDay: m.revenueUsd / m.revenueDays, nearPerDay: m.revenueNear / m.revenueDays }));
  const usd = indexTo100(months.map((m) => ({ time: monthStart(m.month), value: m.usdPerDay })));
  const near = indexTo100(months.map((m) => ({ time: monthStart(m.month), value: m.nearPerDay })));
  if (!feeChain || usd.length < 2 || near.length < 2) return <NoData title={TITLE} />;
  const first = months[0]!;
  const last = months.at(-1)!;

  return (
    <Panel
      title={TITLE}
      sources={["defillama", "coingecko"]}
      through={`Data through ${feeChain.through}`}
      sqlId="revenue-units"
    >
      <dl className={CHANGES_CLASS}>
        <KpiCard icon="coin" label="Change in dollars" value={formatChange(last.usdPerDay / first.usdPerDay - 1, 0)} />
        <KpiCard icon="coins" label="Change in NEAR" value={formatChange(last.nearPerDay / first.nearPerDay - 1, 0)} />
      </dl>
      <LineChart
        series={[
          { name: "Revenue in USD", points: usd },
          { name: "Revenue in NEAR", points: near },
        ]}
        format="index"
        title={`NEAR Intents revenue a day, by month, in USD and in NEAR, indexed to 100 in ${formatMonth(monthStart(first.month))}`}
        monthly
        markers={[MILESTONES.buybacksStart]}
      />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Change in revenue a day from {formatMonth(monthStart(first.month))} to {formatMonth(monthStart(last.month))}, counting only months with revenue
        on every day. Each day&apos;s revenue is converted to NEAR at that day&apos;s price.
      </p>
    </Panel>
  );
}

/** Loading placeholder of RevenueUnitsPanel. */
export function RevenueUnitsPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <dl className={CHANGES_CLASS}>
        {["Change in dollars", "Change in NEAR"].map((label) => (
          <KpiCardSkeleton key={label} label={label.length} />
        ))}
      </dl>
      <LineChartSkeleton legend={[14, 15]} />
      <NoteSkeleton chars={159} />
    </PanelSkeleton>
  );
}
