import { io } from "next/cache";
import { ColumnChart, ColumnChartSkeleton } from "@/components/charts/ColumnChart";
import { monthLabel } from "@/components/charts/chart-format";
import { lastCompleteIndex, partialMonthIndexes, partialMonthsNote } from "@/components/charts/partial-months";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { FULL_BURN_PROTOCOL } from "@/config/protocol";
import { getSeries } from "@/data/series";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { SERIES } from "@/db/schema";
import { formatPercentFromFull } from "@/lib/format";
import { dayTime, isoDay, monthlySums, ratio } from "@/lib/metrics";

const TITLE = "NEAR burned by month";

/** Months shown, ending with the month of the newest burn day on or before the data-through day. */
const MONTHS = 12;

/** NEAR burned each month, measured from block headers, and the share of gas fees it equals. */
export async function FeeBurnPanel() {
  await io();
  const [burntDaily, { dataChecks, protocol, seed, dataThrough }] = await Promise.all([getSeries(SERIES.burntNear), getThesisMetrics()]);
  const throughTime = dataThrough === null ? Infinity : dayTime(dataThrough);
  const burnt = burntDaily.filter((point) => point.time <= throughTime);
  const last = burnt.at(-1);
  if (!last) return <NoData title={TITLE} />;

  const start = new Date(last.time * 1000);
  start.setUTCMonth(start.getUTCMonth() - (MONTHS - 1), 1);
  start.setUTCHours(0, 0, 0, 0);
  const months = monthlySums(burnt, start.getTime() / 1000);
  const points = months.map((m) => ({ label: monthLabel(m.month), value: m.value }));
  const partial = partialMonthsNote(months);

  const check = dataChecks.burnShare;
  const share = check ? ratio(check.a, check.b) : null;
  const measured =
    check && check.days !== null && share !== null
      ? `The NEAR burned, measured from block headers, equals ${formatPercentFromFull(share, 0)} of gas fees over the ${check.days} days to ${check.through}.`
      : undefined;
  /** Without both protocol readings, the burn share the projections use (1 once no gas is paid to contracts) decides; without
      that either, the rule mainnet runs is unknown and goes unstated. */
  const fullBurnLive = protocol ? protocol.mainnet >= FULL_BURN_PROTOCOL : seed ? seed.burnShareOfFees === 1 : null;

  return (
    <Panel
      title={TITLE}
      description={measured}
      sources={["nearArchive", "defillama", "coingecko"]}
      through={`Data through ${isoDay(last.time)}`}
      sqlId="burn-by-month"
    >
      <ColumnChart points={points} format="near" selected={lastCompleteIndex(months)} partial={partialMonthIndexes(months)} title="NEAR burned each month, measured from block headers" />
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        {partial ? `${partial} ` : ""}
        {fullBurnLive === null
          ? null
          : fullBurnLive
            ? `Since protocol ${FULL_BURN_PROTOCOL}, contracts no longer receive part of the gas they use, so all gas fees are burned.${
                share !== null && share < 1
                  ? ` The measured share can be below 100% for two reasons: the window includes days before mainnet ran protocol ${FULL_BURN_PROTOCOL}, or the reported gas fees differ from the burn read from block headers.`
                  : ""
              }`
            : `Today, part of the gas a contract call uses is paid to the contract instead of being burned. Protocol ${FULL_BURN_PROTOCOL} removes that payment, so all gas fees are burned once mainnet runs it.`}
      </p>
    </Panel>
  );
}

/** Loading placeholder of FeeBurnPanel. */
export function FeeBurnPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={100} tabs="Chart">
      <ColumnChartSkeleton columns={12} />
      <NoteSkeleton chars={322} />
    </PanelSkeleton>
  );
}
