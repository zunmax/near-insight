import { io } from "next/cache";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { FULL_BURN_PROTOCOL, PROTOCOL_TREASURY_SHARE } from "@/config/protocol";
import { PROTOCOL_TREASURY_ACCOUNT } from "@/config/sources";
import { PUBLISHED_REVENUE_MULTIPLE } from "@/content/facts";
import { getThesisMetrics, type ThesisMetrics } from "@/data/thesis-metrics";
import { formatChange, formatInteger, formatMultiple, formatNear, formatPercent, formatPercentFromFull } from "@/lib/format";
import type { DataCheck } from "@/lib/metrics";

const TITLE = "Data checks";

const near = (value: number) => formatNear(value, 2);

/** Difference with enough decimals to show a small gap, e.g. −0.002%. */
const difference = (share: number) => formatChange(share, Math.abs(share) < 0.001 ? 3 : Math.abs(share) < 0.01 ? 2 : 1);

const windowLabel = (days: number | null) => (days === null ? "One reading" : days === 1 ? "1 day" : `${days} days`);

/** What A and B measure in each check, and how their values are written. */
const CHECKS: Array<{
  key: keyof ThesisMetrics["dataChecks"];
  title: string;
  detail: (check: DataCheck | null) => string;
  a: string;
  b: string;
  format: (value: number) => string;
}> = [
  {
    key: "txnFees",
    title: "Gas fees paid on NEAR",
    detail: () => "Two counts of the same fees.",
    a: "Daily fee totals of the block explorer",
    b: "Daily fees of the fee tracker, in NEAR at each day's price",
    format: near,
  },
  {
    key: "burnShare",
    title: "Share of gas fees burned",
    detail: (check) =>
      check?.difference == null
        ? "A ÷ B is the measured share of fees burned."
        : `A ÷ B is the measured share of fees burned: ${formatPercentFromFull(1 + check.difference, 1)}.${
            check.difference < 0
              ? ` It can be below 100% for two reasons: the window includes days before mainnet ran protocol ${FULL_BURN_PROTOCOL}, or the fee tracker's fee count differs from the burn read from block headers.`
              : ""
          }`,
    a: "NEAR burned, measured from block headers",
    b: "Gas fees of the fee tracker, in NEAR at each day's price",
    format: near,
  },
  {
    key: "totalSupply",
    title: "Total NEAR supply",
    detail: () => "Two readings of the same supply on one day.",
    a: "Latest epoch-boundary block header that day",
    b: "Daily total supply of the block explorer",
    format: (value) => `${formatInteger(value)} NEAR`,
  },
  {
    key: "boughtVsWallets",
    title: "NEAR bought with NEAR Intents fees",
    detail: () => "NEAR counted as bought against what the three fee wallets gained.",
    a: "NEAR bought as the fee tracker counts it, at each day's price",
    b: "Net change of the three fee wallets' balances on chain",
    format: near,
  },
  {
    key: "revenueMultiple",
    title: "NEAR market cap ÷ network revenue",
    detail: () => "This dashboard's multiple on the dates of a published one; the difference comes from the revenue each one counts.",
    a: `Market cap on ${PUBLISHED_REVENUE_MULTIPLE.marketCapDay} ÷ Intents revenue plus gas fees over the ${PUBLISHED_REVENUE_MULTIPLE.revenueDays} days to ${PUBLISHED_REVENUE_MULTIPLE.revenueThrough}, annualized`,
    b: PUBLISHED_REVENUE_MULTIPLE.source,
    format: (value) => formatMultiple(value),
  },
  {
    key: "treasuryShare",
    title: "NEAR paid to the protocol treasury",
    detail: () => `The treasury's gain against its ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} share of the NEAR minted; a gap is NEAR the treasury sent to, or received from, other accounts.`,
    a: `Gain of ${PROTOCOL_TREASURY_ACCOUNT}'s balance on chain`,
    b: `${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} of the NEAR minted, measured from block headers`,
    format: near,
  },
];

/** Independent measurements of the same quantity side by side, with their difference, window and last day. */
export async function DataChecksPanel() {
  await io();
  const { dataChecks } = await getThesisMetrics();
  if (CHECKS.every(({ key }) => dataChecks[key] === null)) return <NoData title={TITLE} />;

  return (
    <Panel
      title={TITLE}
      sources={["nearblocks", "defillama", "nearArchive", "nearRpc", "coingecko", { cite: "Blockworks Research" }]}
    >
      <TableScroll label="Data checks">
        <table className="data-table data-table-stack sm:min-w-[560px]">
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">A</th>
              <th scope="col">B</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {CHECKS.map(({ key, title, detail, a, b, format }) => {
              const check = dataChecks[key];
              return (
                <tr key={key} className="align-top">
                  <th scope="row" className="text-left font-normal">
                    <span className="block font-medium text-ink">{title}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{detail(check)}</span>
                  </th>
                  <td data-label="A">
                    <div className="max-sm:text-right">
                      <span className="block text-ink tabular-nums">{check ? format(check.a) : "—"}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">
                        <NoBreakTokens text={a} />
                      </span>
                    </div>
                  </td>
                  <td data-label="B">
                    <div className="max-sm:text-right">
                      <span className="block text-ink tabular-nums">{check ? format(check.b) : "—"}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">{b}</span>
                    </div>
                  </td>
                  <td data-label="Difference">
                    <div className="max-sm:text-right">
                      <span className="block font-medium text-ink tabular-nums">{check?.difference == null ? "—" : difference(check.difference)}</span>
                      {check ? (
                        <span className="mt-0.5 block text-[11.5px] text-muted">
                          <NoBreakTokens text={`${windowLabel(check.days)}, as of ${check.through} (UTC)`} />
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
    </Panel>
  );
}

/** Lengths of each check's title and note, A and B with their sources, and the difference with its window, in CHECKS order. */
const SKELETON_ROWS: Array<Array<[number, number]>> = [
  [[21, 28], [11, 38], [11, 58], [6, 31]],
  [[24, 223], [11, 40], [11, 56], [6, 31]],
  [[17, 43], [18, 43], [18, 40], [6, 35]],
  [[34, 65], [12, 61], [12, 54], [6, 31]],
  [[33, 113], [4, 99], [4, 85], [5, 31]],
  [[34, 131], [12, 40], [12, 51], [6, 31]],
];

/** Loading placeholder of DataChecksPanel: a row for each check, every cell a value over a note. */
export function DataChecksPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length}>
      <TableSkeleton
        headers={["Check", "A", "B", "Difference"].map((name) => name.length)}
        rows={SKELETON_ROWS.map((cells) => cells.map(([chars, detail]) => ({ chars, detail })))}
        columns={[27, 11, 11, 6]}
        stack
        className="sm:min-w-[560px]"
      />
    </PanelSkeleton>
  );
}
