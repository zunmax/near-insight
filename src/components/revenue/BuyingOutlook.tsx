"use client";

import { useMemo, useState } from "react";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { signedPercent, Slider, SliderSkeleton } from "@/components/projections/ModelControls";
import { burnNote, usedUpNote } from "@/components/projections/projection-notes";
import { HowCalculated, HowCalculatedSkeleton } from "@/components/ui/HowCalculated";
import { MetricStrip, MetricStripSkeleton } from "@/components/ui/MetricStrip";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { PillButton, PillRowSkeleton } from "@/components/ui/PillButton";
import { COVERAGE_HORIZON_MONTHS as MONTHS } from "@/config/projections";
import { digitsApart, formatNear, formatPercent, formatPercentFromFull, formatUsd } from "@/lib/format";
import { dayTime } from "@/lib/metrics";
import { feeChainInput, MONTH_SECONDS, project, type ProjectionSeed } from "@/lib/projection";

type Input = "volume" | "fees" | "capture" | "price";

/** Measured rates the model starts from: fees ÷ volume over the 30 days to `feesThrough`, and the share of fees that buys NEAR. */
type FeeChainRates = { feeRate: number; captureRate: number; feesThrough: string };

/** A month's NEAR bought as a share of its issuance, with up to four decimals so a small share above zero does not print as 0.0%. */
function ofIssuance({ boughtNear, issuanceNear }: { boughtNear: number; issuanceNear: number }): string {
  const share = issuanceNear > 0 ? boughtNear / issuanceNear : 0;
  return `${formatPercent(share, digitsApart(share * 100, 0, 1))} of that month's issuance`;
}

/** Interactive projection of the NEAR that NEAR Intents fees buy each month: volume × fee rate × the share that buys NEAR
    ÷ price, against the NEAR issued. At its starting values it buys what the Valuation projections start from. */
export function BuyingOutlook({ seed, rates }: { seed: ProjectionSeed; rates: FeeChainRates }) {
  const measuredFeePerMillion = rates.feeRate * 1_000_000;
  const [editing, setEditing] = useState<Input>("volume");
  const [volumeGrowth, setVolumeGrowth] = useState(0);
  const [feePerMillion, setFeePerMillion] = useState(measuredFeePerMillion);
  const [capturePercent, setCapturePercent] = useState(rates.captureRate * 100);
  const [priceMultiple, setPriceMultiple] = useState(1);

  const rows = useMemo(
    () =>
      project(
        feeChainInput(seed, MONTHS, {
          volumeGrowth: volumeGrowth / 100,
          feeRate: feePerMillion / 1_000_000,
          captureRate: capturePercent / 100,
          priceMultiple,
        }),
      ),
    [seed, volumeGrowth, feePerMillion, capturePercent, priceMultiple],
  );

  const first = rows[0]!;
  const last = rows.at(-1)!;
  const totalBought = rows.reduce((sum, row) => sum + row.boughtNear, 0);
  const price = seed.priceUsd * priceMultiple;
  const start = dayTime(seed.through);
  const at = (month: number) => start + month * MONTH_SECONDS;
  /** Slider maximum, with room to try fees well above the measured rate. */
  const feeMax = Math.max(100, Math.ceil((measuredFeePerMillion * 3) / 50) * 50);

  const pills: Array<{ input: Input; label: string }> = [
    { input: "volume", label: `Volume ${signedPercent(volumeGrowth)}/mo` },
    { input: "fees", label: `Fees ${formatUsd(feePerMillion)} per $1M` },
    { input: "capture", label: `${formatPercent(capturePercent / 100, 0)} of fees buy NEAR` },
    { input: "price", label: `Price ${formatUsd(price)}` },
  ];

  return (
    <div className="flex min-w-0 flex-col">
      <div
        role="group"
        aria-label="Model inputs"
        className="flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[mask-image:linear-gradient(to_left,transparent,#000_24px)] max-sm:[scrollbar-width:none]"
      >
        {pills.map((pill) => (
          <PillButton key={pill.input} pressed={editing === pill.input} onClick={() => setEditing(pill.input)} className="shrink-0 text-[12.5px]">
            {pill.label}
          </PillButton>
        ))}
      </div>
      <div className="mt-3">
        {editing === "volume" ? (
          <Slider label="Growth of NEAR Intents volume per month" value={volumeGrowth} min={-20} max={40} step={0.5} display={signedPercent(volumeGrowth)} onChange={setVolumeGrowth} />
        ) : null}
        {editing === "fees" ? (
          <Slider
            label="NEAR Intents fees per $1M swapped"
            value={feePerMillion}
            min={0}
            max={feeMax}
            step="any"
            display={`${formatUsd(feePerMillion)} (measured ${formatUsd(measuredFeePerMillion)})`}
            onChange={setFeePerMillion}
          />
        ) : null}
        {editing === "capture" ? (
          <Slider
            label="Share of fees that buys NEAR"
            value={capturePercent}
            min={0}
            max={100}
            step="any"
            display={`${formatPercent(capturePercent / 100, 0)} (starting ${formatPercent(rates.captureRate, 0)})`}
            onChange={setCapturePercent}
          />
        ) : null}
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
      </div>
      <MetricStrip
        className="mt-4"
        metrics={[
          { label: "NEAR bought in month 1", value: formatNear(first.boughtNear), detail: ofIssuance(first) },
          { label: `NEAR bought in month ${MONTHS}`, value: formatNear(last.boughtNear), detail: ofIssuance(last) },
          { label: `NEAR bought over ${MONTHS} months`, value: formatNear(totalBought), detail: usedUpNote(rows) ?? "Held in the three fee wallets, still in total supply" },
          { label: `Burn + buybacks ÷ issuance, month ${MONTHS}`, value: formatPercentFromFull(last.coverage, 0), detail: "Assumes the burn stays at its starting amount each month" },
        ]}
      />
      <div className="mt-4">
        <LineChart
          series={[
            { name: "NEAR bought", points: rows.map((row) => ({ time: at(row.month), value: row.boughtNear })) },
            { name: "NEAR issued", points: rows.map((row) => ({ time: at(row.month), value: row.issuanceNear })) },
          ]}
          format="near"
          title="Projected NEAR bought and NEAR issued each month"
          height={200}
          zeroBaseline
        />
      </div>
      <HowCalculated>
        <NoBreakTokens
          text={`Each month: NEAR Intents volume × fees per $1M swapped ÷ 1M × the share of fees that buys NEAR ÷ the NEAR price = NEAR bought. It starts from the 30 days to ${seed.through}, scaled to a month: ${formatUsd(seed.volumeUsdPerMonth)} of volume, ${formatUsd(measuredFeePerMillion)} of fees per $1M swapped${rates.feesThrough === seed.through ? "" : ` (over the 30 days to ${rates.feesThrough}, the last full day of fees)`} and ${formatPercent(rates.captureRate, 1)} of fees buying NEAR${rates.feesThrough === seed.through ? "" : ` (buybacks ÷ volume over the 30 days to ${seed.through}, ÷ that fee rate)`}. Together they buy the ${formatNear(seed.boughtNearPerMonth)} a month the Valuation projections start from. NEAR issued comes from today's supply and max issuance, with ${burnNote(seed)}. No protocol rule makes the app operators spend fees on NEAR, so 0% shows what happens if they stop.`}
        />
      </HowCalculated>
    </div>
  );
}

/** Loading placeholder of BuyingOutlook: the input pills, the slider, the numbers, the chart with its legend and the notes line. */
export function BuyingOutlookSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col">
      <PillRowSkeleton labels={[12, 19, 20, 11]} />
      <div className="mt-3">
        <SliderSkeleton label={39} />
      </div>
      <MetricStripSkeleton
        className="mt-4"
        metrics={[
          { label: 22, detail: 30 },
          { label: 23, detail: 30 },
          { label: 26, detail: 52 },
          { label: 36, detail: 56 },
        ]}
      />
      <div className="mt-4">
        <LineChartSkeleton height={200} legend={[11, 11]} />
      </div>
      <HowCalculatedSkeleton />
    </div>
  );
}
