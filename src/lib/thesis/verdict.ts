import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { CORE_SECTIONS, SECTION_ORDER, SECTIONS } from "@/content/thesis";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import {
  digitsApart,
  formatCompact,
  formatMonths,
  formatMoveFromZero,
  formatMultiple,
  formatNear,
  formatNearAboveZero,
  formatPercent,
  formatPercentFromFull,
  formatUsd,
  percentRounded,
} from "@/lib/format";
import {
  alreadyAbsorbed,
  boughtAmount,
  boughtPace,
  buybackPace,
  growthCheck,
  measuredGrowth,
  noGrowthMatches,
  SECTION_TRIGGERS,
  valuationDigits,
  walletChange,
  type TriggerStatus,
} from "@/lib/thesis/triggers";
import { windowName } from "@/lib/thesis/window-name";

/** What the latest data supports: one summary sentence, then the evidence it rests on, all written from the live numbers. */
type Verdict = { summary: string; points: string[] };

/** A breaking point's title marked bold (`**title**`), as the dashboard and THESIS.md render it. */
const bold = (title: string) => `**${title}**`;

/** "a", "a and b", "a, b and c" */
const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** Every section's breaking-point status, in thesis order. */
const breakingPoints = (m: ThesisMetrics) => SECTION_ORDER.map((id) => ({ id, status: SECTION_TRIGGERS[id](m).status }));

/** How a group of breaking points stands: "4 hold", "2 hold and 1 is broken", "3 hold and 1 is too close to call". */
function tally(statuses: TriggerStatus[]): string {
  const count = (status: TriggerStatus) => statuses.filter((s) => s === status).length;
  const holding = count("not-happened");
  const broken = count("happened");
  const tooClose = count("too-close");
  const unmeasured = count("no-data");
  return list(
    [
      holding === 0 ? "none holds" : `${holding} ${holding === 1 ? "holds" : "hold"}`,
      broken > 0 ? `${broken} ${broken === 1 ? "is" : "are"} broken` : null,
      tooClose > 0 ? `${tooClose} ${tooClose === 1 ? "is" : "are"} too close to call` : null,
      unmeasured > 0 ? `${unmeasured} cannot be measured yet` : null,
    ].filter((part): part is string => part !== null),
  );
}

/** The breaking points counted in two groups, so the low bars of the supporting checks never pad the core result:
    "Of the 4 core breaking points (the pillars and valuation), 4 hold. Of the 3 supporting breaking points (…), 2 hold and 1 is broken." */
function breakingPointTally(m: ThesisMetrics): string {
  const statuses = breakingPoints(m);
  const core = statuses.filter(({ id }) => CORE_SECTIONS.has(id));
  const supporting = statuses.filter(({ id }) => !CORE_SECTIONS.has(id));
  return `Of the ${core.length} core breaking points (the pillars and valuation), ${tally(core.map(({ status }) => status))}. Of the ${supporting.length} supporting breaking points (${list(supporting.map(({ id }) => SECTIONS[id].eyebrow.toLowerCase()))}), ${tally(supporting.map(({ status }) => status))}.`;
}

/** The thesis's verdict on the latest data. The summary follows from three checks: whether Intents fees buy NEAR (the capture
    breaking point), whether burn plus buybacks took all the NEAR minted, and whether NEAR bought grows as fast as needed at
    today's price. Each evidence point needs only its own numbers; null until the 30-day buying and absorption are measured. */
export function thesisVerdict(m: ThesisMetrics): Verdict | null {
  const { intents: i, buybacks: b, absorption, valuation: v, breakEven, activity: act, dataChecks, feeWallets: w } = m;
  const a = absorption?.d30;
  if (!b || !a) return null;

  const window = windowName(m, "30 days");
  const horizon = formatMonths(COVERAGE_HORIZON_MONTHS);
  const triggers = breakingPoints(m);
  const broken = triggers.filter((t) => t.status === "happened").map((t) => SECTIONS[t.id].title);
  const tooClose = triggers.filter((t) => t.status === "too-close").map((t) => SECTIONS[t.id].title);
  const unmeasured = triggers.filter((t) => t.status === "no-data").length;

  const capture = triggers.find((t) => t.id === "capture")?.status;
  const buying = capture === "not-happened" && b.bought30dNear > 0;
  /** The same rule as the supply finding and tile (share ≥ 1), printed with enough decimals that a share just under 1
      never reads "100.0%". */
  const absorbsAll = a.share >= 1;
  const sharePrinted = formatPercentFromFull(a.share, 1);
  /** The growth of NEAR bought and its range against the growth needed, once both are measured; the growth needed is null without
      a seed or when no growth of NEAR bought covers issuance, and −1 when burn alone covers it. */
  const required = v?.requiredMonthlyGrowth ?? null;
  const growth = measuredGrowth(b);
  const range = growth?.range ?? null;
  const digits = valuationDigits(m);
  const pace = growth && range && required !== null ? buybackPace(growth.monthly, growthCheck(range, required), digits) : null;
  const notes = [
    broken.length === 0 ? null : `The breaking ${broken.length === 1 ? "point" : "points"} of ${list(broken.map(bold))} ${broken.length === 1 ? "is" : "are"} broken.`,
    tooClose.length === 0 ? null : `The breaking ${tooClose.length === 1 ? "point" : "points"} of ${list(tooClose.map(bold))} ${tooClose.length === 1 ? "is" : "are"} too close to call.`,
    unmeasured === 0 ? null : `${unmeasured === 1 ? "One breaking point" : `${unmeasured} breaking points`} cannot be measured yet.`,
  ].filter((note): note is string => note !== null);
  const note = notes.map((sentence) => ` ${sentence}`).join("");
  /** A broken capture point is read from the fee-wallet window it was measured on; otherwise nothing was bought to dataThrough. */
  const notWorking =
    capture === "happened" && w
      ? `${
          w.gain30dNear !== null && w.gain30dNear < 0
            ? "NEAR left the fee wallets"
            : w.bought30dNear !== null && w.bought30dNear <= 0
              ? "NEAR Intents fees bought no NEAR"
              : "NEAR bought was sold or moved out of the fee wallets"
        } over the ${windowName(m, "30 days", w.gainThrough)}`
      : `NEAR Intents fees bought no NEAR over the ${window}`;
  const summary =
    capture === "no-data"
      ? "The latest data cannot test the mechanism yet: the fee wallets' history is too short to show whether the NEAR bought stays in them."
      : !buying
        ? `The latest data does not show the mechanism working: ${notWorking}.`
        : absorbsAll
          ? `The latest data supports ${notes.length === 0 ? "the whole thesis" : "the mechanism and the outcome"}: trading through NEAR Intents buys NEAR, and the NEAR burned plus bought ${a.share > 1 ? "exceeds" : "equals"} all the NEAR minted.${note}`
          : `The latest data supports the mechanism but not yet the outcome: trading through NEAR Intents buys NEAR${pace ? `, and the buying is ${pace}` : ""}, but the NEAR burned plus bought still equals only part of the NEAR minted.${note}`;

  const multiple = breakEven?.d30?.multiple ?? null;
  /** NEAR counted as bought from the buyback data (a) against what the three fee wallets gained on chain (b): the same
      transfers, priced and measured as balances, so a gain at least as large shows the NEAR bought is still held (once any was). */
  const wallets = dataChecks.boughtVsWallets;
  const walletGap = wallets?.difference == null ? null : Math.abs(wallets.difference);
  /** Window-end balances alone cannot clear a broken capture point (its daily gap can still break it), so then they only say what they show. */
  const held = capture === "happened" ? ", so the wallets held at least what was counted as bought at the window's end" : ", so the NEAR bought is still held";
  const walletsHold = wallets && wallets.a > 0 ? (wallets.b >= wallets.a ? held : `; the wallets' gain fell ${formatNearAboveZero(wallets.a - wallets.b)} short of what was counted as bought`) : "";
  /** The summary names the broken and too-close breaking points while NEAR is bought; otherwise the tally names them. */
  const namedInSummary = capture !== "no-data" && buying;
  const points = [
    namedInSummary
      ? breakingPointTally(m)
      : `${breakingPointTally(m)}${broken.length === 0 ? "" : ` The broken ${broken.length === 1 ? "one is" : "ones are"} ${list(broken.map(bold))}.`}${
          tooClose.length === 0 ? "" : ` The ${tooClose.length === 1 ? "one" : "ones"} too close to call: ${list(tooClose.map(bold))}.`
        }`,
    i && i.changeYoY30d !== null
      ? `NEAR Intents volume over the ${window} was ${formatUsd(i.total30d)}, ${formatMoveFromZero(i.changeYoY30d)} from ${formatUsd(i.yearAgo30d)} in the same 30 days a year earlier.`
      : null,
    `NEAR Intents fees ${boughtAmount(b.bought30dNear)} over the ${window}.${growth && range ? ` NEAR bought over the ${windowName(m, "90 days")} was ${boughtPace(growth, digits)}.` : ""}`,
    /** Shown whenever the window is measured, a loss too: the gap is left out only while the wallets' gain is not positive. */
    wallets && wallets.days !== null
      ? `On chain, the three fee wallets ${walletChange(wallets.b)} over the ${windowName(m, wallets.days === 1 ? "day" : `${wallets.days} days`, wallets.through)}, against ${formatNear(wallets.a)} counted as bought over the same ${wallets.days === 1 ? "day" : "days"}.${
          walletGap === null ? "" : ` The two ${percentRounded(walletGap, 1) === 0 ? "match to within 0.1%" : `differ by ${formatPercent(walletGap, 1)}`}${walletsHold}.`
        }`
      : null,
    `${
      absorbsAll
        ? `Burn plus buybacks equaled ${sharePrinted} of the NEAR minted over the ${window}${a.share > 1 ? ", more than all of it" : ""}.`
        : `Burn plus buybacks equaled ${sharePrinted} of the NEAR minted over the ${window}${multiple === null ? "" : `; to match all of it, they would need to be ${formatMultiple(multiple, digitsApart(multiple, 1, 2))} as large`}.`
    }${v?.multiple == null ? "" : ` At today's price, NEAR's market cap is ${formatMultiple(v.multiple)} the yearly value of NEAR burned and bought (the same 30 days, annualized).`}`,
    required === null
      ? b.bought30dNear > 0 || !v || !m.seed
        ? null
        : `With no NEAR bought over the ${window}, ${noGrowthMatches(horizon)}.`
      : required <= 0
        ? `At today's price, ${alreadyAbsorbed(required, horizon, digits)}${pace && range && growthCheck(range, required) !== "not-happened" ? `; NEAR bought is ${pace}` : ""}.`
        : `For burn plus buybacks to match monthly issuance by the end of ${horizon}${pace ? "" : " at today's price"}, with the burn held at its current rate, NEAR bought needs to grow ${formatPercent(required, digits)} a month${pace ? `, and it is ${pace}. That pace compares only the ${windowName(m, "90 days")} with the 90 before, and buybacks began on ${BUYBACKS_START_DAY}` : ""}.`,
    act?.txns.change != null
      ? `NEAR handled ${formatCompact(act.txns.last30d, 2)} transactions over the ${windowName(m, "30 days", act.through)}, ${formatMoveFromZero(act.txns.change)} from ${formatCompact(act.txns.yearAgo30d, 2)} in the same 30 days a year earlier; Intents users need not hold NEAR, so NEAR Intents creates demand for the token mainly through the fees that buy it, not through activity on NEAR itself.`
      : null,
  ].filter((point): point is string => point !== null);
  return { summary, points };
}
