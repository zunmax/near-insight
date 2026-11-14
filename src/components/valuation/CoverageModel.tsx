"use client";

import { useMemo, useState } from "react";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { Choice, signedPercent as signed, Slider, SliderSkeleton } from "@/components/projections/ModelControls";
import { burnNote, rampNote, usedUpNote } from "@/components/projections/projection-notes";
import { HowCalculated, HowCalculatedSkeleton } from "@/components/ui/HowCalculated";
import { MetricStrip, MetricStripSkeleton } from "@/components/ui/MetricStrip";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { PillButton, PillRowSkeleton } from "@/components/ui/PillButton";
import { COVERAGE_HORIZON_MONTHS as MONTHS } from "@/config/projections";
import { FULL_BURN_PROTOCOL, HSP029 } from "@/config/protocol";
import { formatChange, formatNear, formatPercent, formatPercentFromFull, formatUsd } from "@/lib/format";
import { dayTime } from "@/lib/metrics";
import { MONTH_SECONDS, modelInput, modelOutcome, project, type ProjectionSeed } from "@/lib/projection";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";

type Input = "price" | "bought" | "fees" | "issuance" | "burn";

/** Interactive projection of issuance coverage. Every input starts at the live value from the database;
    each pill shows an input's current value and opens its control. */
export function CoverageModel({ seed, hsp029Status, hsp029Failed }: { seed: ProjectionSeed; hsp029Status: string | null; hsp029Failed: boolean }) {
  const [editing, setEditing] = useState<Input>("price");
  const [priceMultiple, setPriceMultiple] = useState(1);
  const [buybackGrowth, setBuybackGrowth] = useState(0);
  const [feeGrowth, setFeeGrowth] = useState(0);
  const [issuance, setIssuance] = useState<"today" | "hsp029">("today");
  const [burn, setBurn] = useState<"today" | "full">("today");

  const price = seed.priceUsd * priceMultiple;
  const rows = useMemo(
    () =>
      project(
        modelInput(seed, MONTHS, {
          priceMultiple,
          targetInflationRate: issuance === "hsp029" ? HSP029.targetRate : null,
          burnShareOfFees: burn === "full" ? 1 : seed.burnShareOfFees,
          buybackGrowth: buybackGrowth / 100,
          feeGrowth: feeGrowth / 100,
        }),
      ),
    [priceMultiple, seed, issuance, burn, buybackGrowth, feeGrowth],
  );

  const { firstCoverage, lastCoverage, reachedMonth, supplyGrowthPerYear, heldNear } = modelOutcome(rows, seed);
  /** Once burn and buying have taken all NEAR, each month takes exactly what it mints, so it reads 100%. */
  const usedUp = usedUpNote(rows);
  const start = dayTime(seed.through);
  const coveragePoints = rows.map((r) => ({ time: start + r.month * MONTH_SECONDS, value: r.coverage }));
  const issuanceOptions = [
    { value: "today" as const, label: `${formatMaxIssuance(seed.maxInflationRate)} today` },
    { value: "hsp029" as const, label: `${formatPercent(HSP029.targetRate, 1)} (HSP-029)` },
  ];
  /** Once mainnet burns every gas fee, today's share is already 100%, so there is nothing to switch to. */
  const burnOptions = seed.fullBurn
    ? [{ value: "today" as const, label: "100% today" }]
    : [
        { value: "today" as const, label: `${formatPercent(seed.burnShareOfFees, 0)} measured` },
        { value: "full" as const, label: `100% (protocol ${FULL_BURN_PROTOCOL})` },
      ];

  const pills: Array<{ input: Input; label: string }> = [
    { input: "price", label: `Price ${formatUsd(price)}` },
    { input: "bought", label: `NEAR bought ${signed(buybackGrowth)}/mo` },
    { input: "fees", label: `Gas fees ${signed(feeGrowth)}/mo` },
    { input: "issuance", label: `Max issuance ${issuance === "hsp029" ? formatPercent(HSP029.targetRate, 1) : formatMaxIssuance(seed.maxInflationRate)}` },
    { input: "burn", label: `Gas fees burned ${burn === "full" ? "100%" : formatPercent(seed.burnShareOfFees, 0)}` },
  ];

  return (
    <div className="flex min-w-0 flex-col">
      <div
        role="group"
        aria-label="Model inputs"
        className="flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_left,transparent,#000_24px)]"
      >
        {pills.map((pill) => (
          <PillButton key={pill.input} pressed={editing === pill.input} onClick={() => setEditing(pill.input)} className="shrink-0 text-[12.5px]">
            {pill.label}
          </PillButton>
        ))}
      </div>
      <div className="mt-3">
        {editing === "price" ? (
          <Slider
            label="NEAR price"
            value={priceMultiple}
            min={0.25}
            max={4}
            step={0.05}
            display={`${formatUsd(price)} (${priceMultiple.toFixed(2)}× today)`}
            onChange={setPriceMultiple}
          />
        ) : null}
        {editing === "bought" ? (
          <Slider label="Growth of NEAR bought per month" value={buybackGrowth} min={-20} max={40} step={0.5} display={signed(buybackGrowth)} onChange={setBuybackGrowth} />
        ) : null}
        {editing === "fees" ? <Slider label="Gas fee growth per month" value={feeGrowth} min={-20} max={40} step={0.5} display={signed(feeGrowth)} onChange={setFeeGrowth} /> : null}
        {editing === "issuance" ? <Choice label="Max issuance" value={issuance} onChange={setIssuance} options={issuanceOptions} /> : null}
        {editing === "burn" ? <Choice label="Share of gas fees burned" value={burn} onChange={setBurn} options={burnOptions} /> : null}
      </div>
      <MetricStrip
        className="mt-4"
        metrics={[
          { label: "Absorbed in month 1", value: formatPercentFromFull(firstCoverage, 0), detail: "Burned + bought ÷ issuance at the max rate" },
          { label: `Absorbed in month ${MONTHS}`, value: formatPercentFromFull(lastCoverage, 0), detail: usedUp ?? "Under these assumptions" },
          {
            label: "Reaches 100%",
            value: reachedMonth !== null ? `Month ${reachedMonth}` : "Not reached",
            detail: reachedMonth !== null ? "Burned + bought equals that month's issuance" : `Burned + bought stays below issuance for all ${MONTHS} months`,
          },
          { label: "Total supply growth", value: `${formatChange(supplyGrowthPerYear, 2)}/yr`, detail: `Net of burn; ${formatNear(heldNear)} bought stays in supply` },
        ]}
      />
      <div className="mt-4">
        <LineChart
          series={[{ name: "Absorbed", points: coveragePoints }]}
          format="percent"
          title="Projected share of issuance absorbed by burn and buybacks each month"
          height={200}
          zeroBaseline
        />
      </div>
      <HowCalculated>
        Starts from the 30 days to <NoBreakTokens text={seed.through} />: {formatNear(seed.boughtNearPerMonth)} bought a month (that period&apos;s buyback
        dollars at today&apos;s price) and {formatNear(seed.feesNearPerMonth)} of gas fees a month, with {burnNote(seed)}, at today&apos;s price and supply. At
        another price the same buyback dollars buy more or less NEAR; the burn stays the same, because gas is paid in NEAR. Burned NEAR leaves total supply.
        Bought NEAR is held off the market in the three fee wallets; it is not burned, so it stays in total supply and in circulating supply.{" "}
        <NoBreakTokens text={`HSP-029 is modeled as ${rampNote(seed, hsp029Failed)}.${hsp029Status ? ` ${hsp029Status}` : ""}`} />
      </HowCalculated>
    </div>
  );
}

/** Loading placeholder of CoverageModel: the input pills, the slider, the numbers, the chart and the notes line. */
export function CoverageModelSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col">
      <PillRowSkeleton labels={[13, 19, 16, 19, 22]} />
      <div className="mt-3">
        <SliderSkeleton label={10} />
      </div>
      <MetricStripSkeleton
        className="mt-4"
        metrics={[
          { label: 19, detail: 42 },
          { label: 20, detail: 23 },
          { label: 12, detail: 54 },
          { label: 19, detail: 46 },
        ]}
      />
      <div className="mt-4">
        <LineChartSkeleton height={200} />
      </div>
      <HowCalculatedSkeleton />
    </div>
  );
}
