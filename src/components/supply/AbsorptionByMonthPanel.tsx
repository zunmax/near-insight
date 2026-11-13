import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { monthStart } from "@/components/charts/chart-format";
import { MILESTONES } from "@/components/charts/milestones";
import { partialMonthsNote } from "@/components/charts/partial-months";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { getThesisMetrics } from "@/data/thesis-metrics";

const TITLE = "New supply absorbed by month";

/** Each calendar month's NEAR burned and bought as shares of the NEAR minted that month. */
export async function AbsorptionByMonthPanel() {
  await io();
  const { absorption } = await getThesisMetrics();
  const months = absorption?.monthly ?? [];
  if (!absorption || months.length < 2) return <NoData title={TITLE} />;
  const partial = partialMonthsNote(months);

  return (
    <Panel
      title={TITLE}
      sources={["nearArchive", "defillama", "coingecko"]}
      through={`Data through ${absorption.monthlyThrough}`}
      sqlId="absorption-monthly"
    >
      <LineChart
        series={[
          { name: "Burned + bought", points: months.map((m) => ({ time: monthStart(m.month), value: m.share })) },
          { name: "Bought", points: months.map((m) => ({ time: monthStart(m.month), value: m.boughtShare })) },
          { name: "Burned", points: months.map((m) => ({ time: monthStart(m.month), value: m.burntShare })) },
        ]}
        format="percent"
        title="NEAR burned, bought and both as shares of the NEAR minted each calendar month"
        zeroBaseline
        monthly
        markers={[MILESTONES.buybacksStart]}
      />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        <NoBreakTokens
          text={`Each point is one calendar month.${partial ? ` ${partial}` : ""} Buybacks began on ${BUYBACKS_START_DAY}; before that, only the fee burn absorbed new supply.`}
        />
      </p>
    </Panel>
  );
}

/** Loading placeholder of AbsorptionByMonthPanel. */
export function AbsorptionByMonthPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <LineChartSkeleton legend={["Burned + bought".length, "Bought".length, "Burned".length]} />
      <NoteSkeleton chars={155} />
    </PanelSkeleton>
  );
}
