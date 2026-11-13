import { io } from "next/cache";
import { BarList, BarListSkeleton } from "@/components/charts/BarList";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getFeeChannels } from "@/data/intents-flows";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";

const TITLE = "NEAR Intents fees by channel";

/** Channels shown by name; the rest are summed. */
const CHANNEL_ROWS = 8;

/** A channel as Dune names it: a referral account shows its name; a channel known only by an id shows as unnamed, with the id's
    first 8 characters, so two such channels stay apart. */
const channelLabel = (channel: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channel)
    ? `Unnamed partner ${channel.slice(0, 8)}`
    : channel.replace(/\.intents-referral\.near$/, " (referral)");

/** Each channel's share, since launch, of the fees of all channels Dune lists (the 100 largest; swaps without a referral are left out). */
export async function FeeChannelsPanel() {
  await io();
  const fees = await getFeeChannels();
  const total = fees?.channels.reduce((sum, c) => sum + c.feesUsd, 0) ?? 0;
  if (!fees || total <= 0) return <NoData title={TITLE} />;
  const named = fees.channels.slice(0, CHANNEL_ROWS);
  const other = fees.channels.slice(CHANNEL_ROWS).reduce((sum, c) => sum + c.feesUsd, 0);
  const rows = [
    ...named.map((c) => ({ label: channelLabel(c.channel), share: c.feesUsd / total })),
    ...(other > 0 ? [{ label: formatCount(fees.channels.length - CHANNEL_ROWS, "other channel"), share: other / total }] : []),
  ];
  const top = named[0]!;

  return (
    <Panel
      title={TITLE}
      description={`The ${formatCount(fees.channels.length, "largest channel")} generated ${formatUsd(total)} in NEAR Intents fees from launch through ${fees.asOf}. The largest, ${channelLabel(top.channel)}, brought ${formatPercent(top.feesUsd / total, 1)} of it.`}
      sources={["dune"]}
      through={`Data through ${fees.asOf}`}
      sqlId="fee-channels"
      viewLabel="Table"
    >
      <BarList rows={rows.map((r) => ({ label: r.label, value: r.share, display: formatPercent(r.share, 1) }))} caption={`Share of NEAR Intents fees since launch by channel, through ${fees.asOf}`} />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        A channel is the referral a swap carries, usually the front end, wallet or app it came through. Only the 100 largest channels are listed, and swaps without a referral are left out.
      </p>
    </Panel>
  );
}

/** Loading placeholder of FeeChannelsPanel. */
export function FeeChannelsPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={138} tabs="Table">
      <BarListSkeleton rows={CHANNEL_ROWS + 1} />
      <NoteSkeleton chars={180} />
    </PanelSkeleton>
  );
}
