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
import { formatBps, formatMultiple, formatUsd } from "@/lib/format";
import { dayTime } from "@/lib/metrics";
import { MONTH_SECONDS, project, projectedVolumeUsd, seedInput, type ProjectionSeed } from "@/lib/projection";

/** A monthly volume growth measured from the stored data, offered as a starting point. */
export type VolumePace = { label: string; growth: number };

/** Percent a month on the slider's 0.5-point step, so a preset puts the thumb exactly where its label says. */
const toPercent = (growth: number) => Math.round(growth * 200) / 2;

/** NEAR Intents volume projected at a chosen monthly growth, and the month, if any, in which the NEAR it buys plus the
    burn matches issuance: the Valuation projection, with NEAR bought following volume at today's price and the 30-day
    share of volume that buys NEAR. */
export function VolumeOutlook({ seed, paces }: { seed: ProjectionSeed; paces: VolumePace[] }) {
  const [growth, setGrowth] = useState(0);
  const volumes = useMemo(() => projectedVolumeUsd(seed, MONTHS, growth / 100), [seed, growth]);
  const rows = useMemo(() => project({ ...seedInput(seed, MONTHS), buybackGrowth: growth / 100 }), [seed, growth]);

  const matched = rows.find((row) => row.coverage >= 1);
  const volumeIn = (month: number) => volumes[month - 1]!;
  const start = dayTime(seed.through);
  /** A pace that rounds to an earlier preset's growth is left out, so at most one preset shows as pressed. */
  const presets = [{ label: "No growth", growth: 0 }, ...paces.map((pace) => ({ label: `${pace.label} ${signedPercent(toPercent(pace.growth))}/mo`, growth: toPercent(pace.growth) }))].filter(
    (preset, i, all) => all.findIndex((other) => other.growth === preset.growth) === i,
  );

  return (
    <div className="flex min-w-0 flex-col">
      <div
        role="group"
        aria-label="Volume growth presets"
        className="flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_left,transparent,#000_24px)]"
      >
        {presets.map((preset) => (
          <PillButton key={preset.label} pressed={growth === preset.growth} onClick={() => setGrowth(preset.growth)} className="shrink-0 text-[12.5px]">
            {preset.label}
          </PillButton>
        ))}
      </div>
      <div className="mt-3">
        <Slider
          label="Growth of NEAR Intents volume per month"
          value={growth}
          min={Math.min(-20, ...presets.map((preset) => preset.growth))}
          max={Math.max(40, ...presets.map((preset) => preset.growth))}
          step={0.5}
          display={signedPercent(growth)}
          onChange={setGrowth}
        />
      </div>
      <MetricStrip
        className="mt-4"
        metrics={[
          { label: "Volume a month now", value: formatUsd(volumeIn(1)), detail: `The 30 days to ${seed.through}, scaled to a month` },
          { label: "Volume a month in month 12", value: formatUsd(volumeIn(12)), detail: `${formatMultiple(volumeIn(12) / volumeIn(1), 1)} today's` },
          { label: `Volume a month in month ${MONTHS}`, value: formatUsd(volumeIn(MONTHS)), detail: `${formatUsd(volumeIn(MONTHS) * 12)} a year at that pace` },
          {
            label: "Burn + buybacks match issuance",
            value: matched ? `Month ${matched.month}` : "Not reached",
            detail: matched
              ? (usedUpNote(rows) ?? "At today's price and share of volume that buys NEAR")
              : `Not within ${MONTHS} months at today's price and share of volume that buys NEAR`,
          },
        ]}
      />
      <div className="mt-4">
        <LineChart
          series={[{ name: "Volume a month", points: volumes.map((value, i) => ({ time: start + (i + 1) * MONTH_SECONDS, value })) }]}
          format="usd"
          title="Projected NEAR Intents volume a month"
          height={200}
          zeroBaseline
        />
      </div>
      <HowCalculated>
        Starts from NEAR Intents volume over the 30 days to <NoBreakTokens text={seed.through} />, scaled to a month (× 365 ÷ 30 ÷ 12):{" "}
        {formatUsd(seed.volumeUsdPerMonth)}, and grows it at the chosen rate every
        month for {MONTHS} months. NEAR bought grows with it, because the share of volume that buys NEAR
        {seed.takeRate === null ? "" : ` (${formatBps(seed.takeRate)})`} and today&apos;s price are held; today&apos;s max issuance also stays as it is, the same
        projection as the Valuation page. The burn each month is the gas fees of those 30 days, scaled to a month, with {burnNote(seed)}. The 90-day pace is the
        last 90 days&apos; volume against the 90 days before as a monthly rate; year on year is the last 30 days against the same 30 days a year earlier as a monthly
        rate. The model on the Revenue page also has sliders for the fee rate, the share of fees that buys NEAR and the price.
      </HowCalculated>
    </div>
  );
}

/** Loading placeholder of VolumeOutlook: the growth presets, the slider, the numbers, the chart and the notes line. */
export function VolumeOutlookSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col">
      <PillRowSkeleton labels={[9, 19, 19]} />
      <div className="mt-3">
        <SliderSkeleton label={39} />
      </div>
      <MetricStripSkeleton
        className="mt-4"
        metrics={[
          { label: 18, detail: 44 },
          { label: 26, detail: 12 },
          { label: 26, detail: 27 },
          { label: 30, detail: 72 },
        ]}
      />
      <div className="mt-4">
        <LineChartSkeleton height={200} />
      </div>
      <HowCalculatedSkeleton />
    </div>
  );
}
