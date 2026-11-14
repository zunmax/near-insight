/** The valuation section: the growth of NEAR bought against the growth needed, revenue multiples, break-even and the scenarios. */
import { boughtGrowth, COINGECKO_MARKETS, COINGECKO_NEAR_CHART, DASH, day, daysTo, reading, show, table, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section, sectionNumber } from "@/app/api/thesis/markdown/section";
import { COVERAGE_HORIZON_MONTHS, REQUIREMENT_HORIZON_MONTHS, REQUIREMENT_PRICE_MULTIPLES } from "@/config/projections";
import { HSP029 } from "@/config/protocol";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import { digitsApart, formatChange, formatChangeFromZero, formatCount, formatMonths, formatMultiple, formatPercent, formatPercentFromFull, formatUsd, usdDigitsApart } from "@/lib/format";
import { isoDay, type BreakEven } from "@/lib/metrics";
import { growthTerms, modelInputs, modelScenarios, scenarioOutcome, type CoverageScenario } from "@/lib/projection";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { proposalFailed } from "@/lib/thesis/proposal-status";
import { growthNeededValue, valuationDigits } from "@/lib/thesis/triggers";

function breakEvenRows(e: BreakEven | null, days: number, t: string | null): string[][] {
  /** The volume needed and today's volume print with the decimals that tell them apart. */
  const digits = e?.volumePerDayUsd == null ? 2 : usdDigitsApart(e.volumePerDayUsd, e.currentVolumePerDayUsd);
  return [
    ["Break-even multiple: NEAR minted ÷ (NEAR burned + bought)", show(e?.multiple, (v) => formatMultiple(v, 2)), daysTo(days, t)],
    [
      "Intents volume a day at which burn + buybacks match issuance",
      e?.volumePerDayUsd == null ? DASH : `${formatUsd(e.volumePerDayUsd, digits)} (average over the same days ${formatUsd(e.currentVolumePerDayUsd, digits)})`,
      daysTo(days, t),
    ],
  ];
}

/** NEAR bought in the stress scenarios that cut it, as the scenario table's growth column names it. */
const BUYING_CUT_NAMES: Partial<Record<CoverageScenario["id"], string>> = {
  "buying-stops": "None bought",
  "bought-halves": "Half of today's pace, no growth",
};

/** The Valuation page's scenarios (up to three) and the stress scenarios: growth, the month burn + buybacks reach issuance, the
    share absorbed at the horizon and the volume it needs. */
function scenarioTable(m: ThesisMetrics): string | null {
  const { intents } = m;
  const inputs = modelInputs(m, m.hsp029 !== null && proposalFailed(m.hsp029));
  if (!inputs || !intents) return null;
  const rows = modelScenarios(inputs).map((scenario) => {
    const { reachedMonth, finalCoverage, volumePerYearUsd, timesRunRate, perYear, multiple } = scenarioOutcome(scenario, inputs.seed, intents.total30d);
    const growth =
      BUYING_CUT_NAMES[scenario.id] ??
      (scenario.growth === 0
        ? "No growth"
        : `${formatChange(scenario.growth, digitsApart(scenario.growth * 100, 0, 1))} a month for ${scenario.growthMonths} months (${formatChangeFromZero(perYear)} a year, ${formatMultiple(multiple, digitsApart(multiple, 1, 1))} in total)`);
    return [
      scenario.name,
      growth,
      reachedMonth !== null ? `Month ${reachedMonth}` : `Not by month ${COVERAGE_HORIZON_MONTHS}`,
      formatPercentFromFull(finalCoverage, 0),
      volumePerYearUsd === null ? DASH : `${formatUsd(volumePerYearUsd)}${timesRunRate === null ? "" : ` (${formatMultiple(timesRunRate, 1)} the 30-day run rate)`}`,
    ];
  });
  return table(["Scenario", "Growth of NEAR bought", "Month burn + buybacks reach issuance", `Share of issuance absorbed in month ${COVERAGE_HORIZON_MONTHS}`, `Intents volume a year in month ${COVERAGE_HORIZON_MONTHS}`], rows);
}

export function valuationSection(input: ThesisDocumentInput): string {
  const m = input.metrics;
  const { valuation: v, buybacks: b, supply: s, market, breakEven: e, dataThrough: t, revenueMultiple: r } = m;
  const runRate = `${daysTo(30, t)}, × 365 ÷ 30${input.marketAsOf ? `, at the price of ${day(input.marketAsOf)}` : ""}`;
  const multipleSince = r ? `since ${isoDay(r.daily[0]!.time)}` : DASH;
  const scenarios = scenarioTable(m);
  /** The growth, its range and the growth needed print with the decimals that tell them apart, as the breaking point compares them unrounded. */
  const digits = valuationDigits(m);
  return section(
    "valuation",
    input,
    [
      ["Monthly growth rate of NEAR bought", boughtGrowth(b, digits), `${daysTo(90, t)}, against the 90 days before`],
      [
        `Monthly growth rate of NEAR bought needed for burn + buybacks to match monthly issuance by the end of ${formatMonths(COVERAGE_HORIZON_MONTHS)}, burn held at its current rate`,
        show(v?.requiredMonthlyGrowth, (g) => (g <= -1 ? growthNeededValue(g, digits) : `${formatChange(g, digits)} (${formatChangeFromZero(growthTerms(g, 12).perYear)} a year)`)),
        `from the ${daysTo(30, t)}`,
      ],
      ["Market cap", show(market?.marketCapUsd, formatUsd), reading(input.marketAsOf)],
      ["Burn + buybacks a year, run rate", show(v?.tokenRevenueRunRateUsd, formatUsd), runRate],
      ["Market cap ÷ (burn + buybacks a year)", show(v?.multiple, (x) => formatMultiple(x)), runRate],
      [`Burn + buybacks a year ÷ market cap${s ? ` (against max issuance of ${formatMaxIssuance(s.maxInflationRate)} a year)` : ""}`, show(v?.holderYield, (y) => formatPercent(y, 2)), runRate],
      [
        "Market cap ÷ network revenue (Intents revenue + gas fees), 30 days annualized",
        show(r?.latest.value, (x) => formatMultiple(x)),
        r ? `on ${isoDay(r.latest.time)}` : DASH,
      ],
      ["Same multiple, median and range", r ? `${formatMultiple(r.median)} (${formatMultiple(r.low)} to ${formatMultiple(r.high)})` : DASH, multipleSince],
      [
        "Market cap at that median and range on the latest yearly network revenue (against its own history, not a fair value)",
        r ? `${formatUsd(r.impliedMarketCapUsd.median)} (${formatUsd(r.impliedMarketCapUsd.low)} to ${formatUsd(r.impliedMarketCapUsd.high)})` : DASH,
        r ? `revenue of the 30 days to ${isoDay(r.latest.time)}, multiples ${multipleSince}` : DASH,
      ],
      ...breakEvenRows(e?.d30 ?? null, 30, t),
      ...breakEvenRows(e?.d90 ?? null, 90, t),
    ],
    [
      scenarios
        ? `**Scenarios.** Each runs month by month from the ${daysTo(30, t)}. Unless a scenario changes them, the price and the max issuance rate stay at today's level and the burn at its current rate.\n\n${scenarios}`
        : "**Scenarios:** the database does not cover their inputs yet.",
      `The growth needed applies to NEAR bought alone, so it compares directly with the measured growth. It holds the price and the max issuance rate at today's level and the burn at its current rate, while supply keeps growing. The last rows stress the case: buying stops (no protocol rule requires it), NEAR bought halves (as at twice today's price, or with half the buyback dollars), and max issuance ramps to ${formatPercent(HSP029.targetRate, 1)} under HSP-029. At a higher price the same buyback dollars buy less NEAR, so more growth is needed. The burn does not depend on price, because gas is paid in NEAR. The Valuation page shows the growth needed at ${formatCount(REQUIREMENT_PRICE_MULTIPLES.length, "price")} and ${formatCount(REQUIREMENT_HORIZON_MONTHS.length, "horizon")}, and a model in which the reader can change the price, the monthly growth of NEAR bought and of gas fees, ${m.seed?.fullBurn === false ? "the max issuance (HSP-029) and the share of gas fees burned" : "and the max issuance (HSP-029)"}.`,
    ],
    `\`GET /api/model\` on the dashboard returns the same scenarios month by month as CSV, with the inputs they start from. The inputs come from the requests in sections ${sectionNumber("demand")} to ${sectionNumber("supply")}, CoinGecko \`GET ${COINGECKO_MARKETS}\` (price and market cap) and \`GET ${COINGECKO_NEAR_CHART}\` (\`market_caps\`, the daily market cap behind the revenue multiple).`,
  );
}
