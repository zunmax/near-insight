import { io } from "next/cache";
import { ColumnChart, ColumnChartSkeleton } from "@/components/charts/ColumnChart";
import { monthLabel } from "@/components/charts/chart-format";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { lastCompleteIndex, partialMonthIndexes, partialMonthsNote } from "@/components/charts/partial-months";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { DEFILLAMA_PUBLIC_ONLY } from "@/config/intents";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatPercent } from "@/lib/format";
import { YEAR_SECONDS } from "@/lib/metrics";
import { windowName } from "@/lib/thesis/window-name";

const TXN_SHARE_TITLE = "NEAR Intents share of NEAR transactions";
const DEX_SHARE_TITLE = "NEAR Intents share of DEX volume on NEAR";

/** Transactions of the NEAR Intents contract as a share of every NEAR transaction, per day over the last 12 months. */
export async function IntentsTxnSharePanel() {
  await io();
  const metrics = await getThesisMetrics();
  const share = metrics.intentsTxnShare;
  if (!share || share.daily.length < 2) return <NoData title={TXN_SHARE_TITLE} />;
  const last = share.daily.at(-1)!;

  return (
    <Panel
      title={TXN_SHARE_TITLE}
      description={
        share.avg30d === null
          ? undefined
          : `The NEAR Intents contract, intents.near, made up ${formatPercent(share.avg30d, 1)} of all NEAR transactions over the ${windowName(metrics, "30 days", share.through)}.`
      }
      sources={["nearblocks"]}
      through={`Data through ${share.through}`}
      sqlId="intents-txn-share"
    >
      <LineChart
        series={[{ name: "Share of transactions", points: share.daily.filter((point) => point.time > last.time - YEAR_SECONDS) }]}
        format="percent"
        title="Transactions of intents.near as a share of all NEAR transactions, daily, last 12 months"
        zeroBaseline
      />
    </Panel>
  );
}

/** NEAR Intents volume as a share of the volume of every DEX on NEAR, per calendar month. */
export async function DexSharePanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { dexShare } = metrics;
  const shown = dexShare?.monthly.filter((m) => m.share !== null) ?? [];
  const months = shown.map((m) => ({ label: monthLabel(m.month), value: m.share! }));
  if (!dexShare || months.length === 0) return <NoData title={DEX_SHARE_TITLE} />;
  const { d30, d180 } = dexShare;
  const partial = partialMonthsNote(shown);
  const showsPublicOnly = shown.some((m) => m.month >= DEFILLAMA_PUBLIC_ONLY.from.slice(0, 7) && m.month <= DEFILLAMA_PUBLIC_ONLY.through.slice(0, 7));
  /** The window shares read low too while their days reach into the public-only period. */
  const lowShares = dexShare.d30PublicOnly
    ? d180 === null
      ? " and the 30-day share"
      : " and both shares above"
    : dexShare.d180PublicOnly && d180 !== null
      ? " and the 180-day share"
      : "";
  const publicOnlyNote = showsPublicOnly ? ` From ${DEFILLAMA_PUBLIC_ONLY.label}, DefiLlama counted only public swaps, so those months${lowShares} read low.` : "";
  const description =
    d30 === null
      ? undefined
      : `NEAR Intents carried ${formatPercent(d30, 1)} of all DEX volume on NEAR over the ${windowName(metrics, "30 days")}${d180 === null ? "" : ` and ${formatPercent(d180, 1)} over the ${windowName(metrics, "180 days")}`}.${publicOnlyNote}`;

  return (
    <Panel
      title={DEX_SHARE_TITLE}
      description={description}
      sources={["defillama"]}
      through={`Data through ${dexShare.monthlyThrough}`}
      sqlId="intents-dex-share"
    >
      <ColumnChart points={months} format="percent" selected={lastCompleteIndex(shown)} partial={partialMonthIndexes(shown)} title="NEAR Intents volume as a share of all DEX volume on NEAR, by calendar month" />
      {partial ? <p className="mt-3 text-[12px] leading-relaxed text-muted">{partial}</p> : null}
    </Panel>
  );
}

/** Loading placeholder of IntentsTxnSharePanel. */
export function IntentsTxnSharePanelSkeleton() {
  return (
    <PanelSkeleton title={TXN_SHARE_TITLE.length} text={111} tabs="Chart">
      <LineChartSkeleton />
    </PanelSkeleton>
  );
}

/** Loading placeholder of DexSharePanel. */
export function DexSharePanelSkeleton() {
  return (
    <PanelSkeleton title={DEX_SHARE_TITLE.length} text={220} tabs="Chart">
      <ColumnChartSkeleton columns={24} />
      <NoteSkeleton chars={52} />
    </PanelSkeleton>
  );
}
