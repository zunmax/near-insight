import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { HowCalculated, HowCalculatedSkeleton } from "@/components/ui/HowCalculated";
import { MetricStrip, MetricStripSkeleton } from "@/components/ui/MetricStrip";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { BUYBACK_ACCOUNT, FRONTEND_FEE_ACCOUNT, ONE_CLICK_FEE_ACCOUNT } from "@/config/sources";
import { TRIGGERS } from "@/config/thesis-triggers";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES, type SeriesName } from "@/db/schema";
import { formatNear, formatPercent, percentRounded } from "@/lib/format";
import { YEAR_SECONDS } from "@/lib/metrics";

const TITLE = "NEAR in the three fee wallets";

/** The wallets NEAR Intents fees reach, what each holds, and the stored daily balance series of each. */
const WALLETS: Array<{ account: string; role: string; balance: "buybackNear" | "frontendNear" | "oneClickNear"; series: SeriesName }> = [
  { account: BUYBACK_ACCOUNT, role: "Buyback wallet", balance: "buybackNear", series: SERIES.buybackWalletNear },
  { account: FRONTEND_FEE_ACCOUNT, role: "NEAR Intents app fees", balance: "frontendNear", series: SERIES.frontendFeeWalletNear },
  { account: ONE_CLICK_FEE_ACCOUNT, role: "1Click API fees", balance: "oneClickNear", series: SERIES.oneClickFeeWalletNear },
];

/** A wallet's short name: its account up to the first dot, e.g. "buybacks". */
const shortName = (account: string) => account.split(".")[0]!;

/** NEAR held by each fee wallet and in total, their 30-day change against the NEAR counted as bought, and the balances over the last 12 months. */
export async function FeeWalletsPanel() {
  await io();
  const [{ feeWallets: wallets }, ...histories] = await Promise.all([getThesisMetrics(), ...WALLETS.map((w) => getSeries(w.series))]);
  if (!wallets) return <NoData title={TITLE} />;
  const gainDay = wallets.gainThrough ?? wallets.asOf;

  /** The chart shares time stamps by index, so it keeps only the days all three balances were read, over the last 12 months. */
  const lookups = histories.map((daily) => new Map(daily.map((point) => [point.time, point.value])));
  const shared = (histories[0] ?? []).filter((point) => lookups.every((lookup) => lookup.has(point.time))).map((point) => point.time);
  const days = shared.filter((time) => time > shared.at(-1)! - YEAR_SECONDS);
  const series = WALLETS.map((w, i) => ({
    name: shortName(w.account),
    points: days.map((time) => ({ time, value: lookups[i]!.get(time)! })),
  }));
  const { bought30dNear: bought, gain30dNear: gain } = wallets;
  /** The same measure as the Data checks row: bought ÷ the wallets' gain − 1, worded as the verdict words it. */
  const gap = bought !== null && gain !== null && gain > 0 ? bought / gain - 1 : null;
  const gapNote =
    gap === null
      ? undefined
      : percentRounded(gap, 1) === 0
        ? "NEAR bought matches this change to within 0.1%"
        : `NEAR bought is ${formatPercent(Math.abs(gap), 1)} ${gap < 0 ? "below" : "above"} this change`;

  return (
    <Panel
      title={TITLE}
      sources={["nearRpc", "nearblocks", "defillama", "coingecko"]}
      through={`Balances on ${wallets.asOf}`}
      sqlId="fee-wallets"
    >
      <MetricStrip
        metrics={[
          ...WALLETS.map((w) => ({ label: shortName(w.account), value: formatNear(wallets[w.balance]), detail: w.role })),
          { label: "All three", value: formatNear(wallets.totalNear), detail: `On ${wallets.asOf}` },
        ]}
      />
      <MetricStrip
        className="mt-2"
        metrics={[
          { label: `NEAR bought, 30 days to ${gainDay}`, value: bought === null ? "—" : formatNear(bought) },
          { label: "Change in the three wallets, same days", value: gain === null ? "—" : formatNear(gain), detail: gapNote },
          {
            label: "Largest daily gap between NEAR bought and the wallets' gain, same days",
            value: wallets.shortfall30dNear === null ? "—" : formatNear(wallets.shortfall30dNear),
            detail: `Breaking point: above ${formatPercent(TRIGGERS.walletShortfallShare, 0)} of the 30 days' NEAR bought`,
          },
        ]}
      />
      <div className="mt-4">
        {days.length >= 2 ? (
          <LineChart series={series} format="near" title="NEAR held by each NEAR Intents fee wallet, daily, last 12 months" height={200} zeroBaseline />
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-2">No balance history yet.</p>
        )}
      </div>
      <HowCalculated>
        <NoBreakTokens
          text={`NEAR Intents fees reach these three wallets: ${WALLETS.map((w) => w.account).join(", ")}. NEAR that arrives at any of them counts as bought, so NEAR bought is compared with the combined change of the three balances over the same days. The wallets already held NEAR before buybacks began on ${BUYBACKS_START_DAY}.`}
        />
      </HowCalculated>
    </Panel>
  );
}

/** Loading placeholder of FeeWalletsPanel. */
export function FeeWalletsPanelSkeleton() {
  const names = WALLETS.map((w) => shortName(w.account).length);
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <MetricStripSkeleton metrics={[...WALLETS.map((w, i) => ({ label: names[i]!, detail: w.role.length })), { label: 9, detail: 13 }]} />
      <MetricStripSkeleton className="mt-2" metrics={[{ label: 34 }, { label: 38, detail: 37 }, { label: 70, detail: 52 }]} />
      <div className="mt-4">
        <LineChartSkeleton height={200} legend={names} />
      </div>
      <HowCalculatedSkeleton />
    </PanelSkeleton>
  );
}
