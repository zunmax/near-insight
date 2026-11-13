import { io } from "next/cache";
import { ColumnChart, ColumnChartSkeleton } from "@/components/charts/ColumnChart";
import { monthLabel } from "@/components/charts/chart-format";
import { lastCompleteIndex, partialMonthIndexes, partialMonthsNote } from "@/components/charts/partial-months";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { INTENTS_FEES } from "@/content/facts";
import { getThesisMetrics } from "@/data/thesis-metrics";

const TITLE = "NEAR bought by month";
const HOW_HEADING = "How the buying works";

/** NEAR bought with NEAR Intents fees each month, and how the buying works. */
export async function BuybacksPanel() {
  await io();
  const { buybacks: b, dataThrough } = await getThesisMetrics();
  if (!b || b.monthlyNear.length === 0) return <NoData title={TITLE} />;
  const points = b.monthlyNear.map((m) => ({ label: monthLabel(m.month), value: m.value }));
  const partial = partialMonthsNote(b.monthlyNear);

  return (
    <Panel
      title={TITLE}
      sources={["defillama", "coingecko"]}
      through={`Data through ${dataThrough}`}
      sqlId="bought-by-month"
    >
      <ColumnChart
        points={points}
        format="near"
        selected={lastCompleteIndex(b.monthlyNear)}
        partial={partialMonthIndexes(b.monthlyNear)}
        title="NEAR bought with NEAR Intents fees each month (each day's buyback dollars at that day's price)"
      />
      {partial ? <p className="mt-3 text-[12px] leading-relaxed text-muted">{partial}</p> : null}

      <h3 className="mt-5 text-[13.5px] font-semibold">{HOW_HEADING}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
        <NoBreakTokens
          text={`The ${INTENTS_FEES.contract.label} itself charges ${INTENTS_FEES.contract.value}. The money that buys NEAR comes from the fees of two apps on top of it: the ${INTENTS_FEES.app.label} (${INTENTS_FEES.app.value}) and the ${INTENTS_FEES.oneClick.label} (${INTENTS_FEES.oneClick.value}). Since ${BUYBACKS_START_DAY}, their operators send those fees to buy NEAR on the open market; this is their choice, not a protocol rule. The fees reach the three fee wallets: the buyback wallet, and one wallet each for the app's and the 1Click API's fees. The NEAR they hold is not burned, so it stays in total supply.`}
        />
      </p>
    </Panel>
  );
}

/** Loading placeholder of BuybacksPanel. */
export function BuybacksPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <ColumnChartSkeleton columns={12} />
      <NoteSkeleton chars={52} />
      <h3 className="mt-5 text-[13.5px] font-semibold">
        <SkeletonWords chars={HOW_HEADING.length} />
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed">
        <SkeletonWords chars={534} />
      </p>
    </PanelSkeleton>
  );
}
