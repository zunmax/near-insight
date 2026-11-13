import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { ChangePill } from "@/components/ui/KpiCard";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { getNearAndPeers } from "@/data/market";
import { getSeries } from "@/data/series";
import { SERIES } from "@/db/schema";
import { formatUsd } from "@/lib/format";
import { isoDay, levelChange, YEAR_SECONDS } from "@/lib/metrics";

const TITLE = "NEAR price";
const CHART_HEIGHT = 280;

/** NEAR's daily price over the last 12 months, with today's price and its change over the year above the chart. */
export async function PricePanel() {
  await io();
  const [market, prices] = await Promise.all([getNearAndPeers(), getSeries(SERIES.nearPriceUsd)]);
  /** Today's price shows as soon as market data exists; the chart below says when its history is still too short. */
  if (!market) return <NoData title={TITLE} />;
  const last = prices.at(-1);
  const year = last ? prices.filter((point) => point.time >= last.time - YEAR_SECONDS) : [];
  /** From the same stored series the chart draws, so the change matches its first and last points. */
  const change1y = levelChange(prices, 365);
  const { near } = market;

  return (
    <Panel
      title={TITLE}
      sources={["coingecko"]}
      through={`Data through ${last ? isoDay(last.time) : market.fetchedAt.slice(0, 10)}`}
      sqlId="near-price"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="text-[30px] leading-none font-extrabold tabular-nums">{formatUsd(near.priceUsd)}</span>
        {change1y === null ? null : (
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <ChangePill value={change1y} />
            last 12 months
          </span>
        )}
      </div>
      <LineChart series={[{ name: "NEAR price", points: year }]} format="usd" title="NEAR price in USD, daily, last 12 months" height={CHART_HEIGHT} />
    </Panel>
  );
}

/** Loading placeholder of PricePanel: the price with its yearly change, then the chart. */
export function PricePanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="text-[30px] leading-none font-extrabold">
          <SkeletonWords chars={5} />
        </span>
        <span className="text-[13px]">
          <SkeletonWords chars={22} />
        </span>
      </div>
      <LineChartSkeleton height={CHART_HEIGHT} />
    </PanelSkeleton>
  );
}
