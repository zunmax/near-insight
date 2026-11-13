/** Thesis section 2: NEAR bought by NEAR Intents buybacks, the fee chain behind it and the three fee wallets' balances. */
import { boughtGrowth, DASH, DEFILLAMA, EPOCH_HEADERS, NEAR_DAILY_PRICE, NEARBLOCKS_V3, day, daysTo, factTable, show, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section } from "@/app/api/thesis/markdown/section";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { BUYBACK_ACCOUNT, FRONTEND_FEE_ACCOUNT, ONE_CLICK_FEE_ACCOUNT, SOURCES } from "@/config/sources";
import { INTENTS_FEES } from "@/content/facts";
import { digitsApart, formatBps, formatCompact, formatNear as near, formatPercent, formatPercentFromFull, formatUsd, percentRounded } from "@/lib/format";
import { daysInMonth, type DataCheck } from "@/lib/metrics";
import { measuredBurnNote } from "@/lib/projection";

/** "2026-02: 173K (from 2026-02-23), …, 2026-11: 12K (to 2026-11-01)": the first and last month marked when partly covered. */
function boughtByMonth(monthly: Array<{ month: string; value: number }>, through: string | null): string {
  if (monthly.length === 0) return DASH;
  return monthly
    .map(({ month, value }, i) => {
      const amount = formatCompact(value);
      if (i === 0 && BUYBACKS_START_DAY.startsWith(month) && !BUYBACKS_START_DAY.endsWith("-01")) return `${month}: ${amount} (from ${BUYBACKS_START_DAY})`;
      if (i === monthly.length - 1 && through?.startsWith(month) && Number(through.slice(8, 10)) < daysInMonth(month)) return `${month}: ${amount} (to ${through})`;
      return `${month}: ${amount}`;
    })
    .join(", ");
}

function boughtCheck(check: DataCheck | null): string {
  if (!check) return "The stored wallet history does not cover enough days to compare the two yet.";
  const days = check.days === 1 ? "day" : `${check.days} days`;
  const gap = check.difference;
  const digits = gap === null ? 1 : digitsApart(gap * 100, 0, 1);
  const comparison =
    gap === null
      ? ""
      : percentRounded(gap, digits) === 0
        ? "; DefiLlama's count matches it"
        : `; DefiLlama's count is ${formatPercent(Math.abs(gap), digits)} ${gap < 0 ? "below" : "above"} it`;
  return `Over the ${days} to ${check.through}, DefiLlama counts ${near(check.a)} as bought, and the three wallets' combined balance changed by ${near(check.b)} on chain${comparison}.`;
}

export function captureSection(input: ThesisDocumentInput): string {
  const { buybacks: b, feeChain: f, feeWallets: w, seed, dataChecks, dataThrough: t } = input.metrics;
  const chain = f?.d30;
  const feesThrough = f?.through ?? null;
  const balance = `balance on ${day(w?.asOf)}`;
  return section(
    2,
    "capture",
    input,
    [
      ["NEAR bought by NEAR Intents buybacks", b ? `${near(b.bought30dNear)} (${formatUsd(b.total30dUsd)})` : DASH, daysTo(30, t)],
      ["NEAR bought", show(b?.bought90dNear, (v) => near(v, 2)), daysTo(90, t)],
      ["NEAR bought, the 90 days before", show(b?.boughtPrior90dNear, (v) => near(v, 2)), `90 days ending 90 days before ${t ?? DASH}`],
      ["Monthly growth rate of NEAR bought", boughtGrowth(b), `${daysTo(90, t)}, against the 90 days before`],
      ["NEAR bought since buybacks began", show(b?.boughtNearTotal, near), `${BUYBACKS_START_DAY} to ${t ?? DASH}`],
      ["NEAR bought by month", b ? boughtByMonth(b.monthlyNear, t) : DASH, `${BUYBACKS_START_DAY} to ${t ?? DASH}`],
      [
        "NEAR Intents volume, gross fees, revenue and buybacks (USD)",
        chain
          ? `${formatUsd(chain.volumeUsd)} volume, ${formatUsd(chain.feesUsd)} gross fees, ${formatUsd(chain.revenueUsd)} revenue, ${formatUsd(chain.buybacksUsd)} buybacks`
          : DASH,
        daysTo(30, feesThrough),
      ],
      ["Gross fees ÷ volume (fee rate)", show(chain?.feeRate, formatBps), daysTo(30, feesThrough)],
      ["Buybacks ÷ volume (share of volume that buys NEAR)", show(b?.takeRate90d, formatBps), daysTo(90, t)],
      ["Buybacks ÷ volume (share of volume that buys NEAR), the 90 days before", show(b?.takeRatePrior90d, formatBps), `90 days ending 90 days before ${t ?? DASH}`],
      ["Buybacks ÷ gross fees (capture rate)", show(chain?.captureRate, (v) => formatPercent(v, 1)), daysTo(30, feesThrough)],
      ["Buybacks ÷ gross fees (capture rate)", show(f?.d90?.captureRate, (v) => formatPercent(v, 1)), daysTo(90, feesThrough)],
      ["Buybacks ÷ gross fees (capture rate)", show(f?.sinceBuybacks?.captureRate, (v) => formatPercent(v, 1)), feesThrough ? `${BUYBACKS_START_DAY} to ${feesThrough}` : DASH],
      [`NEAR burned ÷ gas fees in NEAR (measured burn share)${measuredBurnNote(seed)}`, show(seed?.measuredBurnShare, (v) => formatPercentFromFull(v, 1)), daysTo(30, t)],
      [`NEAR held in ${BUYBACK_ACCOUNT}`, show(w?.buybackNear, near), balance],
      [`NEAR held in ${FRONTEND_FEE_ACCOUNT} (NEAR Intents app)`, show(w?.frontendNear, near), balance],
      [`NEAR held in ${ONE_CLICK_FEE_ACCOUNT} (1Click API)`, show(w?.oneClickNear, near), balance],
      ["NEAR held in the three fee wallets", show(w?.totalNear, near), balance],
      ["Change of the three wallets' combined balance", show(w?.gain30dNear, near), daysTo(30, w?.gainThrough ?? null)],
      ["NEAR bought as DefiLlama counts it, same 30 days", show(w?.bought30dNear, near), daysTo(30, w?.gainThrough ?? null)],
      ["Largest daily gap: NEAR bought since the window began less the wallets' gain since then", show(w?.shortfall30dNear, near), daysTo(30, w?.gainThrough ?? null)],
    ],
    [
      `**How the buying works.** The ${INTENTS_FEES.contract.label} itself charges ${INTENTS_FEES.contract.value}. The money that buys NEAR comes from the fees of two apps on top of it, the ${INTENTS_FEES.app.label} and the ${INTENTS_FEES.oneClick.label}. Their fees reach three wallets: \`${FRONTEND_FEE_ACCOUNT}\`, \`${ONE_CLICK_FEE_ACCOUNT}\` and \`${BUYBACK_ACCOUNT}\`. The NEAR bought is held in these three wallets (each balance is in the table above), off the market. It is not burned, so it stays in total supply (CoinGecko's circulating supply still counts it).\n\n${factTable(Object.values(INTENTS_FEES))}`,
      `**DefiLlama's count against the wallets.** DefiLlama counts NEAR arriving at all three fee wallets as bought, so its total can exceed the buyback wallet's balance. ${boughtCheck(dataChecks.boughtVsWallets)}`,
    ],
    `Dune query ${SOURCES.dune.queries.fees} on the NEAR team's dashboard \`${SOURCES.dune.baseUrl}/${SOURCES.dune.dashboard.handle}/${SOURCES.dune.dashboard.slug}\` (gross fees, with volume from query ${SOURCES.dune.queries.volume}); DefiLlama \`GET ${DEFILLAMA}/summary/fees/near-intents?dataType=dailyFees&excludeTotalDataChartBreakdown=true\` (gross fees on days Dune does not have), the same with \`dataType=dailyRevenue\` (revenue) and \`dataType=dailyHoldersRevenue\` (buybacks), and \`GET ${DEFILLAMA}/summary/fees/near?excludeTotalDataChartBreakdown=true\` (gas fees); ${EPOCH_HEADERS} (NEAR burned, for the measured burn share); ${NEAR_DAILY_PRICE}; NEAR RPC \`view_account\` on each of the three fee wallets (today's balance) and NearBlocks \`GET ${NEARBLOCKS_V3}/accounts/<wallet>/stats/balance?limit=${SOURCES.nearblocks.maxDailyRows}\` (each past day's balance, behind the 30-day change and the NEAR bought over the same days).`,
  );
}
