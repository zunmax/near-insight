/** Total supply, measured issuance, how much of it burn and buybacks absorb, and the protocol treasury's share. */
import { BUYBACKS_START_DAY, PROTOCOL_TREASURY_SHARE } from "@/config/protocol";
import {
  absorption,
  annualized,
  commonEnd,
  coversWindow,
  DAY_SECONDS,
  daysThrough,
  isoDay,
  levelChange,
  monthlyTable,
  sumWindow,
  valueAt,
  YEAR_SECONDS,
} from "@/lib/metrics";
import type { FlowContext } from "./flow-context";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

/** treasury.near's gain over the 30 days ending `end`, and `expected`: PROTOCOL_TREASURY_SHARE of the NEAR minted in those days. */
export type TreasuryWindow = { end: number; gain: number; expected: number };

export function supplyMetrics({ network, supply }: ThesisInputs): ThesisMetrics["supply"] {
  return network
    ? {
        totalSupplyNear: network.totalSupplyNear,
        maxInflationRate: network.maxInflationRate,
        growth1y: levelChange(supply, 365),
        growthThrough: supply.length > 0 ? isoDay(supply.at(-1)!.time) : null,
        burnShareOfFees: 1 - network.burntGasShareToContracts,
      }
    : null;
}

export function issuanceMetrics({ minted, supply }: Pick<ThesisInputs, "minted" | "supply">, { through, end, covered, sum }: FlowContext): ThesisMetrics["issuance"] {
  return through !== null
    ? {
        measuredFrom: minted[0] ? isoDay(minted[0].time) : null,
        minted30dNear: covered(minted, 30) ? sum(minted, 30) : null,
        rate30d: covered(minted, 30) ? annualized(sum(minted, 30), 30, valueAt(supply, end - 30 * DAY_SECONDS)) : null,
        minted1yNear: covered(minted, 365) ? sum(minted, 365) : null,
        rate1y: covered(minted, 365) ? annualized(sum(minted, 365), 365, valueAt(supply, end - YEAR_SECONDS)) : null,
      }
    : null;
}

export function absorptionMetrics({ minted, burnt }: Pick<ThesisInputs, "minted" | "burnt">, { through, end, monthlyEnd, sum, boughtNear, measured }: FlowContext): ThesisMetrics["absorption"] {
  if (through === null) return null;
  const absorbed = (days: number) => (measured(days) ? absorption(days, sum(minted, days), sum(burnt, days), sum(boughtNear, days)) : null);
  const buybackDays = daysThrough(BUYBACKS_START_DAY, end);
  const monthsEnd = monthlyEnd(minted, burnt);
  return {
    d30: absorbed(30),
    d90: absorbed(90),
    d90Prior: measured(180) ? absorption(90, sumWindow(minted, 90, 90, end), sumWindow(burnt, 90, 90, end), sumWindow(boughtNear, 90, 90, end)) : null,
    sinceBuybacks: buybackDays > 0 ? absorbed(buybackDays) : null,
    d365: absorbed(365),
    monthly: monthlyTable({ minted, burnt, bought: boughtNear }, monthsEnd).flatMap(({ month, days, sums }) => {
      const row = absorption(days, sums.minted, sums.burnt, sums.bought);
      return row ? [{ month, ...row }] : [];
    }),
    monthlyThrough: isoDay(monthsEnd),
  };
}

/** Null until treasury.near and minted NEAR both cover 30 days. */
export function treasuryWindow({ treasuryBalance, minted }: ThesisInputs, { through, completeEnd }: FlowContext): TreasuryWindow | null {
  /** Ends on the data-through day, or earlier on the last stored balance day before it (today's live RPC reading never
      bridges a stalled history), minted NEAR's last day, or before a day missing from minted NEAR. */
  const balanceEnd = through === null ? undefined : treasuryBalance.findLast((point) => point.time <= through)?.time;
  const last = balanceEnd !== undefined && minted.length > 0 ? Math.min(balanceEnd, commonEnd(minted)) : null;
  const end = last === null ? null : (completeEnd([minted], last) ?? last);
  const covered = end !== null && coversWindow(minted, 30, 0, end) && (treasuryBalance[0]?.time ?? Infinity) <= end - 30 * DAY_SECONDS;
  if (!covered) return null;
  return {
    end,
    gain: valueAt(treasuryBalance, end) - valueAt(treasuryBalance, end - 30 * DAY_SECONDS),
    expected: sumWindow(minted, 30, 0, end) * PROTOCOL_TREASURY_SHARE,
  };
}

export function treasuryMetrics({ treasuryBalance }: ThesisInputs, window: TreasuryWindow | null): ThesisMetrics["treasury"] {
  return window
    ? {
        daily: treasuryBalance.filter((point) => point.time <= window.end),
        asOf: isoDay(window.end),
        balanceNear: valueAt(treasuryBalance, window.end),
        gain30dNear: window.gain,
        expected30dNear: window.expected,
        first: treasuryBalance[0]!,
      }
    : null;
}
