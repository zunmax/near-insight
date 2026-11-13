"use client";

import { useState } from "react";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { SERIES_COLORS, type ValueFormat } from "@/components/charts/chart-format";
import { MetricStrip, MetricStripSkeleton, type Metric } from "@/components/ui/MetricStrip";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { PillButton, PillRowSkeleton } from "@/components/ui/PillButton";
import type { DailyPoint } from "@/lib/metrics";

export type ScenarioView = { name: string; assumption?: string; metrics: Metric[]; points: DailyPoint[] };

/** Projection scenarios: a pill per scenario opens its assumption and numbers; the chart compares all of them. */
export function ScenarioPicker({
  scenarios,
  chartTitle,
  initial,
  format = "percent",
  zeroBaseline = true,
}: {
  scenarios: ScenarioView[];
  chartTitle: string;
  initial: number;
  format?: ValueFormat;
  zeroBaseline?: boolean;
}) {
  const [selected, setSelected] = useState(initial);
  const scenario = scenarios[selected]!;

  return (
    <div className="flex min-w-0 flex-col">
      <div
        role="group"
        aria-label="Scenario"
        className="flex flex-wrap gap-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_left,transparent,#000_24px)]"
      >
        {scenarios.map((s, i) => (
          <PillButton key={s.name} pressed={i === selected} onClick={() => setSelected(i)} className="shrink-0 text-[12.5px]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
            {s.name}
          </PillButton>
        ))}
      </div>
      {scenario.assumption ? <p className="mt-3 text-[13px] leading-snug text-ink-2">{scenario.assumption}</p> : null}
      <MetricStrip className={scenario.assumption ? "mt-2" : "mt-3"} metrics={scenario.metrics} />
      <div className="mt-4">
        <LineChart
          series={scenarios.map((s) => ({ name: s.name, points: s.points }))}
          format={format}
          title={chartTitle}
          height={200}
          zeroBaseline={zeroBaseline}
          legend={false}
        />
      </div>
    </div>
  );
}

/** Loading placeholder of a ScenarioPicker: the scenario pills (`pills`, each name's length, with room for its dot), the
    assumption's length when scenarios have one, the numbers (`metrics`, as MetricStripSkeleton) and the chart. */
export function ScenarioPickerSkeleton({ pills, assumption, metrics }: { pills: number[]; assumption?: number; metrics: Array<{ label: number; detail?: number }> }) {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col">
      <PillRowSkeleton labels={pills.map((chars) => chars + 2)} />
      {assumption ? (
        <p className="mt-3 text-[13px] leading-snug">
          <SkeletonWords chars={assumption} />
        </p>
      ) : null}
      <MetricStripSkeleton className={assumption ? "mt-2" : "mt-3"} metrics={metrics} />
      <div className="mt-4">
        <LineChartSkeleton height={200} />
      </div>
    </div>
  );
}
