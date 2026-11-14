import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import { TRIGGERS } from "@/config/thesis-triggers";
import type { SectionId } from "@/content/thesis";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import {
  compareWord,
  digitsApart,
  formatCount,
  formatChange,
  formatDateTimeUtc,
  formatGrowth,
  formatGrowthRange,
  formatMonths,
  formatMoveFromZero,
  formatMultiple,
  formatNear,
  formatNearAboveZero,
  formatPace90d,
  formatPercent,
  formatSmallUsd,
  formatUsd,
  percentRounded,
  upperFirst,
} from "@/lib/format";
import { formatMaxIssuance, maxIssuanceDigits } from "@/lib/thesis/max-issuance";
import { describeProposalStatus, proposalFailed, proposalStatusLabel } from "@/lib/thesis/proposal-status";

/** Whether a section's breaking point shows in the latest data; "too-close" while its threshold falls inside the measured range. */
export type TriggerStatus = "happened" | "not-happened" | "too-close" | "no-data";

/** The breaking point of one thesis section (the result that would change the view), and what the latest data shows against it. */
type SectionTrigger = {
  /** The breaking point, as a fixed sentence with its threshold. */
  rule: string;
  /** The same rule in one short sentence, for the Home thesis cards. */
  ruleShort: string;
  status: TriggerStatus;
  /** What the latest data shows, written from the live numbers. */
  detail: string;
  /** The deciding numbers of `detail` in one sentence, for the Home thesis cards. */
  detailShort: string;
};

export const TRIGGER_STATUS_LABEL: Record<TriggerStatus, string> = {
  happened: "Broken",
  "not-happened": "Holding",
  "too-close": "Too close to call",
  "no-data": "Not measured yet",
};

const NO_DATA = "The database does not cover this check yet.";

/** A breaking point whose data is not stored yet. */
const unmeasured = (rule: string, ruleShort: string): SectionTrigger => ({ rule, ruleShort, status: "no-data", detail: NO_DATA, detailShort: NO_DATA });

/** A sentence with its first letter in lower case, to follow an opening clause. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** What the three fee wallets did with a NEAR change: "gained 4.2K NEAR", "lost less than 0.1 NEAR" or "kept the same balance". */
export const walletChange = (gainNear: number) =>
  gainNear === 0 ? "kept the same balance" : `${gainNear > 0 ? "gained" : "lost"} ${formatNearAboveZero(Math.abs(gainNear))}`;

/** What NEAR Intents fees bought: "bought 403.5K NEAR", "bought less than 0.1 NEAR" or "bought no NEAR". */
export const boughtAmount = (boughtNear: number) => (boughtNear <= 0 ? "bought no NEAR" : `bought ${formatNearAboveZero(boughtNear)}`);

/** A transfer's cost in USD; one that rounds to the breaking point's limit prints with the decimals that tell them apart. */
export const transferCost = (costUsd: number) =>
  formatSmallUsd(costUsd) === formatUsd(TRIGGERS.transferCostLimitUsd)
    ? `$${costUsd.toFixed(3 + digitsApart(costUsd * 1000, TRIGGERS.transferCostLimitUsd * 1000, 0))}`
    : formatSmallUsd(costUsd);

/** Result of the valuation check: holding while the whole 95% range of NEAR bought's growth is at or above the growth needed,
    broken while all of it is below, and too close to call while the growth needed falls inside it. */
type GrowthCheck = Exclude<TriggerStatus, "no-data">;

export function growthCheck(range: { low: number; high: number }, required: number): GrowthCheck {
  return range.low >= required ? "not-happened" : range.high < required ? "happened" : "too-close";
}

/** Decimals that tell NEAR bought's growth and both ends of its range apart from the growth needed, as the check compares them unrounded. */
export function growthDigits(growth: number, range: { low: number; high: number }, required: number): number {
  return Math.max(...[growth, range.low, range.high].map((value) => digitsApart(value * 100, required * 100, 1)));
}

/** growthDigits for the metrics' NEAR bought and growth needed, or 1 while either is not measured. */
export function valuationDigits({ buybacks: b, valuation: v }: ThesisMetrics): number {
  return b?.monthlyGrowth != null && b.monthlyGrowthRange !== null && v?.requiredMonthlyGrowth != null ? growthDigits(b.monthlyGrowth, b.monthlyGrowthRange, v.requiredMonthlyGrowth) : 1;
}

/** Decimals at which NEAR's supply growth and the peer median print apart, as the peers breaking point compares them unrounded. */
export const peerDigits = (p: NonNullable<ThesisMetrics["peers"]>) =>
  p.nearGrowth1y === null || p.medianGrowth1y === null ? 1 : digitsApart(p.nearGrowth1y * 100, p.medianGrowth1y * 100, 1);

/** NEAR bought over the last 90 days (`latest`) and the 90 before (`prior`), the change, its monthly rate and that rate's 95% range. */
type MeasuredGrowth = { change90d: number; monthly: number; range: { low: number; high: number } | null; latest: number; prior: number };

/** NEAR bought's 90-day growth once both windows and the monthly rate are measured; the range can still be null. */
export function measuredGrowth(b: ThesisMetrics["buybacks"]): MeasuredGrowth | null {
  return b && b.change90d !== null && b.monthlyGrowth !== null && b.bought90dNear !== null && b.boughtPrior90dNear !== null
    ? { change90d: b.change90d, monthly: b.monthlyGrowth, range: b.monthlyGrowthRange, latest: b.bought90dNear, prior: b.boughtPrior90dNear }
    : null;
}

/** "1.2M NEAR, up 71% from 703K NEAR in the 90 days before, a pace of …": NEAR bought's 90-day pace, the rate at `digits`. */
export const boughtPace = (growth: MeasuredGrowth, digits: number) =>
  formatPace90d(formatNear(growth.latest, 2), formatNear(growth.prior, 2), growth.change90d, growth.monthly, digits, growth.range);

/** Why NEAR bought cannot close the gap once nothing is bought, by the end of `horizon`. */
export const noGrowthMatches = (horizon: string) => `no growth of NEAR bought can make burn plus buybacks match monthly issuance by the end of ${horizon}`;

/** How NEAR bought moves against the monthly growth needed at today's price, worded from the check and the rate as printed
    with `digits`, e.g. "growing too slowly at today's price" or "growing, though not clearly as fast as needed at today's price". */
export function buybackPace(monthlyGrowth: number, check: GrowthCheck, digits: number): string {
  const shown = percentRounded(monthlyGrowth, digits);
  const motion = shown > 0 ? "growing" : shown < 0 ? "shrinking" : "not growing";
  if (check === "too-close") return shown > 0 ? "growing, though not clearly as fast as needed at today's price" : `${motion}, too close to call against the growth needed at today's price`;
  if (shown > 0) return `growing ${check === "happened" ? "too slowly" : "faster than needed"} at today's price`;
  return check === "happened" ? `${motion}, short of the growth needed at today's price` : `${motion}, which is still enough at today's price`;
}

/** What a growth needed of zero or less means (coveringGrowth): burn plus buybacks at their current rate already match monthly
    issuance by the end of `horizon`, and how far NEAR bought could fall a month and still do so, worded at `digits`. */
export function alreadyAbsorbed(required: number, horizon: string, digits: number): string {
  if (required <= -1) return `burn alone already matches monthly issuance by the end of ${horizon}, so NEAR bought need not grow at all`;
  const fall = percentRounded(-required, digits) > 0 ? `; NEAR bought could fall ${formatPercent(-required, digits)} a month and still do so` : ", so no growth is needed";
  return `burn plus buybacks at their current rate already match monthly issuance by the end of ${horizon}${fall}`;
}

/** The growth needed as the range is set against it: "the growth needed" while above zero; at zero or below, where
    alreadyAbsorbed words it as a fall, by its rate at `digits`, e.g. "a rate of −2.3% a month". */
export const growthNeededName = (required: number, digits: number) => (required > 0 ? "the growth needed" : `a rate of ${formatChange(required, digits)} a month`);

/** The growth needed as a value: −1 means burn alone matches issuance, so no rate of NEAR bought is needed at all. */
export const growthNeededValue = (required: number, digits: number) => (required <= -1 ? "None: burn alone matches issuance" : formatChange(required, digits));

/** Each section's breaking point. The rule is fixed in advance (thresholds in src/config/thesis-triggers.ts);
    the status and the explanation follow the live numbers. */
export const SECTION_TRIGGERS: Record<SectionId, (m: ThesisMetrics) => SectionTrigger> = {
  demand: ({ intents: i, dataThrough }) => {
    const rule =
      "The thesis breaks if NEAR Intents volume over the last 30 days falls below the same 30 days a year earlier, or volume over the last 90 days falls below the 90 days before. Either would mean cross-chain trading through NEAR is shrinking.";
    const ruleShort = "The thesis breaks if Intents volume falls below the same 30 days a year earlier, or below the 90 days before.";
    const yearOnYear = i?.changeYoY30d ?? null;
    const recent = i?.change90d ?? null;
    if (!i || (yearOnYear === null && recent === null)) return unmeasured(rule, ruleShort);
    const fellYearOnYear = yearOnYear !== null && yearOnYear < 0;
    const fellRecently = recent !== null && recent < 0;
    const happened = fellYearOnYear || fellRecently;
    const yearSentence =
      yearOnYear === null
        ? "Volume for the same 30 days a year earlier is not stored yet."
        : `NEAR Intents volume was ${formatUsd(i.total30d)} over the 30 days to ${dataThrough}, ${formatMoveFromZero(yearOnYear)} from ${formatUsd(i.yearAgo30d)} in the same 30 days a year earlier.`;
    const recentSentence =
      recent === null || i.total90d === null || i.prior90d === null
        ? "Volume for the 90 days before the last 90 is not stored yet."
        : `NEAR Intents volume over the 90 days to ${dataThrough} was ${formatUsd(i.total90d)}, ${formatMoveFromZero(recent)} from ${formatUsd(i.prior90d)} in the 90 days before.`;
    const moves = [
      yearOnYear === null ? null : `${formatMoveFromZero(yearOnYear)} from the same 30 days a year earlier`,
      recent === null ? null : `${formatMoveFromZero(recent)} from the 90 days before`,
    ].filter((part): part is string => part !== null);
    return {
      rule,
      ruleShort,
      detailShort: `Intents volume is ${moves.join(" and ")}.${moves.length < 2 ? " The data for the other check is not stored yet." : ""}`,
      /** Half of the check needs data that is not stored yet, so a missing half is not a pass unless the other half broke. */
      status: happened ? "happened" : yearOnYear === null || recent === null ? "no-data" : "not-happened",
      detail: `${yearSentence} ${recentSentence} ${
        happened
          ? fellYearOnYear && fellRecently
            ? "Trading through NEAR Intents is shrinking on both checks."
            : fellYearOnYear
              ? "Trading through NEAR Intents is below its level a year earlier."
              : "Trading through NEAR Intents fell over those 90 days."
          : yearOnYear === null || recent === null
            ? "The thesis cannot be tested until both checks have data."
            : yearOnYear > 0 && recent > 0
              ? "Trading through NEAR Intents grew on both checks."
              : "Trading through NEAR Intents did not shrink on either check."
      }`,
    };
  },
  capture: ({ feeWallets: w }) => {
    const limit = formatPercent(TRIGGERS.walletShortfallShare, 0);
    const rule = `The thesis breaks if, over 30 days, NEAR Intents fees buy no NEAR, the three fee wallets lose NEAR, or on any day the wallets' gain since the window began falls short of the NEAR bought since then by more than ${limit} of the 30 days' buying. The last two would mean the NEAR bought was sold or moved out.`;
    const ruleShort = `The thesis breaks if fees buy no NEAR, or the fee wallets lose NEAR or fall more than ${limit} behind the NEAR bought.`;
    if (!w || w.bought30dNear === null || w.gain30dNear === null || w.shortfall30dNear === null) return unmeasured(rule, ruleShort);
    const stopped = w.bought30dNear <= 0;
    const lost = w.gain30dNear < 0;
    /** Tracked day by day, so a sale smaller than the month's buying still shows. */
    const shortfallShare = w.bought30dNear > 0 ? w.shortfall30dNear / w.bought30dNear : 0;
    const fellBehind = shortfallShare > TRIGGERS.walletShortfallShare;
    const happened = stopped || lost || fellBehind;
    /** Enough decimals to tell the gap from the limit, and a gap above zero from none. */
    const shareDigits = Math.max(digitsApart(shortfallShare * 100, TRIGGERS.walletShortfallShare * 100, 1), digitsApart(shortfallShare * 100, 0, 1));
    /** With nothing bought there is no buying to fall behind, so the gap is not described. */
    const gap = stopped
      ? ""
      : w.shortfall30dNear <= 0
        ? " On no day did the wallets fall behind the NEAR bought since the window began."
        : ` On the day of the largest gap, the wallets' gain since the window began fell ${formatNearAboveZero(w.shortfall30dNear)} short of the NEAR bought since then: ${formatPercent(shortfallShare, shareDigits)} of the 30 days' buying, ${compareWord(shortfallShare, TRIGGERS.walletShortfallShare, "above", "below", "at")} the ${limit} limit.`;
    const outcome = !happened
      ? "The buying continues, and the NEAR bought is still held."
      : [stopped ? "The buying stopped." : null, lost ? "NEAR left the wallets." : null, !lost && fellBehind ? "NEAR bought was sold or moved out during the window." : null]
          .filter((sentence): sentence is string => sentence !== null)
          .join(" ");
    const gapShort =
      w.shortfall30dNear <= 0
        ? "; on no day did they fall behind it"
        : `; the largest daily gap was ${formatPercent(shortfallShare, shareDigits)} of the buying, ${compareWord(shortfallShare, TRIGGERS.walletShortfallShare, "above", "under", "at")} the ${limit} limit`;
    return {
      rule,
      ruleShort,
      status: happened ? "happened" : "not-happened",
      detail: `In the 30 days to ${w.gainThrough}, NEAR Intents fees ${boughtAmount(w.bought30dNear)} and the three fee wallets ${walletChange(w.gain30dNear)}.${gap} ${outcome}`,
      detailShort: stopped
        ? `NEAR Intents fees bought no NEAR in the 30 days to ${w.gainThrough}, and the fee wallets ${walletChange(w.gain30dNear)}.`
        : `The fee wallets ${walletChange(w.gain30dNear)} against ${formatNearAboveZero(w.bought30dNear)} bought${gapShort}.`,
    };
  },
  supply: ({ supply: s, hsp029, absorption: a, dataThrough }) => {
    const rule = `The thesis breaks if HSP-029 can no longer take effect (it is defeated, vetoed, rejected or expires, or fails on execution), if max issuance rises above ${formatPercent(TRIGGERS.maxIssuanceCeiling, 1)} a year again, or if NEAR burned plus bought equals a smaller share of the NEAR minted over the last 90 days than over the 90 days before.`;
    const ruleShort = `The thesis breaks if HSP-029 fails, max issuance rises above ${formatPercent(TRIGGERS.maxIssuanceCeiling, 1)}, or burn plus buybacks take a smaller share of the NEAR minted over the last 90 days than in the 90 days before.`;
    if (!s) return unmeasured(rule, ruleShort);
    const raised = s.maxInflationRate > TRIGGERS.maxIssuanceCeiling;
    const failed = hsp029 !== null && proposalFailed(hsp029);
    const latest = a?.d90 ?? null;
    const prior = a?.d90Prior ?? null;
    const absorbedLess = latest !== null && prior !== null && latest.share < prior.share;
    const digits = maxIssuanceDigits(s.maxInflationRate);
    const shareDigits = latest && prior ? digitsApart(latest.share * 100, prior.share * 100, 1) : 1;
    const unmeasuredWindow = latest === null ? "The last 90 days are not fully measured yet." : "The 90 days before the last 90 are not fully measured yet.";
    const unreadVote = "The HSP-029 vote has not been read yet.";
    const absorbed =
      latest && prior
        ? ` NEAR burned plus bought equaled ${formatPercent(latest.share, shareDigits)} of the NEAR minted over the 90 days to ${dataThrough}, ${compareWord(latest.share, prior.share, "up from", "down from", "the same as")} ${formatPercent(prior.share, shareDigits)} in the 90 days before.`
        : ` ${unmeasuredWindow}`;
    /** The vote and max issuance are named only when they break the check or the vote is unread; the stat tiles beside it show both. */
    const brokenParts = [
      raised ? `Max issuance rose to ${formatMaxIssuance(s.maxInflationRate)} a year.` : null,
      failed ? `HSP-029 can no longer take effect (${proposalStatusLabel(hsp029)}).` : null,
      hsp029 === null ? unreadVote : null,
    ].filter((sentence): sentence is string => sentence !== null);
    const absorbedShort =
      latest && prior
        ? `Burn plus buybacks took ${formatPercent(latest.share, shareDigits)} of the NEAR minted over the 90 days to ${dataThrough}, ${compareWord(latest.share, prior.share, "up from", "down from", "the same as")} ${formatPercent(prior.share, shareDigits)} in the 90 days before.`
        : unmeasuredWindow;
    return {
      rule,
      ruleShort,
      /** Each part needs its data, so an unread vote or an unmeasured window is not a pass unless another part already broke. */
      status: raised || failed || absorbedLess ? "happened" : hsp029 === null || latest === null || prior === null ? "no-data" : "not-happened",
      detail: `Max issuance is ${formatMaxIssuance(s.maxInflationRate)} a year${raised ? `, above ${formatPercent(TRIGGERS.maxIssuanceCeiling, digits)}` : ""}.${hsp029 ? ` For HSP-029, ${lowerFirst(describeProposalStatus(hsp029))}` : ` ${unreadVote}`}${absorbed}`,
      detailShort: [...brokenParts, absorbedShort].join(" "),
    };
  },
  valuation: ({ buybacks: b, valuation: v, seed, dataThrough }) => {
    const horizon = formatMonths(COVERAGE_HORIZON_MONTHS);
    const rule = `The thesis breaks if even the top of the 95% range of NEAR bought's monthly growth rate (the last 90 days against the 90 days before) is below the monthly growth rate needed for burn plus buybacks to match monthly issuance by the end of ${horizon}. The growth needed assumes today's price and burn held at its current rate. The 95% range shows how far day-to-day swings in buying alone can move the measured rate; while the growth needed falls inside it, the check is too close to call.`;
    const ruleShort = `The thesis breaks if even the top of the 95% range of NEAR bought's monthly growth is below the growth needed for burn plus buybacks to match monthly issuance by the end of ${horizon}.`;
    if (!b) return unmeasured(rule, ruleShort);
    /** With nothing bought, no growth of NEAR bought can close the gap to issuance, unless burn alone already closes it (−1);
        telling the two apart needs the measured burn the projection starts from. */
    if (b.bought30dNear <= 0) {
      if (!v || !seed) return unmeasured(rule, ruleShort);
      const detail =
        v.requiredMonthlyGrowth === -1
          ? `NEAR Intents fees bought no NEAR in the 30 days to ${dataThrough}, but ${alreadyAbsorbed(-1, horizon, 1)}.`
          : `NEAR Intents fees bought no NEAR in the 30 days to ${dataThrough}, so ${noGrowthMatches(horizon)}.`;
      return { rule, ruleShort, status: v.requiredMonthlyGrowth === -1 ? "not-happened" : "happened", detail, detailShort: detail };
    }
    const growth = measuredGrowth(b);
    const range = growth?.range ?? null;
    if (growth === null || range === null || v?.requiredMonthlyGrowth == null) return unmeasured(rule, ruleShort);
    const required = v.requiredMonthlyGrowth;
    const check = growthCheck(range, required);
    const digits = growthDigits(growth.monthly, range, required);
    const pace = `NEAR bought in the 90 days to ${dataThrough} was ${boughtPace(growth, digits)}`;
    const needed = growthNeededName(required, digits);
    const outcome = check === "happened" ? ` Even the top of its 95% range is below ${needed}.` : check === "too-close" ? ` ${upperFirst(needed)} falls inside its 95% range, so the check is too close to call.` : "";
    const growthShort = `NEAR bought's growth is ${formatChange(growth.monthly, digits)} a month (95% range ${formatGrowthRange(range, digits)})`;
    return {
      rule,
      ruleShort,
      detailShort:
        required <= 0 ? `${growthShort}. ${upperFirst(alreadyAbsorbed(required, horizon, digits))}.${outcome}` : `${growthShort}; ${formatPercent(required, digits)} a month is needed.`,
      status: check,
      detail:
        required <= 0
          ? `${pace}. ${upperFirst(alreadyAbsorbed(required, horizon, digits))}.${outcome}`
          : `${pace}. NEAR bought needs to grow ${formatPercent(required, digits)} a month for burn plus buybacks to match monthly issuance by the end of ${horizon}, and it is ${buybackPace(growth.monthly, check, digits)}.`,
    };
  },
  technology: ({ technology: t }) => {
    const rule = `The thesis breaks if a simple NEAR transfer costs more than ${formatUsd(TRIGGERS.transferCostLimitUsd)} at the latest gas price read. Trades would then no longer settle cheaply.`;
    const ruleShort = `The thesis breaks if a simple NEAR transfer costs more than ${formatUsd(TRIGGERS.transferCostLimitUsd)}.`;
    if (!t) return unmeasured(rule, ruleShort);
    const happened = t.transferCostUsd > TRIGGERS.transferCostLimitUsd;
    const cost = transferCost(t.transferCostUsd);
    /** How many times the cost would have to rise to pass the limit, so a cost far below it reads as a wide margin. */
    const headroom = t.transferCostUsd > 0 && t.transferCostUsd < TRIGGERS.transferCostLimitUsd ? TRIGGERS.transferCostLimitUsd / t.transferCostUsd : null;
    const against = `${compareWord(t.transferCostUsd, TRIGGERS.transferCostLimitUsd, "above", "below", "exactly at")} the ${formatUsd(TRIGGERS.transferCostLimitUsd)} limit${headroom === null ? "" : `; it would have to rise ${formatMultiple(headroom, digitsApart(headroom, 1, 0))} to pass it`}`;
    return {
      rule,
      ruleShort,
      status: happened ? "happened" : "not-happened",
      detail: `A simple NEAR transfer costs ${cost} at the gas price read on ${formatDateTimeUtc(t.gasPriceReadAt)}, ${against}.`,
      detailShort: `A transfer costs ${cost}, ${against}.`,
    };
  },
  network: ({ staking: st }) => {
    const rule = `The thesis breaks if fewer than ${TRIGGERS.nakamotoFloor} validators together hold more than a third of all stake. A group that small could stop the chain from finalizing blocks by acting together. Validators are counted by staking pool, and one operator can run several pools, so there can be fewer separate parties.`;
    const ruleShort = `The thesis breaks if fewer than ${TRIGGERS.nakamotoFloor} staking pools together hold more than a third of all stake.`;
    if (!st) return unmeasured(rule, ruleShort);
    const happened = st.nakamoto < TRIGGERS.nakamotoFloor;
    const gap = Math.abs(st.nakamoto - TRIGGERS.nakamotoFloor);
    const against = `${gap === 0 ? "at" : `${gap} ${happened ? "below" : "above"}`} the floor of ${TRIGGERS.nakamotoFloor}`;
    return {
      rule,
      ruleShort,
      status: happened ? "happened" : "not-happened",
      detail: `In the latest epoch, ${st.nakamoto === 1 ? `the largest of ${formatCount(st.validators, "validator")} alone holds` : `the ${st.nakamoto} largest of ${st.validators} validators together hold`} more than a third of all stake, ${against}.`,
      detailShort: `${st.nakamoto === 1 ? "The largest pool alone holds" : `The ${st.nakamoto} largest pools together hold`} more than a third of all stake, ${against}.`,
    };
  },
  peers: ({ peers: p }) => {
    const rule = "The thesis breaks if NEAR's circulating supply grows faster over 12 months than the median circulating supply growth of the coins ranked above it by market cap, leaving out dollar-pegged coins.";
    const ruleShort = "The thesis breaks if NEAR's circulating supply grows faster over 12 months than the median of the larger coins.";
    if (!p || p.nearGrowth1y === null || p.medianGrowth1y === null) return unmeasured(rule, ruleShort);
    const happened = p.nearGrowth1y > p.medianGrowth1y;
    const digits = peerDigits(p);
    const place = compareWord(p.nearGrowth1y, p.medianGrowth1y, "above", "below", "level with");
    return {
      rule,
      ruleShort,
      detailShort: `NEAR's circulating supply ${formatGrowth(p.nearGrowth1y, digits)} over 12 months, ${place} the ${formatPercent(p.medianGrowth1y, digits)} median of ${formatCount(p.count, "larger coin")}.`,
      status: happened ? "happened" : "not-happened",
      detail: `NEAR's circulating supply ${formatGrowth(p.nearGrowth1y, digits)} over 12 months. The median growth of the ${formatCount(p.count, "larger coin")} with a year of history (dollar-pegged coins left out) was ${formatPercent(p.medianGrowth1y, digits)}. NEAR's supply growth is ${place} that median${happened ? ", so having no tokens left to unlock has not kept it low" : ""}.`,
    };
  },
};
