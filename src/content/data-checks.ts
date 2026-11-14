/** Each data check of the methodology: what A and B measure, how their values are written, and the difference between them. */
import { FULL_BURN_PROTOCOL, PROTOCOL_TREASURY_SHARE } from "@/config/protocol";
import { PROTOCOL_TREASURY_ACCOUNT } from "@/config/sources";
import { PUBLISHED_REVENUE_MULTIPLE } from "@/content/facts";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import { formatChange, formatInteger, formatMultiple, formatNear, formatPercent, formatPercentFromFull, formatUsd } from "@/lib/format";
import type { DataCheck } from "@/lib/metrics";

const near = (value: number) => formatNear(value, 2);

/** Difference with enough decimals to show a small gap, e.g. −0.002%. */
export const checkDifference = (share: number) => formatChange(share, Math.abs(share) < 0.001 ? 3 : Math.abs(share) < 0.01 ? 2 : 1);

export const checkWindow = (days: number | null) => (days === null ? "One reading" : days === 1 ? "1 day" : `${days} days`);

/** What A and B measure in each check, and how their values are written. */
export const DATA_CHECKS: Array<{
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
    a: "NearBlocks daily fee totals",
    b: "DefiLlama daily fees, in NEAR at each day's price",
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
              ? ` A share below 100% has two possible causes: the window includes days before mainnet ran protocol ${FULL_BURN_PROTOCOL}, or DefiLlama's fee count differs from the burn in block headers.`
              : ""
          }`,
    a: "NEAR burned, measured from block headers",
    b: "DefiLlama gas fees, in NEAR at each day's price",
    format: near,
  },
  {
    key: "totalSupply",
    title: "Total NEAR supply",
    detail: () => "Two readings of the same supply on one day.",
    a: "Latest epoch-boundary block header that day",
    b: "NearBlocks daily total supply",
    format: (value) => `${formatInteger(value)} NEAR`,
  },
  {
    key: "boughtVsWallets",
    title: "NEAR bought with NEAR Intents fees",
    detail: () => "NEAR counted as bought against what the three fee wallets gained.",
    a: "NEAR bought as DefiLlama counts it, at each day's price",
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
  {
    key: "referralFees",
    title: "Fees of NEAR Intents 1Click swaps",
    detail: () => "1Click swaps' app fees against all NEAR Intents fees. The gap is fees the explorer does not list as app fees: the protocol fee and fees of swaps made outside the 1Click API.",
    a: "App fees of completed 1Click swaps, from the NEAR Intents explorer",
    b: "NEAR Intents gross fees, the protocol fee plus every front end's fee, from the NEAR team's Dune dashboard",
    format: (value) => formatUsd(value),
  },
];
