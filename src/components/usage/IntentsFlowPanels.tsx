import { io } from "next/cache";
import { BarList, BarListSkeleton } from "@/components/charts/BarList";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { INTENTS_CHAIN_NAMES, INTENTS_CHAIN_ROWS } from "@/config/intents";
import { getChainVolumes, getIntentsVolumeMix } from "@/data/intents-flows";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { DAY_SECONDS, isoDay, ratio, rollingWindows, sumWindow } from "@/lib/metrics";

const CHAIN_TITLE = "NEAR Intents volume by chain";
const STABLECOIN_TITLE = "Stablecoin share of NEAR Intents volume";
const WEEKS = 52;

/** How volume is split, shown under both panels. */
const COUNTING_NOTE = "Volume by chain and volume by token each sum to total NEAR Intents volume, so each set of shares adds up to 100%. Both public and confidential swaps count.";

const chainName = (chain: string) => INTENTS_CHAIN_NAMES[chain.toLowerCase()] ?? chain.toUpperCase();

/** Each chain's share of NEAR Intents volume over the 30 days to the newest stored day; the smaller chains are summed. */
export async function IntentsChainMixPanel() {
  await io();
  const mix = await getChainVolumes(30);
  const total = mix?.chains.reduce((sum, c) => sum + c.volumeUsd, 0) ?? 0;
  if (!mix || total <= 0) return <NoData title={CHAIN_TITLE} />;
  const named = mix.chains.slice(0, INTENTS_CHAIN_ROWS);
  const other = mix.chains.slice(INTENTS_CHAIN_ROWS).reduce((sum, c) => sum + c.volumeUsd, 0);
  const rows = [...named.map((c) => ({ label: chainName(c.chain), share: c.volumeUsd / total })), ...(other > 0 ? [{ label: "Other chains", share: other / total }] : [])];
  const lead = named
    .slice(0, 3)
    .map((c) => `${chainName(c.chain)} ${formatPercent(c.volumeUsd / total, 1)}`)
    .join(", ");

  return (
    <Panel
      title={CHAIN_TITLE}
      description={`${formatUsd(total)} of NEAR Intents volume in the 30 days to ${mix.through}, counted under ${formatCount(mix.chains.length, "chain")}: ${lead}.`}
      sources={["dune"]}
      through={`Data through ${mix.through}`}
      sqlId="intents-chain-mix"
      viewLabel="Table"
    >
      <BarList rows={rows.map((r) => ({ label: r.label, value: r.share, display: formatPercent(r.share, 1) }))} caption={`Share of NEAR Intents volume by chain, 30 days to ${mix.through}`} />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">{COUNTING_NOTE}</p>
    </Panel>
  );
}

/** Stablecoins' share of NEAR Intents volume in consecutive 7-day blocks, and over the last 30 days. */
export async function IntentsStablecoinPanel() {
  await io();
  const { total, stablecoin } = await getIntentsVolumeMix();
  const first = total[0];
  const last = total.at(-1);
  if (!first || !last || total.length < 14) return <NoData title={STABLECOIN_TITLE} />;
  const totals = rollingWindows(total, 7, WEEKS);
  const stable = rollingWindows(stablecoin, 7, WEEKS);
  /** Only blocks whose seven days all fall inside the stored history. */
  const weekly = totals.flatMap((w, i) => {
    const share = ratio(stable[i]!.value, w.value);
    return w.end - 6 * DAY_SECONDS >= first.time && share !== null ? [{ time: w.end, value: share }] : [];
  });
  const share30d = ratio(sumWindow(stablecoin, 30), sumWindow(total, 30));
  if (weekly.length < 2) return <NoData title={STABLECOIN_TITLE} />;

  return (
    <Panel
      title={STABLECOIN_TITLE}
      description={share30d === null ? undefined : `Swaps counted under a stablecoin made up ${formatPercent(share30d, 1)} of NEAR Intents volume over the 30 days to ${isoDay(last.time)}.`}
      sources={["dune"]}
      through={`Data through ${isoDay(last.time)}`}
      sqlId="intents-stablecoin-share"
    >
      <LineChart series={[{ name: "Stablecoin share", points: weekly }]} format="percent" title="Stablecoin share of NEAR Intents volume, 7-day blocks, last 12 months" zeroBaseline />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">{COUNTING_NOTE}</p>
    </Panel>
  );
}

/** Loading placeholder of IntentsChainMixPanel. */
export function IntentsChainMixPanelSkeleton() {
  return (
    <PanelSkeleton title={CHAIN_TITLE.length} text={127} tabs="Table">
      <BarListSkeleton rows={INTENTS_CHAIN_ROWS + 1} />
      <NoteSkeleton chars={COUNTING_NOTE.length} />
    </PanelSkeleton>
  );
}

/** Loading placeholder of IntentsStablecoinPanel. */
export function IntentsStablecoinPanelSkeleton() {
  return (
    <PanelSkeleton title={STABLECOIN_TITLE.length} text={101} tabs="Chart">
      <LineChartSkeleton />
      <NoteSkeleton chars={COUNTING_NOTE.length} />
    </PanelSkeleton>
  );
}
