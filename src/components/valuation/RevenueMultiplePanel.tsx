import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatMultiple as times } from "@/lib/format";
import { isoDay, YEAR_SECONDS } from "@/lib/metrics";

const TITLE = "NEAR market cap ÷ network revenue";

/** NEAR's market cap against its network revenue of the last 30 days, annualized, each day of the last 12 months, beside the
    median of its whole history. */
export async function RevenueMultiplePanel() {
  await io();
  const { revenueMultiple: multiple } = await getThesisMetrics();
  if (!multiple || multiple.daily.length < 2) return <NoData title={TITLE} />;
  const { daily, latest, median, low, high } = multiple;
  const first = daily[0]!;
  /** The chart shows the last 12 months; the low, high and median cover every day since the first. */
  const year = daily.filter((point) => point.time > latest.time - YEAR_SECONDS);

  return (
    <Panel
      title={TITLE}
      description={`On ${isoDay(latest.time)}, NEAR's market cap was ${times(latest.value)} its yearly network revenue (the 30 days to that day, annualized). Since ${isoDay(first.time)} the multiple has ranged from ${times(low)} to ${times(high)}, with a median of ${times(median)}.`}
      sources={["defillama", "coingecko"]}
      through={`Data through ${isoDay(latest.time)}`}
      sqlId="revenue-multiple"
    >
      <LineChart
        series={[
          { name: "Market cap ÷ network revenue", points: year },
          { name: "Median", points: year.map((point) => ({ time: point.time, value: median })) },
        ]}
        format="multiple"
        title="NEAR market cap ÷ network revenue of the last 30 days, annualized, daily, last 12 months"
        zeroBaseline
      />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Network revenue is NEAR Intents revenue plus the gas fees paid on NEAR. It is a run rate: each day uses the 30 days to that day, not the last 12 months.
      </p>
    </Panel>
  );
}

/** Loading placeholder of RevenueMultiplePanel. */
export function RevenueMultiplePanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={190} tabs="Chart">
      <LineChartSkeleton legend={["Market cap ÷ network revenue".length, "Median".length]} />
      <NoteSkeleton chars={152} />
    </PanelSkeleton>
  );
}
