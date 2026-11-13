import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { PROTOCOL_TREASURY_SHARE } from "@/config/protocol";
import { PROTOCOL_TREASURY_ACCOUNT } from "@/config/sources";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatNear, formatPercent, formatPercentFromFull } from "@/lib/format";
import { ratio, YEAR_SECONDS } from "@/lib/metrics";

const TITLE = "NEAR in the protocol treasury";

const near = (value: number) => formatNear(value, 2);

/** The protocol treasury's NEAR each day, and its last 30 days' gain against the treasury share of the NEAR minted. */
export async function TreasuryPanel() {
  await io();
  const { treasury } = await getThesisMetrics();
  if (!treasury || treasury.daily.length < 2) return <NoData title={TITLE} />;
  const { daily, asOf, balanceNear, gain30dNear, expected30dNear } = treasury;
  const last = daily.at(-1)!;
  const share = ratio(gain30dNear, expected30dNear);

  return (
    <Panel
      title={TITLE}
      description={`${PROTOCOL_TREASURY_ACCOUNT} held ${near(balanceNear)} on ${asOf}. Over the 30 days before, it ${gain30dNear >= 0 ? `gained ${near(gain30dNear)}${share === null ? ", against" : `, ${formatPercentFromFull(share, 0)} of`}` : `lost ${near(-gain30dNear)}, against`} the ${near(expected30dNear)} the protocol paid it (${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} of the NEAR minted).`}
      sources={["nearblocks", "nearRpc", "nearArchive"]}
      through={`Data through ${asOf}`}
      sqlId="protocol-treasury"
    >
      <LineChart
        series={[{ name: "Treasury NEAR", points: daily.filter((point) => point.time > last.time - YEAR_SECONDS) }]}
        format="near"
        title={`NEAR held by ${PROTOCOL_TREASURY_ACCOUNT}, daily, last 12 months`}
      />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        The protocol pays the treasury its share of the NEAR minted each epoch; the rest goes to validators and stakers. The treasury is a multisig: a gain below its share,
        or a drop, means it sent NEAR to other accounts. That NEAR is not burned, so it stays in total supply.
      </p>
    </Panel>
  );
}

/** Loading placeholder of TreasuryPanel. */
export function TreasuryPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={165} tabs="Chart">
      <LineChartSkeleton />
      <NoteSkeleton chars={267} />
    </PanelSkeleton>
  );
}
