"use client";

import { useState } from "react";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";

export type PriceGrowth = { price: string; tag: string; today: boolean; periods: Array<{ label: string; value: string; detail?: string }> };

/** The periods' tiles: one column in a narrow box, three side by side from 560px, where each tile fits its one-line detail. */
const PERIODS_CLASS = "m-0 mt-3 grid gap-2 @min-[560px]:grid-cols-3";

/** The growth NEAR bought needs at one NEAR price at a time, picked on a pill track; phones keep only today's tag, so the
    prices fit in one row. */
export function PriceGrowthPicker({ prices, initial }: { prices: PriceGrowth[]; initial: number }) {
  const [selected, setSelected] = useState(initial);

  return (
    <div className="@container flex min-w-0 flex-col">
      <div role="group" aria-label="NEAR price" className="segmented pill-track w-fit max-w-full overflow-x-auto [scrollbar-width:none]">
        {prices.map((p, i) => (
          <button
            key={p.price}
            type="button"
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className="items-baseline gap-1.5 py-[5px] text-[13px] whitespace-nowrap tabular-nums max-md:px-2.5"
          >
            {p.price}
            <span className={`text-[11.5px] font-normal ${p.today ? "" : "max-md:hidden"}`}>{p.tag}</span>
          </button>
        ))}
      </div>
      <dl className={PERIODS_CLASS}>
        {prices[selected]!.periods.map((period) => (
          <KpiCard key={period.label} icon="change" label={period.label} value={period.value} detail={period.detail} />
        ))}
      </dl>
    </div>
  );
}

/** Loading placeholder of PriceGrowthPicker: a pill per price (`prices`) and a tile per period, a label (`labels`) each. */
export function PriceGrowthPickerSkeleton({ prices, labels }: { prices: number; labels: number[] }) {
  return (
    <div aria-hidden="true" className="@container flex min-w-0 flex-col">
      <div className="segmented pill-track w-fit max-w-full">
        {Array.from({ length: prices }, (_, i) => (
          <span key={i} className="py-[5px] text-[13px] max-md:px-2.5">
            <SkeletonWords chars={10} />
          </span>
        ))}
      </div>
      <dl className={PERIODS_CLASS}>
        {labels.map((label, i) => (
          <KpiCardSkeleton key={i} label={label} detail={"+141% a year".length} />
        ))}
      </dl>
    </div>
  );
}
