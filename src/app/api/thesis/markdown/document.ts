/** THESIS.md, assembled as a short paper: abstract, introduction, data and method, the thesis sections, then the reference parts. */
import { captureSection } from "@/app/api/thesis/markdown/capture";
import { demandSection } from "@/app/api/thesis/markdown/demand";
import { DASH, FOOTER, sectionHeading, show, table, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { leadLagSection } from "@/app/api/thesis/markdown/lead-lag";
import { networkSection } from "@/app/api/thesis/markdown/network";
import { peersSection } from "@/app/api/thesis/markdown/peers";
import { dataAndMethod, FORMULAS, howToReproduce, notMeasured } from "@/app/api/thesis/markdown/reference";
import { AFTER_THESIS_SECTIONS, sectionNumber, thesisSectionTitle } from "@/app/api/thesis/markdown/section";
import { supplySection } from "@/app/api/thesis/markdown/supply";
import { technologySection } from "@/app/api/thesis/markdown/technology";
import { valuationSection } from "@/app/api/thesis/markdown/valuation";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { LIVE_DASHBOARD_URL } from "@/config/site";
import { PILLARS, SECTION_ORDER, SECTIONS, THESIS_STATEMENT, THESIS_STEPS } from "@/content/thesis";
import { formatNear, formatPercent, formatPercentFromFull, formatUsd } from "@/lib/format";
import { breakingPoints } from "@/lib/thesis/breaking-points";
import { measuredGrowth } from "@/lib/thesis/triggers";
import { thesisVerdict } from "@/lib/thesis/verdict";

/** The numbered sections after the thesis sections. */
const LEAD_LAG_SECTION = AFTER_THESIS_SECTIONS;
const BREAKING_POINTS_SECTION = AFTER_THESIS_SECTIONS + 1;
const NOT_MEASURED_SECTION = AFTER_THESIS_SECTIONS + 2;
const REPRODUCE_SECTION = AFTER_THESIS_SECTIONS + 3;

/** The number of supporting claims: every section after the pillars and valuation. */
const SUPPORTING_COUNT = SECTION_ORDER.length - PILLARS.size - 1;

const firstSection = sectionNumber(SECTION_ORDER[0]!);
const lastSection = sectionNumber(SECTION_ORDER.at(-1)!);

/** The numbers the verdict rests on, as one table row under the title (THESIS.pdf sets them as the cover's figures). */
function keyFigures({ metrics: m }: ThesisDocumentInput): string {
  const needed = m.valuation?.requiredMonthlyGrowth ?? null;
  return table(
    ["NEAR Intents volume, 30 days", "NEAR bought with its fees, 30 days", "New NEAR burned or bought, 30 days", "Monthly growth of NEAR bought", "Monthly growth needed"],
    [
      [
        show(m.intents?.total30d, formatUsd),
        show(m.buybacks?.bought30dNear, formatNear),
        show(m.absorption?.d30?.share, (share) => formatPercentFromFull(share, 1)),
        show(measuredGrowth(m.buybacks)?.monthly, (growth) => formatPercent(growth, 1)),
        needed === null ? DASH : needed <= 0 ? "None" : formatPercent(needed, 1),
      ],
    ],
  );
}

/** The document's opening, laid out like the README: a centred title, the deck, the version line, the key figures, the disclaimer, the banner and the two links. */
function header(input: ThesisDocumentInput): string {
  const live = LIVE_DASHBOARD_URL.replace(/^https?:\/\//, "");
  return [
    '<div align="center">',
    "# NEAR Long-Term Investment Thesis",
    "**A live test of whether NEAR Intents fees can absorb NEAR's new supply.**",
    `As of ${input.snapshot} · flow data through ${input.metrics.dataThrough ?? DASH}`,
    keyFigures(input),
    "*For research and education only. This is not investment, financial or legal advice.*",
    '<img src="assets/thesis-banner.svg" width="100%" alt="NEAR Long-Term Investment Thesis: NEAR Intents turns cross-chain trading into buying of NEAR on the open market." />',
    `**Live dashboard: [${live}](${LIVE_DASHBOARD_URL})** · **Guide: [README.md](README.md)**`,
    "</div>",
  ].join("\n\n");
}

/** The abstract: what is tested and how, the verdict on the latest data, then the evidence the verdict rests on as key findings. */
function abstract(input: ThesisDocumentInput): string {
  const v = thesisVerdict(input.metrics);
  const paragraph = [
    `Since ${BUYBACKS_START_DAY}, the NEAR Intents app and the 1Click API have spent the fees they keep on buying NEAR on the open market.`,
    "This paper tests whether that buying, plus the NEAR burned, can grow to match the NEAR minted.",
    `It tests ${PILLARS.size} pillars, the valuation and ${SUPPORTING_COUNT} supporting claims on data through ${input.metrics.dataThrough ?? DASH}, and each claim names in advance the result that would break it.`,
    v ? v.summary : "The database does not cover the numbers the verdict needs yet.",
    `Every number comes from free sources and is rebuilt with \`npm run rebuild\`; section ${BREAKING_POINTS_SECTION} checks every breaking point.`,
  ].join(" ");
  return [sectionHeading("Abstract", "📄"), paragraph, ...(v ? ["**Key findings**", v.points.map((point) => `- ${point}`).join("\n")] : [])].join("\n\n");
}

/** The thesis, how it works, and the claims it splits into, each with the section that tests it. */
function introduction(): string {
  const claims = SECTION_ORDER.map((id) => `- **${SECTIONS[id].eyebrow}** (section ${sectionNumber(id)}): ${SECTIONS[id].title}.`);
  return [
    sectionHeading("1. Introduction", "💡"),
    `**${THESIS_STATEMENT}**`,
    "How it works:",
    THESIS_STEPS.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    `The thesis splits into claims that can each fail: ${PILLARS.size} pillars, the valuation and ${SUPPORTING_COUNT} supporting claims. Each section states its claim and evidence, then the bull case (the evidence for it) and the bear case (the evidence against it). It ends with its breaking point, the result that would change the view, and whether the latest data shows it.`,
    claims.join("\n"),
    `Section ${LEAD_LAG_SECTION} tests whether Intents volume leads NEAR's price or usage. Section ${BREAKING_POINTS_SECTION} checks every breaking point against the latest data, section ${NOT_MEASURED_SECTION} lists what the free sources cannot measure, and section ${REPRODUCE_SECTION} shows how to rebuild every number. The live dashboard shows the same sections with current data.`,
  ].join("\n\n");
}

/** Every claim's breaking point in one table: the result that would change the view, what the latest data shows, and its status. */
function breakingPointTable(input: ThesisDocumentInput): string {
  /** `breakingPoints` lists the sections in SECTION_ORDER, so each row takes its section's numbered title. */
  const rows = breakingPoints(input.metrics).map((point, i) => [thesisSectionTitle(SECTION_ORDER[i]!), point.rule, point.detail, `**${point.status}**`]);
  return [
    sectionHeading(`${BREAKING_POINTS_SECTION}. What would change our mind`, "🚦"),
    `Each claim names, in advance, the result that would change the view. The table checks each one against the latest data; sections ${firstSection} to ${lastSection} give every rule and result in full.`,
    table(["Section", "Breaking point", "Latest data", "Status"], rows),
  ].join("\n\n");
}

/** How the document was made, and the disclaimer. */
const DISCLOSURE =
  "The code that builds this document was written with an AI coding assistant (Claude Code), and the text is generated from the database by that code. For research and education only. This is not investment, financial or legal advice.";

/** THESIS.md, rendered from the database and the section content in src/content/thesis.ts. */
export function thesisDocument(input: ThesisDocumentInput): string {
  return (
    [
      "<!-- Generated by `npm run thesis` from GET /api/thesis. Edit src/content/, src/lib/thesis/ or src/app/api/thesis/markdown/, not this file. -->",
      header(input),
      abstract(input),
      introduction(),
      dataAndMethod(input),
      demandSection(input),
      captureSection(input),
      supplySection(input),
      valuationSection(input),
      technologySection(input),
      networkSection(input),
      peersSection(input),
      leadLagSection(input, LEAD_LAG_SECTION),
      breakingPointTable(input),
      notMeasured(input, NOT_MEASURED_SECTION),
      howToReproduce(REPRODUCE_SECTION),
      sectionHeading("Appendix A. Formulas", "🧮"),
      FORMULAS.map((formula) => `- ${formula}`).join("\n"),
      sectionHeading("Disclosure", "📝"),
      DISCLOSURE,
      FOOTER,
    ].join("\n\n") + "\n"
  );
}
