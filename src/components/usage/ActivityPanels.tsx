import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES, type SeriesName } from "@/db/schema";
import { formatCompact, formatMoveFromZero, formatPercent, formatUsd } from "@/lib/format";
import { coversWindow, dayTime, isoDay, levelChange, ratio, sharedDays, sumWindow, windowMedian, YEAR_SECONDS } from "@/lib/metrics";
import { windowName } from "@/lib/thesis/window-name";

const TRANSACTIONS_TITLE = "Transactions per day";
const ACCOUNTS_TITLE = "Active and new accounts per day";
const TVL_TITLE = "DeFi TVL on NEAR";
const STABLECOINS_TITLE = "Stablecoins on NEAR";
const ACCOUNT_SERIES = ["Active (signed a transaction)", "Relayed (gas paid by a relayer)", "New accounts"] as const;

/** A stored daily series in full and over the year to its newest day; null when it has no points. */
async function lastYear(series: SeriesName) {
  const points = await getSeries(series);
  const last = points.at(-1);
  /** The year starts on the day the yearly change is measured from (levelChange), so the chart shows both ends of it. */
  return last ? { all: points, year: points.filter((p) => p.time >= last.time - YEAR_SECONDS) } : null;
}

/** Comparison of a 30-day figure with the same 30 days a year earlier; empty when that year-ago window is missing. */
const vsYearAgo = (change: number | null, yearAgo: number | null) =>
  change === null || yearAgo === null ? "" : `, ${formatMoveFromZero(change)} from ${formatCompact(yearAgo, 2)} in the same 30 days a year earlier`;

/** A level against the same day a year earlier, from the latest value and its change: ", down 20% from $1.5B a year earlier". */
const yearEarlierText = (latest: number, change: number | null) =>
  change === null || change <= -1 ? "" : `, ${formatMoveFromZero(change)} from ${formatUsd(latest / (1 + change))} a year earlier`;

/** Daily transactions; the description adds the share a relayer signed and paid gas for on another account's behalf. */
export async function TransactionsPanel() {
  await io();
  const [metrics, txns, relayed] = await Promise.all([getThesisMetrics(), lastYear(SERIES.nearTxns), getSeries(SERIES.nearRelayedTxns)]);
  const { activity } = metrics;
  if (!activity || !txns) return <NoData title={TRANSACTIONS_TITLE} />;
  /** The total and the relayed share it describes, only when every day of the 30 is stored. */
  const end = dayTime(activity.through);
  const totalCovered = coversWindow(txns.all, 30, 0, end);
  const relayedShare = totalCovered && coversWindow(relayed, 30, 0, end) ? ratio(sumWindow(relayed, 30, 0, end), sumWindow(txns.all, 30, 0, end)) : null;
  const relayedText = relayedShare === null ? "" : ` Relayers signed and paid the gas for ${formatPercent(relayedShare, 1)} of them on other accounts' behalf.`;
  return (
    <Panel
      title={TRANSACTIONS_TITLE}
      description={
        totalCovered
          ? `${formatCompact(activity.txns.last30d, 2)} transactions in the ${windowName(metrics, "30 days", activity.through)}${vsYearAgo(activity.txns.change, activity.txns.yearAgo30d)}.${relayedText}`
          : undefined
      }
      sources={["nearblocks"]}
      through={`Data through ${activity.through}`}
      sqlId="chain-activity-yoy"
    >
      <LineChart series={[{ name: "Transactions", points: txns.year }]} format="number" title="NEAR transactions per day, last 12 months" zeroBaseline />
    </Panel>
  );
}

/** Accounts that signed a transaction (30-day median, so a short burst does not lift it), accounts that acted through
    a relayer paying their gas, and new accounts, on one chart. */
export async function AccountsPanel() {
  await io();
  const [metrics, active, created, relayed] = await Promise.all([
    getThesisMetrics(),
    lastYear(SERIES.nearActiveAccounts),
    getSeries(SERIES.nearNewAccounts),
    getSeries(SERIES.nearRelayedAccounts),
  ]);
  const { activity } = metrics;
  if (!activity || !active) return <NoData title={ACCOUNTS_TITLE} />;
  const { median30d, medianYearAgo30d, change } = activity.activeAccounts;
  const [withNew, newAll] = sharedDays(active.year, created);
  const [activeDaily, relayedDaily] = relayed.length > 0 ? sharedDays(withNew, relayed) : [withNew, []];
  const [, newDaily] = sharedDays(activeDaily, newAll);
  const window = windowName(metrics, "30 days", activity.through);
  /** Over the same 30 days as the signer median it sits beside. */
  const relayedMedian = coversWindow(relayed, 30, 0, dayTime(activity.through)) ? windowMedian(relayed, 30, 0, dayTime(activity.through)) : null;
  const activeText = median30d === null ? "" : `A median of ${formatCompact(median30d, 2)} accounts a day signed a transaction over the ${window}${vsYearAgo(change, medianYearAgo30d)}. `;
  const relayedText = relayedMedian === null ? "" : `A median of ${formatCompact(relayedMedian)} more acted through a relayer that paid their gas. `;
  /** A total only when every day of the 30 is stored, so a missing day never prints a short one. */
  const newText = coversWindow(created, 30, 0, dayTime(activity.through))
    ? `New accounts totaled ${formatCompact(activity.newAccounts.last30d, 2)} in the ${window}${vsYearAgo(activity.newAccounts.change, activity.newAccounts.yearAgo30d)}.`
    : "";
  return (
    <Panel
      title={ACCOUNTS_TITLE}
      description={`${activeText}${relayedText}${newText}`.trim() || undefined}
      sources={["nearblocks"]}
      through={`Data through ${activity.through}`}
      sqlId="chain-activity-yoy"
    >
      <LineChart
        series={[
          { name: ACCOUNT_SERIES[0], points: activeDaily },
          ...(relayedDaily.length > 0 ? [{ name: ACCOUNT_SERIES[1], points: relayedDaily }] : []),
          { name: ACCOUNT_SERIES[2], points: newDaily },
        ]}
        format="number"
        title="NEAR accounts per day that signed a transaction, acted through a relayer, or were created, last 12 months"
        zeroBaseline
      />
    </Panel>
  );
}

/** DeFi TVL on NEAR each day over the last 12 months, against the same day a year earlier. */
export async function TvlPanel() {
  await io();
  const tvl = await lastYear(SERIES.nearTvlUsd);
  if (!tvl) return <NoData title={TVL_TITLE} />;
  const change = levelChange(tvl.all, 365);
  const last = tvl.all.at(-1)!;
  return (
    <Panel
      title={TVL_TITLE}
      description={`DeFi TVL on NEAR was ${formatUsd(last.value)} on ${isoDay(last.time)}${yearEarlierText(last.value, change)}.`}
      sources={["defillama"]}
      through={`Data through ${isoDay(last.time)}`}
      sqlId="tvl-stablecoins"
    >
      <LineChart series={[{ name: "TVL", points: tvl.year }]} format="usd" title="DeFi TVL on NEAR, daily, last 12 months" zeroBaseline />
    </Panel>
  );
}

/** USD-pegged stablecoins on NEAR each day over the last 12 months, against the same day a year earlier. */
export async function StablecoinsPanel() {
  await io();
  const stables = await lastYear(SERIES.nearStablecoinsUsd);
  if (!stables) return <NoData title={STABLECOINS_TITLE} />;
  const change = levelChange(stables.all, 365);
  const last = stables.all.at(-1)!;
  return (
    <Panel
      title={STABLECOINS_TITLE}
      description={`USD-pegged stablecoins on NEAR came to ${formatUsd(last.value)} on ${isoDay(last.time)}${yearEarlierText(last.value, change)}.`}
      sources={["defillama"]}
      through={`Data through ${isoDay(last.time)}`}
      sqlId="tvl-stablecoins"
    >
      <LineChart series={[{ name: "Stablecoins", points: stables.year }]} format="usd" title="USD-pegged stablecoins on NEAR, daily, last 12 months" zeroBaseline />
    </Panel>
  );
}

/** Loading placeholder of TransactionsPanel. */
export function TransactionsPanelSkeleton() {
  return (
    <PanelSkeleton title={TRANSACTIONS_TITLE.length} text={185} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}

/** Loading placeholder of AccountsPanel. */
export function AccountsPanelSkeleton() {
  return (
    <PanelSkeleton title={ACCOUNTS_TITLE.length} text={326} tabs="Chart">
      <LineChartSkeleton legend={ACCOUNT_SERIES.map((name) => name.length)} />
    </PanelSkeleton>
  );
}

/** Loading placeholder of TvlPanel. */
export function TvlPanelSkeleton() {
  return (
    <PanelSkeleton title={TVL_TITLE.length} text={83} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}

/** Loading placeholder of StablecoinsPanel. */
export function StablecoinsPanelSkeleton() {
  return (
    <PanelSkeleton title={STABLECOINS_TITLE.length} text={101} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}
