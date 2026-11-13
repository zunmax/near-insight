/** Independent measurements of the same quantity compared side by side. */
import { PUBLISHED_REVENUE_MULTIPLE } from "@/content/facts";
import { commonEnd, coversWindow, dataCheck, dayTime, isoDay, sumWindow, type DailyPoint } from "@/lib/metrics";
import type { FlowContext } from "./flow-context";
import type { ThesisInputs } from "./inputs";
import type { FeeWalletWindow } from "./revenue";
import type { TreasuryWindow } from "./supply";
import type { ThesisMetrics } from "./types";

/** Every data check; `networkRevenue` is NEAR Intents revenue plus gas fees per day. */
export function dataChecksMetrics(
  { txnFees, burnt, txns, epochs, supply, marketCapHistory }: ThesisInputs,
  { end, covered, sum, feesNear, boughtNear }: FlowContext,
  wallets: FeeWalletWindow,
  treasury: TreasuryWindow | null,
  networkRevenue: DailyPoint[],
): ThesisMetrics["dataChecks"] {
  const feesCheckEnd = txnFees.length > 0 && feesNear.length > 0 ? commonEnd(txnFees, feesNear) : null;
  const lastNearblocksDay = txns.at(-1) ? isoDay(txns.at(-1)!.time) : null;
  const checkIndex = lastNearblocksDay ? epochs.findLastIndex((e) => e.endTime.slice(0, 10) <= lastNearblocksDay) : -1;
  const checkEpoch = epochs[checkIndex];
  const checkSupplyDay = checkEpoch ? checkEpoch.endTime.slice(0, 10) : null;
  /** The day's latest header reading: the next epoch's first block when that epoch starts the same day, so both readings
      are taken near the day's end and the epoch's mint between them is not read as a difference. */
  const nextEpoch = epochs[checkIndex + 1];
  const headerSupply = checkEpoch ? (nextEpoch?.startTime.slice(0, 10) === checkSupplyDay ? nextEpoch.supplyStartNear : checkEpoch.supplyEndNear) : null;
  const nearblocksSupply = checkSupplyDay === null ? undefined : supply.find((point) => point.time === dayTime(checkSupplyDay));

  const published = PUBLISHED_REVENUE_MULTIPLE;
  const publishedCap = marketCapHistory.find((point) => point.time === dayTime(published.marketCapDay));
  const publishedRevenueEnd = dayTime(published.revenueThrough);
  const publishedCheck =
    publishedCap && coversWindow(networkRevenue, published.revenueDays, 0, publishedRevenueEnd)
      ? dataCheck(
          publishedCap.value / ((sumWindow(networkRevenue, published.revenueDays, 0, publishedRevenueEnd) * 365) / published.revenueDays),
          published.multiple,
          published.revenueDays,
          publishedRevenueEnd,
        )
      : null;

  return {
    txnFees:
      feesCheckEnd !== null && coversWindow(txnFees, 30, 0, feesCheckEnd) && coversWindow(feesNear, 30, 0, feesCheckEnd)
        ? dataCheck(sumWindow(txnFees, 30, 0, feesCheckEnd), sumWindow(feesNear, 30, 0, feesCheckEnd), 30, feesCheckEnd)
        : null,
    burnShare: covered(burnt, 30) && covered(feesNear, 30) ? dataCheck(sum(burnt, 30), sum(feesNear, 30), 30, end) : null,
    totalSupply: headerSupply !== null && nearblocksSupply ? dataCheck(headerSupply, nearblocksSupply.value, null, nearblocksSupply.time) : null,
    boughtVsWallets:
      wallets.checkEnd !== null && wallets.checkDays >= 1
        ? dataCheck(sumWindow(boughtNear, wallets.checkDays, 0, wallets.checkEnd), wallets.gain(wallets.checkEnd, wallets.checkDays), wallets.checkDays, wallets.checkEnd)
        : null,
    revenueMultiple: publishedCheck,
    treasuryShare: treasury ? dataCheck(treasury.gain, treasury.expected, 30, treasury.end) : null,
  };
}
