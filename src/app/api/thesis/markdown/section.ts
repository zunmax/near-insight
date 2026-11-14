/** The frame every thesis section shares: heading, claim, bull and bear case, breaking point, and the re-run line. */
import { day, daysTo, evidenceTable, sectionHeading, show, table, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { SECTION_ORDER, sectionName, SECTIONS, type SectionId } from "@/content/thesis";
import { SECTION_FINDINGS } from "@/lib/thesis/findings";
import { SECTION_STATS } from "@/lib/thesis/stats";
import { SECTION_TRIGGERS, TRIGGER_STATUS_LABEL } from "@/lib/thesis/triggers";

/** Sections 1 and 2 are the introduction and the data, so the thesis sections start at 3. */
const FIRST_THESIS_SECTION = 3;

/** A thesis section's number in THESIS.md. */
export const sectionNumber = (id: SectionId) => FIRST_THESIS_SECTION + SECTION_ORDER.indexOf(id);

/** The number of the first section after the thesis sections. */
export const AFTER_THESIS_SECTIONS = FIRST_THESIS_SECTION + SECTION_ORDER.length;

/** A thesis section's numbered title, as its heading and the breaking-point table print it: "3. Cross-chain trading runs through NEAR". */
export const thesisSectionTitle = (id: SectionId) => `${sectionNumber(id)}. ${sectionName(id)}`;

/** The emoji that frames each section's heading in THESIS.md. */
const SECTION_EMOJI: Record<SectionId, string> = {
  demand: "🌐",
  capture: "💰",
  supply: "📉",
  valuation: "📐",
  technology: "⚡",
  network: "🛡️",
  peers: "🔓",
};

/** The days behind the numbers in each section's bull and bear case tables (`SECTION_STATS[id].against`); a day not known
    yet leaves its clause out rather than printing a dash. */
function statsDates(id: SectionId, input: ThesisDocumentInput): string {
  const m = input.metrics;
  switch (id) {
    case "demand":
      return `Chain activity: ${daysTo(30, m.activity?.through ?? null)} against the same 30 days a year earlier.`;
    case "capture":
      return `Share of fees: ${daysTo(30, m.feeChain?.through ?? null)}.${m.feeWallets ? ` NEAR held: balance on ${m.feeWallets.asOf}.` : ""}`;
    case "supply":
      return `Issuance and absorption: ${daysTo(30, m.dataThrough)}. Supply growth: ${daysTo(365, m.supply?.growthThrough ?? null)}.`;
    case "valuation":
      return `Burn and buybacks: ${daysTo(30, m.dataThrough)}${input.marketAsOf ? `, at the NEAR price of ${day(input.marketAsOf)}` : ""}.`;
    case "technology":
      return `Burn: ${daysTo(30, m.dataThrough)}.`;
    case "network":
      return `Validator set of epoch ${show(m.staking?.epochHeight, String)}.`;
    case "peers":
      return `NEAR minted: ${daysTo(365, m.dataThrough)}.`;
  }
}

/** One thesis section: claim, bull case, bear case, its live numbers on the side each supports, the breaking point and whether it has been reached, and how to re-run it. */
export function section(id: SectionId, input: ThesisDocumentInput, evidence: string[][], notes: string[], rerun: string): string {
  const s = SECTIONS[id];
  const evidenceStats = SECTION_STATS[id].against(input.metrics);
  const finding = SECTION_FINDINGS[id](input.metrics);
  const trigger = SECTION_TRIGGERS[id](input.metrics);
  /** Each number sits on the side its value supports, the same split the thesis pages make. */
  const statsFor = evidenceStats?.filter((stat) => stat.supports === true) ?? [];
  const statsAgainst = evidenceStats?.filter((stat) => stat.supports !== true) ?? [];
  const statsBlock = evidenceStats?.length
    ? [
        ...(statsFor.length > 0 ? [table(["Bull case", "Value"], statsFor.map((stat) => [stat.label, stat.value]))] : []),
        ...(statsAgainst.length > 0 ? [table(["Bear case", "Value"], statsAgainst.map((stat) => [stat.label, stat.value]))] : []),
        statsDates(id, input),
      ].join("\n\n")
    : "The database does not cover these numbers yet.";
  return [
    sectionHeading(thesisSectionTitle(id), SECTION_EMOJI[id]),
    `**Claim:** ${s.claim}`,
    /** The evidence table holds numbers for and against, so it comes before both cases rather than under the bull case. */
    evidenceTable(evidence),
    ...notes,
    ...(finding.for.length > 0 ? [`**Bull case:** ${finding.for.join(" ")}`] : []),
    `**Bear case:** ${[...finding.against, s.against].join(" ")}`,
    statsBlock,
    `**Breaking point:** ${trigger.rule}`,
    `**Status:** ${TRIGGER_STATUS_LABEL[trigger.status]}. ${trigger.detail}`,
    `**Re-run:** ${rerun}`,
  ].join("\n\n");
}
