import { io } from "next/cache";
import { burnNote } from "@/components/projections/projection-notes";
import { ScenarioPicker, ScenarioPickerSkeleton, type ScenarioView } from "@/components/projections/ScenarioPicker";
import { HowCalculated, HowCalculatedSkeleton } from "@/components/ui/HowCalculated";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { COVERAGE_HORIZON_MONTHS, RECENT_PACE_MONTHS } from "@/config/projections";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { digitsApart, formatBps, formatChangeFromZero, formatCompact, formatCount, formatMonths, formatMultiple, formatNear, formatPercent, formatPercentFromFull, formatUsd } from "@/lib/format";
import { dayTime } from "@/lib/metrics";
import { MONTH_SECONDS, scenarioOutcome, valuationScenarios, type CoverageScenario } from "@/lib/projection";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = `NEAR burned + bought against issuance, next ${formatMonths(COVERAGE_HORIZON_MONTHS)}`;

/** Up to three scenarios (no growth, growth needed, 90-day pace) of how much of each month's issuance burn plus
    buybacks absorb, from today's live values. */
export async function CoverageScenariosPanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { seed, buybacks, valuation, intents } = metrics;
  const recent = buybacks?.monthlyGrowth ?? null;
  const needed = valuation?.requiredMonthlyGrowth ?? null;
  if (!seed || !intents) return <NoData title={TITLE} />;

  const window = windowName(metrics, "30 days");
  /** "grows 4.9% a month", "falls 0.04% a month" (with the decimals that tell it from zero) or "holds flat". */
  const pace = (rate: number) =>
    rate === 0 ? "holds flat" : `${rate < 0 ? "falls" : "grows"} ${formatPercent(Math.abs(rate), digitsApart(rate * 100, 0, 1))} a month`;
  const assumptions: Partial<Record<CoverageScenario["id"], string>> = {
    "no-growth": `NEAR burned and bought stay at the pace of the ${window}`,
    "growth-needed": needed === null ? "" : `NEAR bought ${pace(needed)}; burn holds at the pace of the ${window}`,
    "recent-pace": recent === null ? "" : `NEAR bought ${pace(recent)} for ${formatCount(RECENT_PACE_MONTHS, "month")}, then holds; burn holds throughout`,
  };
  const start = dayTime(seed.through);
  const views: ScenarioView[] = valuationScenarios(seed, metrics).map((scenario) => {
    const { reachedMonth, finalCoverage, volumePerYearUsd, timesRunRate, perYear, multiple } = scenarioOutcome(scenario, seed, intents.total30d);
    return {
      name: scenario.name,
      assumption: assumptions[scenario.id],
      metrics: [
        reachedMonth !== null
          ? { label: "Reaches 100%", value: `Month ${reachedMonth}` }
          : { label: "Reaches 100%", value: "Not reached", detail: `Within ${formatMonths(COVERAGE_HORIZON_MONTHS)}` },
        /** Enough decimals that a share slightly under 100% never reads "100%" beside "Not reached". */
        { label: `Absorbed in month ${COVERAGE_HORIZON_MONTHS}`, value: formatPercentFromFull(finalCoverage, 0) },
        scenario.growth === 0
          ? { label: "Growth", value: "None" }
          : {
              label: "Growth",
              value: `${formatChangeFromZero(perYear)}/yr`,
              detail: `${formatMultiple(multiple, digitsApart(multiple, 1, 1))} over ${formatCount(scenario.growthMonths, "month")}`,
            },
        {
          label: `Yearly Intents volume, month ${COVERAGE_HORIZON_MONTHS}`,
          value: volumePerYearUsd === null ? "—" : formatUsd(volumePerYearUsd),
          detail: timesRunRate === null ? undefined : `${formatMultiple(timesRunRate, 1)} the 30-day run rate`,
        },
      ],
      points: scenario.rows.map((row) => ({ time: start + row.month * MONTH_SECONDS, value: Math.min(1, row.coverage) })),
    };
  });

  return (
    <Panel
      title={TITLE}
      sources={["coingecko", "nearRpc", "nearArchive", "dune", "defillama"]}
      sqlId="projection-inputs"
    >
      {/** Keyed by the scenarios shown, so a page kept alive between visits starts over when one is added or dropped. */}
      <ScenarioPicker
        key={views.map((view) => view.name).join("|")}
        scenarios={views}
        initial={views.length - 1}
        chartTitle="Share of issuance absorbed by burn and buybacks each month, by scenario (capped at 100%)"
      />
      <HowCalculated>
        Starts from the 30 days to <NoBreakTokens text={seed.through} />: {formatNear(seed.boughtNearPerMonth)} bought a month (that period&apos;s
        buyback dollars at today&apos;s price) and {formatCompact(seed.feesNearPerMonth * seed.burnShareOfFees)} NEAR burned a month ({formatCompact(seed.feesNearPerMonth)} NEAR of
        gas fees, with {burnNote(seed)}). Issuance is today&apos;s max rate of {formatMaxIssuance(seed.maxInflationRate)} a year, and the price is today&apos;s{" "}
        {formatUsd(seed.priceUsd)}. Burned NEAR leaves total supply. Bought NEAR is held off the market in the three fee wallets; it is not burned, so it stays in
        total supply and in circulating supply. Yearly Intents volume is the volume a year needed to buy NEAR at the
        scenario&apos;s pace in its last month. It uses today&apos;s price and the share of volume that bought NEAR over the same 30 days
        {seed.takeRate === null ? "" : ` (${formatBps(seed.takeRate)})`}, as break-even does. The 30-day run rate is the Intents volume of those 30 days,
        annualized.
      </HowCalculated>
    </Panel>
  );
}

/** Loading placeholder of CoverageScenariosPanel: a pill per scenario, the open one's assumption and numbers, and the chart. */
export function CoverageScenariosPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <ScenarioPickerSkeleton
        pills={[9, 13, 25]}
        assumption={80}
        metrics={[
          { label: "Reaches 100%".length },
          { label: `Absorbed in month ${COVERAGE_HORIZON_MONTHS}`.length },
          { label: "Growth".length, detail: 19 },
          { label: `Yearly Intents volume, month ${COVERAGE_HORIZON_MONTHS}`.length, detail: 24 },
        ]}
      />
      <HowCalculatedSkeleton />
    </PanelSkeleton>
  );
}
