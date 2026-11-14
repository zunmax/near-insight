import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import { FULL_BURN_PROTOCOL, HSP029, MAX_ISSUANCE_HALVED_DAY, PREVIOUS_MAX_INFLATION } from "@/config/protocol";
import { PROTOCOL_TREASURY_ACCOUNT } from "@/config/sources";
import { FINDING_LEVELS, TRIGGERS } from "@/config/thesis-triggers";
import type { SectionId } from "@/content/thesis";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import {
  compareWord,
  digitsApart,
  formatCompact,
  formatCount,
  formatDateTimeUtc,
  formatGrowth,
  formatMonths,
  formatMoveFromZero,
  formatMultiple,
  formatNear,
  formatPercent,
  formatPercentFromFull,
  formatUsd,
  percentRounded,
  upperFirst,
} from "@/lib/format";
import { isoDay } from "@/lib/metrics";
import { largestReferral, referralSwaps } from "@/lib/referrals";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { proposalFailed, proposalStatusLabel } from "@/lib/thesis/proposal-status";
import { alreadyAbsorbed, boughtAmount, boughtPace, growthCheck, growthDigits, growthNeededName, measuredGrowth, noGrowthMatches, peerDigits, transferCost } from "@/lib/thesis/triggers";
import { windowName } from "@/lib/thesis/window-name";

/** What the latest data shows, written from the live numbers: sentences that back the section's claim and sentences that cut against it. */
type Finding = { for: string[]; against: string[] };

/** One sentence and whether its numbers back the claim; sentences whose numbers are missing are left out (null). */
type Statement = { text: string; supports: boolean } | null;

/** Sorts a section's statements into the evidence for and against, by what their numbers show. */
const sort = (...statements: Statement[]): Finding => {
  const present = statements.filter((s): s is NonNullable<Statement> => s !== null);
  return { for: present.filter((s) => s.supports).map((s) => s.text), against: present.filter((s) => !s.supports).map((s) => s.text) };
};

/** " The average swap (volume ÷ swaps) was $2.02K, up 117% from $930.00 in the same 30 days a year earlier.", or "" without swaps. */
export function averageSwap({ avgSwapUsd30d: now, avgSwapUsdYearAgo30d: before }: NonNullable<ThesisMetrics["intents"]>): string {
  if (now === null) return "";
  const yearEarlier = before === null || before <= 0 ? "" : `, ${formatMoveFromZero(now / before - 1)} from ${formatUsd(before)} in the same 30 days a year earlier`;
  return ` The average swap (volume ÷ swaps) was ${formatUsd(now)}${yearEarlier}.`;
}

/** Each section's statements. Every number, every direction word and the side each sentence lands on come from the metrics,
    so the text follows the data: Intents volume that falls year on year moves to the evidence against, for example.
    Windows are named by `windowName`, so they read "the last 30 days" only while the data is current. */
export const SECTION_FINDINGS: Record<SectionId, (m: ThesisMetrics) => Finding> = {
  demand: (m) => {
    const { intents: i, activity: a, intentsTxnShare: ts, dexShare: d, intentsReach: r } = m;
    return sort(
      r ? { text: `NEAR Intents volume on ${r.day} spanned ${formatCount(r.tokens, "token symbol")} on ${formatCount(r.chains, "chain")}.`, supports: r.chains > 1 } : null,
      i && i.changeYoY30d !== null
        ? {
            text: `NEAR Intents volume was ${formatUsd(i.total30d)} over the ${windowName(m, "30 days")}, ${formatMoveFromZero(i.changeYoY30d)} from ${formatUsd(i.yearAgo30d)} in the same 30 days a year earlier.`,
            supports: i.changeYoY30d > 0,
          }
        : null,
      i && i.swaps30d !== null && i.swapsYearAgo30d !== null && i.swapsChangeYoY30d !== null
        ? {
            text: `NEAR Intents settled ${formatCompact(i.swaps30d, 2)} ${i.swaps30d === 1 ? "swap" : "swaps"} over the ${windowName(m, "30 days", i.duneThrough)}, ${formatMoveFromZero(i.swapsChangeYoY30d)} from ${formatCompact(i.swapsYearAgo30d, 2)} in the same 30 days a year earlier.${averageSwap(i)}`,
            supports: i.swapsChangeYoY30d > 0,
          }
        : null,
      ts?.avg30d != null && d?.d30 != null
        ? {
            text: `The NEAR Intents contract, intents.near, accounted for ${formatPercent(ts.avg30d, 1)} of all NEAR transactions over the ${windowName(m, "30 days", ts.through)}. NEAR Intents made up ${formatPercent(d.d30, digitsApart(d.d30 * 100, FINDING_LEVELS.dexShareMajority * 100, 1))} of all DEX volume on NEAR over the ${windowName(m, "30 days")}.`,
            supports: d.d30 >= FINDING_LEVELS.dexShareMajority,
          }
        : null,
      a &&
      a.txns.change !== null &&
      a.newAccounts.change !== null &&
      a.activeAccounts.change !== null &&
      a.activeAccounts.median30d !== null &&
      a.activeAccounts.medianYearAgo30d !== null
        ? {
            text: `NEAR handled ${formatCompact(a.txns.last30d, 2)} transactions over the ${windowName(m, "30 days", a.through)}, ${formatMoveFromZero(a.txns.change)} from ${formatCompact(a.txns.yearAgo30d, 2)} in the same 30 days a year earlier. New accounts over the same days totaled ${formatCompact(a.newAccounts.last30d, 2)}, ${formatMoveFromZero(a.newAccounts.change)} from ${formatCompact(a.newAccounts.yearAgo30d, 2)} a year earlier. A median of ${formatCompact(a.activeAccounts.median30d, 2)} accounts a day signed a transaction over the same days, ${formatMoveFromZero(a.activeAccounts.change)} from a median of ${formatCompact(a.activeAccounts.medianYearAgo30d, 2)} a year earlier.`,
            supports: a.txns.change > 0 && a.newAccounts.change > 0 && a.activeAccounts.change > 0,
          }
        : null,
    );
  },
  capture: (m) => {
    const { buybacks: b, feeChain: f, feeWallets: w, referrals: r } = m;
    const growth = measuredGrowth(b);
    const top = largestReferral(r);
    return sort(
      b && growth
        ? {
            text: `NEAR Intents fees ${boughtAmount(b.bought30dNear)} over the ${windowName(m, "30 days")}. NEAR bought over the ${windowName(m, "90 days")} was ${boughtPace(growth, 1)}.`,
            /** Backs the claim only while the last 30 days bought NEAR, and on the rate as printed (one decimal), so a pace
                shown as unchanged never counts as growth. */
            supports: b.bought30dNear > 0 && percentRounded(growth.monthly, 1) > 0,
          }
        : null,
      f?.d30?.captureRate != null
        ? {
            text: `${formatPercent(f.d30.captureRate, digitsApart(f.d30.captureRate * 100, FINDING_LEVELS.captureRateMajority * 100, 1))} of NEAR Intents fees were spent buying NEAR over the ${windowName(m, "30 days", f.through)}.`,
            supports: f.d30.captureRate >= FINDING_LEVELS.captureRateMajority,
          }
        : null,
      w && w.totalNear > 0
        ? { text: `The three fee wallets held ${formatNear(w.totalNear)} on ${w.asOf}. That NEAR is not burned, so it still counts in total supply.`, supports: false }
        : null,
      r && top
        ? {
            text: `${referralSwaps(top.referral)} paid ${formatPercent(top.feeShare, digitsApart(top.feeShare * 100, FINDING_LEVELS.referralFeesMajority * 100, 1))} of the app fees on NEAR Intents 1Click swaps over the ${windowName(m, "30 days", r.through)}, on ${formatPercent(top.volumeShare, 1)} of the volume.`,
            supports: top.feeShare < FINDING_LEVELS.referralFeesMajority,
          }
        : null,
    );
  },
  supply: (m) => {
    const { supply: s, hsp029, issuance: i, absorption: a, treasury: t } = m;
    return sort(
      s
        ? {
            text: `Max issuance is ${formatMaxIssuance(s.maxInflationRate)} a year, ${s.maxInflationRate === PREVIOUS_MAX_INFLATION ? "the same as" : s.maxInflationRate < PREVIOUS_MAX_INFLATION ? "down from" : "up from"} ${formatPercent(PREVIOUS_MAX_INFLATION, 0)} before ${MAX_ISSUANCE_HALVED_DAY}.`,
            /** The same ceiling the supply breaking point uses, so a rate above it never reads as support. */
            supports: s.maxInflationRate <= TRIGGERS.maxIssuanceCeiling,
          }
        : null,
      hsp029
        ? {
            text: `HSP-029, the proposal to lower max issuance to ${formatPercent(HSP029.targetRate, 1)} a year, has the vote status **${proposalStatusLabel(hsp029)}**.`,
            supports: !proposalFailed(hsp029),
          }
        : null,
      i?.rate30d != null && a?.d30
        ? {
            text: `Measured issuance ran at ${formatPercent(i.rate30d)} a year over the ${windowName(m, "30 days")}. NEAR burned plus bought equaled ${formatPercentFromFull(a.d30.share, 1)} of the NEAR minted over the same days, so the NEAR on the market ${compareWord(a.d30.share, 1, "shrank", "grew", "held level")}.`,
            supports: a.d30.share >= 1,
          }
        : null,
      t
        ? {
            text: `The protocol treasury (${PROTOCOL_TREASURY_ACCOUNT}) held ${formatNear(t.first.value)} on ${isoDay(t.first.time)} and ${formatNear(t.balanceNear)} on ${t.asOf}.`,
            supports: t.balanceNear >= t.first.value,
          }
        : null,
    );
  },
  valuation: (m) => {
    const { buybacks: b, valuation: v, breakEven: e, revenueMultiple: r } = m;
    const growth = measuredGrowth(b);
    const range = growth?.range ?? null;
    const required = v?.requiredMonthlyGrowth ?? null;
    return sort(
      b && b.bought30dNear <= 0 && v && m.seed
        ? v.requiredMonthlyGrowth === -1
          ? { text: `NEAR Intents fees bought no NEAR over the ${windowName(m, "30 days")}, but ${alreadyAbsorbed(-1, formatMonths(COVERAGE_HORIZON_MONTHS), 1)}.`, supports: true }
          : { text: `NEAR Intents fees bought no NEAR over the ${windowName(m, "30 days")}, so ${noGrowthMatches(formatMonths(COVERAGE_HORIZON_MONTHS))}.`, supports: false }
        : growth && range && required !== null
          ? (() => {
              const check = growthCheck(range, required);
              const digits = growthDigits(growth.monthly, range, required);
              const pace = `NEAR bought over the ${windowName(m, "90 days")} was ${boughtPace(growth, digits)}`;
              /** A growth needed of zero or less is named by its rate, since alreadyAbsorbed words it as a fall. */
              const needed = growthNeededName(required, digits);
              const inside = check === "too-close" ? `. ${upperFirst(needed)} falls inside that range` : check === "happened" ? `. Even the top of that range is below ${needed}` : "";
              return {
                text:
                  required <= 0
                    ? `${pace}. ${upperFirst(alreadyAbsorbed(required, formatMonths(COVERAGE_HORIZON_MONTHS), digits))}${inside}.`
                    : `${pace}. That pace is ${compareWord(growth.monthly, required, "faster than", "slower than", "the same as")} the ${formatPercent(required, digits)} a month needed for burn plus buybacks to match monthly issuance by the end of ${formatMonths(COVERAGE_HORIZON_MONTHS)}${inside}.`,
                /** Backs the claim only while the whole range clears the growth needed, as the breaking point decides. */
                supports: check === "not-happened",
              };
            })()
          : null,
      r
        ? (() => {
            const digits = digitsApart(r.latest.value, r.median, 0);
            return {
              text: `On ${isoDay(r.latest.time)}, NEAR's market cap was ${formatMultiple(r.latest.value, digits)} its yearly network revenue (Intents revenue plus gas fees over the ${windowName(m, "30 days", isoDay(r.latest.time))}, annualized). That is ${compareWord(r.latest.value, r.median, "above", "below", "level with")} the ${formatMultiple(r.median, digits)} median of this multiple since ${isoDay(r.daily[0]!.time)}.`,
              supports: r.latest.value <= r.median,
            };
          })()
        : null,
      v?.multiple != null && e?.d30?.volumePerDayUsd != null && e.d30.currentVolumePerDayUsd > 0
        ? (() => {
            const needed = e.d30.volumePerDayUsd / e.d30.currentVolumePerDayUsd;
            const match =
              needed <= 1
                ? `At today's price, the average daily Intents volume of the ${windowName(m, "30 days")} already buys enough NEAR for burn plus buybacks to match the NEAR minted.`
                : `Burn plus buybacks would match the NEAR minted at today's price if daily Intents volume rose to ${formatMultiple(needed, digitsApart(needed, 1, 1))} its average over the ${windowName(m, "30 days")}.`;
            return {
              text: `NEAR's market cap is ${formatMultiple(v.multiple)} the yearly value of NEAR burned and bought (the ${windowName(m, "30 days")}, annualized at today's price). ${match}`,
              supports: needed <= 1,
            };
          })()
        : null,
    );
  },
  technology: (m) => {
    const { technology: t, absorption: a, protocol: p } = m;
    return sort(
      t
        ? { text: `A simple NEAR transfer costs ${transferCost(t.transferCostUsd)} at the gas price read on ${formatDateTimeUtc(t.gasPriceReadAt)}.`, supports: t.transferCostUsd <= TRIGGERS.transferCostLimitUsd }
        : null,
      p
        ? {
            text:
              p.mainnet >= FULL_BURN_PROTOCOL
                ? `Mainnet runs protocol ${p.mainnet}, which burns all gas fees instead of paying part of them to contracts.`
                : `Mainnet runs protocol ${p.mainnet}; the full gas burn comes with protocol ${FULL_BURN_PROTOCOL}.`,
            supports: p.mainnet >= FULL_BURN_PROTOCOL,
          }
        : null,
      a?.d30
        ? { text: `${formatNear(a.d30.burntNear)} of gas fees was burned over the ${windowName(m, "30 days")}, equal to ${formatPercentFromFull(a.d30.burntShare, 1)} of the NEAR minted over the same days.`, supports: a.d30.burntShare >= 1 }
        : null,
    );
  },
  network: ({ staking: st }) =>
    sort(
      st
        ? {
            text: `${formatCount(st.validators, "validator")} (${st.validators === 1 ? "staking pool" : "staking pools"}) ${st.validators === 1 ? "is" : "are"} active, and a chunk-validator seat needs ${formatNear(st.chunkValidatorSeatNear)}${st.blockProducerSeatNear ? `, ${formatPercent(st.chunkValidatorSeatNear / st.blockProducerSeatNear, 1)} of the stake a block-producer seat needs` : ""}.`,
            supports: st.blockProducerSeatNear ? st.chunkValidatorSeatNear < st.blockProducerSeatNear : true,
          }
        : null,
      st
        ? {
            text: `${st.nakamoto === 1 ? "The largest staking pool alone holds" : `The ${st.nakamoto} largest staking pools together hold`} more than a third of all stake, and ${
              st.producers === st.validators
                ? "every validator produces"
                : st.producers === 0
                  ? "no validator produces"
                  : `only ${st.producers} of the ${st.validators} ${st.producers === 1 ? "produces" : "produce"}`
            } blocks. One operator can run several pools, so fewer separate parties may stand behind them.`,
            supports: false,
          }
        : null,
    ),
  peers: (m) => {
    const { peers: p, issuance: i } = m;
    return sort(
      p && p.peerTotal > 0
        ? (() => {
            const locked = `${p.lockedCount === 0 ? "none" : p.lockedCount} of the ${p.peerTotal} larger coins that are not dollar-pegged still ${p.lockedCount === 1 ? "has" : "have"} FDV above market cap (supply not yet circulating)`;
            /** Without NEAR's FDV the sentence names only the larger coins. */
            const near = p.nearFdvRatio === null ? null : `NEAR's FDV is ${formatMultiple(p.nearFdvRatio, 2)} its market cap${p.nearLocked ? "" : ", so no NEAR is left to unlock"}`;
            return { text: near === null ? `${upperFirst(locked)}.` : `${near}. ${upperFirst(locked)}.`, supports: !p.nearLocked && p.lockedCount > 0 };
          })()
        : null,
      p && p.nearGrowth1y !== null && p.medianGrowth1y !== null
        ? (() => {
            const near = p.nearGrowth1y!;
            const median = p.medianGrowth1y!;
            const digits = peerDigits(p);
            return {
              text: `NEAR's circulating supply ${formatGrowth(near, digits)} over 12 months, ${compareWord(near, median, "above", "below", "level with")} the ${formatPercent(median, digits)} median growth of the ${formatCount(p.count, "larger coin")} with a year of history (dollar-pegged coins left out)${p.fasterCount === null ? "" : `. ${p.fasterCount === 0 ? "None" : p.fasterCount} of them grew their supply faster than NEAR`}.`,
              supports: near <= median,
            };
          })()
        : null,
      i?.rate1y != null ? { text: `NEAR minted over the ${windowName(m, "12 months")} equaled ${formatPercent(i.rate1y)} of total supply at the window's start.`, supports: false } : null,
    );
  },
};
