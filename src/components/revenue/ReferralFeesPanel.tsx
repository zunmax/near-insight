import { io } from "next/cache";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { REFERRAL_ROWS } from "@/config/intents";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatBps, formatCount, formatPercent, formatUsd } from "@/lib/format";
import { ratio } from "@/lib/metrics";
import { largestReferral, referralLabel, referralSwaps } from "@/lib/referrals";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "Who pays NEAR Intents fees";

/** What a referral and an app fee are, under the table. */
const NOTE =
  "A referral is the front end, wallet or app a 1Click swap came through. An app fee is the fee the front end sets on each swap, in basis points of the dollars swapped in. The data does not show how it splits between the front end and NEAR Intents.";

/** Completed 1Click swaps over 30 days by referral: each one's app fees, its shares of all their fees and volume, and its fee rate. */
export async function ReferralFeesPanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { referrals } = metrics;
  const top = largestReferral(referrals);
  if (!referrals || !top) return <NoData title={TITLE} />;
  const windowLabel = windowName(metrics, "30 days", referrals.through);

  const named = referrals.byReferral.slice(0, REFERRAL_ROWS);
  const rest = referrals.byReferral.slice(REFERRAL_ROWS);
  const other = rest.reduce((sum, x) => ({ volumeUsd: sum.volumeUsd + x.volumeUsd, feesUsd: sum.feesUsd + x.feesUsd }), { volumeUsd: 0, feesUsd: 0 });
  const rows = [
    ...named.map((x) => ({ label: referralLabel(x.referral), volumeUsd: x.volumeUsd, feesUsd: x.feesUsd })),
    ...(rest.length > 0 ? [{ label: formatCount(rest.length, "other referral"), ...other }] : []),
  ];
  const share = (part: number, whole: number) => {
    const value = ratio(part, whole);
    return value === null ? "—" : formatPercent(value, 1);
  };

  return (
    <Panel
      title={`${TITLE}, ${windowLabel}`}
      description={`Completed 1Click swaps paid ${formatUsd(referrals.feesUsd)} in app fees on ${formatUsd(referrals.volumeUsd)} swapped over the ${windowLabel}. ${referralSwaps(top.referral)} paid ${formatPercent(top.feeShare, 1)} of the fees, from ${formatPercent(top.volumeShare, 1)} of the volume.`}
      sources={["intentsExplorer"]}
      through={`Data through ${referrals.through}`}
      sqlId="referral-fees-30d"
      viewLabel="Table"
    >
      <TableScroll label="App fees of 1Click swaps by referral">
        <table className="data-table data-table-stack sm:min-w-[480px]">
          <caption className="sr-only">App fees of completed 1Click swaps by referral over the {windowLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Referral</th>
              <th scope="col" className="text-right">App fees</th>
              <th scope="col" className="text-right">Of fees</th>
              <th scope="col" className="text-right">Of volume</th>
              <th scope="col" className="text-right">Fee rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rate = ratio(row.feesUsd, row.volumeUsd);
              return (
                <tr key={row.label}>
                  <th scope="row" className="text-left font-medium text-ink-2">
                    {row.label}
                  </th>
                  <td data-label="App fees" className="text-right text-ink-2 tabular-nums">{formatUsd(row.feesUsd)}</td>
                  <td data-label="Of fees" className="text-right text-ink-2 tabular-nums">{share(row.feesUsd, referrals.feesUsd)}</td>
                  <td data-label="Of volume" className="text-right text-ink-2 tabular-nums">{share(row.volumeUsd, referrals.volumeUsd)}</td>
                  <td data-label="Fee rate" className="text-right text-ink-2 tabular-nums">{rate === null ? "—" : formatBps(rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">{NOTE}</p>
    </Panel>
  );
}

/** Loading placeholder of ReferralFeesPanel. */
export function ReferralFeesPanelSkeleton() {
  return (
    <PanelSkeleton title={`${TITLE}, 30 days to YYYY-MM-DD`.length} text={190} tabs="Table">
      <TableSkeleton
        headers={["Referral", "App fees", "Of fees", "Of volume", "Fee rate"].map((name) => name.length)}
        rows={Array.from({ length: REFERRAL_ROWS + 1 }, () => [12, 7, 5, 5, 7])}
        columns={[12, 7, 5, 5, 7]}
        stack
        className="sm:min-w-[480px]"
      />
      <NoteSkeleton chars={NOTE.length} />
    </PanelSkeleton>
  );
}
