import { io } from "next/cache";
import { ChangePill } from "@/components/ui/KpiCard";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatNear, formatUsd } from "@/lib/format";
import { levelChange } from "@/lib/metrics";
import { MONTHLY_GROWTH_AGAINST, windowName } from "@/lib/thesis/window-name";

const TITLE = "At a glance";

/** NEAR's price, NEAR Intents volume and NEAR bought, each with its change, and the market cap with its rank, for the right column. */
export async function AtAGlance() {
  await io();
  const [metrics, prices] = await Promise.all([getThesisMetrics(), getSeries(SERIES.nearPriceUsd)]);
  const { market, intents, buybacks } = metrics;
  if (!market) return <NoData title={TITLE} />;
  const windowLabel = windowName(metrics, "30 days");
  const rows = [
    { label: "NEAR price", value: formatUsd(market.priceUsd), change: levelChange(prices, 365), against: "last 12 months" },
    { label: "Market cap", value: formatUsd(market.marketCapUsd), note: `Rank #${market.rank}` },
    { label: `NEAR Intents volume, ${windowLabel}`, value: intents ? formatUsd(intents.total30d) : "—", change: intents?.changeYoY30d ?? null, against: "vs a year earlier" },
    {
      label: `NEAR bought, ${windowLabel}`,
      value: buybacks ? formatNear(buybacks.bought30dNear) : "—",
      change: buybacks?.monthlyGrowth ?? null,
      against: MONTHLY_GROWTH_AGAINST,
    },
  ];

  return (
    <Panel title={TITLE} sources={["coingecko", "dune", "defillama"]}>
      <dl className="m-0">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-line-strong/55 py-3 first:border-t-0 first:pt-1 last:pb-0">
            <dt className="text-[13px] text-muted">{row.label}</dt>
            <dd className="m-0 mt-1">
              <span className="block text-[20px] leading-[1.15] font-extrabold tracking-[-0.01em] text-ink tabular-nums">
                {row.value}
                {"note" in row ? <span className="ml-2 text-[13px] font-medium tracking-normal text-muted">{row.note}</span> : null}
              </span>
              {"change" in row && row.change !== null && row.change !== undefined ? (
                <span className="mt-1 flex items-baseline gap-1.5 text-[13px] leading-snug whitespace-nowrap text-muted">
                  <ChangePill value={row.change} />
                  <span>{row.against}</span>
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Lengths of each row's label and change line (0 for the market cap, which has a note beside its value instead). */
const SKELETON_ROWS = [
  { label: "NEAR price".length, change: "+38.1% last 12 months".length },
  { label: "Market cap".length, change: 0 },
  { label: 41, change: "+58.2% vs a year earlier".length },
  { label: 34, change: `+20.0% ${MONTHLY_GROWTH_AGAINST}`.length },
];

/** Loading placeholder of AtAGlance: the four rows of label, value and change. */
export function AtAGlanceSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length}>
      <div className="m-0">
        {SKELETON_ROWS.map((row, i) => (
          <div key={i} className="border-t border-line-strong/55 py-3 first:border-t-0 first:pt-1 last:pb-0">
            <p className="text-[13px]">
              <SkeletonWords chars={row.label} />
            </p>
            <p className="mt-1 text-[20px] leading-[1.15] font-extrabold">
              <SkeletonWords chars={6} />
            </p>
            {row.change ? (
              <p className="mt-1 text-[13px] leading-snug whitespace-nowrap">
                <SkeletonWords chars={row.change} />
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </PanelSkeleton>
  );
}
