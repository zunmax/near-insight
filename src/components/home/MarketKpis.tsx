import { io } from "next/cache";
import type { CSSProperties } from "react";
import { isCompleteMonth } from "@/components/charts/partial-months";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { NoData } from "@/components/ui/NoData";
import { SwipeCards } from "@/components/ui/SwipeCards";
import { getNearAndPeers } from "@/data/market";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatNear, formatPercentFromFull, formatUsd } from "@/lib/format";
import { dayTime, levelChange, YEAR_SECONDS } from "@/lib/metrics";
import { MONTHLY_GROWTH_AGAINST } from "@/lib/thesis/window-name";

const order = (i: number) => ({ "--i": i + 1 }) as CSSProperties;

/** Days of daily Intents volume in the volume card's small chart. */
const VOLUME_TREND_DAYS = 90;

/** Home's market numbers: NEAR Intents volume, NEAR's market cap, the share of new supply absorbed and NEAR bought over 30
    days. Phones show them as cards that swipe sideways, with NEAR's 12-month price as the last card; from 768px they are a
    grid of tiles without the price card, as the NEAR price panel follows them there. */
export async function MarketKpis() {
  await io();
  const [market, volume, metrics, prices] = await Promise.all([
    getNearAndPeers(),
    getSeries(SERIES.intentsVolumeUsd),
    getThesisMetrics(),
    getSeries(SERIES.nearPriceUsd),
  ]);
  if (!market) return <NoData title="NEAR market" />;
  const { near } = market;
  const { intents, absorption, buybacks, dataThrough } = metrics;
  const through = dataThrough ? dayTime(dataThrough) : Infinity;
  const volumeTrend = volume.filter((point) => point.time <= through).slice(-VOLUME_TREND_DAYS).map((point) => point.value);
  const absorbed = absorption?.d30 ?? null;
  /** "30D" while the flows are current; the window's end day once a source has stopped (windowName). */
  const period = metrics.flowsCurrent || !dataThrough ? "30D" : `30D to ${dataThrough}`;
  /** Swipe cards fill most of the screen and snap to its middle, the next one peeking in. */
  const card = "enter shrink-0 basis-[82%] snap-center max-md:min-h-[150px]";

  const cards = [
    <KpiCard
      key="volume"
      label="NEAR Intents volume"
      period={period}
      icon="trend"
      value={intents ? formatUsd(intents.total30d) : "—"}
      change={intents?.changeYoY30d == null ? null : { value: intents.changeYoY30d, against: "vs a year earlier" }}
      trend={volumeTrend}
      large
      className={card}
      style={order(0)}
    />,
    <KpiCard
      key="cap"
      label="Market cap"
      icon="bars"
      value={formatUsd(near.marketCapUsd)}
      detail={`Rank #${near.rank} by market cap`}
      large
      className={card}
      style={order(1)}
    />,
    <KpiCard
      key="absorbed"
      label="New supply absorbed"
      period={period}
      icon="pie"
      value={absorbed ? formatPercentFromFull(absorbed.share, 1) : "—"}
      detail="NEAR burned + bought ÷ NEAR minted"
      large
      className={card}
      style={order(2)}
    />,
    <KpiCard
      key="bought"
      label="NEAR bought"
      period={period}
      icon="bag"
      value={buybacks ? formatNear(buybacks.bought30dNear) : "—"}
      change={buybacks?.monthlyGrowth == null ? null : { value: buybacks.monthlyGrowth, against: MONTHLY_GROWTH_AGAINST }}
      trend={buybacks?.monthlyNear.filter(isCompleteMonth).map((m) => m.value)}
      large
      className={card}
      style={order(3)}
    />,
  ];

  /** The same daily series and 12-month change as the NEAR price panel, which wider screens show instead; the card's
      `md:hidden!` is marked important so it outranks the unlayered `.tile` display. */
  const last = prices.at(-1);
  const change1y = levelChange(prices, 365);
  return (
    <SwipeCards label="NEAR market">
      {cards}
      <KpiCard
        label="NEAR price"
        period="12M"
        icon="price"
        value={formatUsd(near.priceUsd)}
        change={change1y === null ? null : { value: change1y, against: "last 12 months" }}
        trend={last ? prices.filter((point) => point.time >= last.time - YEAR_SECONDS).map((point) => point.value) : undefined}
        large
        className={`${card} md:hidden!`}
        style={order(4)}
      />
    </SwipeCards>
  );
}

/** The market cards' parts and text lengths in order, the last the price card that only the phones' swipe row shows. */
const SKELETON_CARDS = [
  { label: "NEAR Intents volume".length, period: true, change: 6, detail: "vs a year earlier".length, trend: true },
  { label: "Market cap".length, period: false, detail: "Rank #21 by market cap".length, trend: false },
  { label: "New supply absorbed".length, period: true, detail: "NEAR burned + bought ÷ NEAR minted".length, trend: false },
  { label: "NEAR bought".length, period: true, change: 6, detail: MONTHLY_GROWTH_AGAINST.length, trend: true },
  { label: "NEAR price".length, period: true, change: 6, detail: "last 12 months".length, trend: true },
];

/** Loading placeholder of MarketKpis, laid out as SwipeCards: the phones' swipe row with its dots, and from 768px the tiles. */
export function MarketKpisSkeleton() {
  return (
    <div aria-hidden="true" className="border-line max-md:border-b">
      <div className="swipe-row kpi-block flex gap-2.5 overflow-hidden px-4 pt-3 pb-2 md:block md:overflow-visible md:p-0">
        <dl className="tile-grid">
          {SKELETON_CARDS.map((card, i) => (
            <KpiCardSkeleton
              key={i}
              {...card}
              large
              className={`shrink-0 basis-[82%] max-md:min-h-[150px] ${i === SKELETON_CARDS.length - 1 ? "md:hidden!" : ""}`}
            />
          ))}
        </dl>
      </div>
      <div className="flex justify-center gap-1.5 pb-3 md:hidden">
        {SKELETON_CARDS.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full ${i === 0 ? "w-4 bg-accent" : "w-1.5 bg-line-strong"}`} />
        ))}
      </div>
    </div>
  );
}
