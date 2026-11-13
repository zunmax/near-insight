import { SkeletonWords } from "@/components/ui/PanelSkeleton";

/** A labelled range input that shows its current value beside the label; step "any" keeps an exact starting value. */
export function Slider(props: { label: string; value: number; min: number; max: number; step: number | "any"; display: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{props.label}</span>
        <span className="font-semibold tabular-nums">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-valuetext={props.display}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-[var(--blue)]"
      />
    </label>
  );
}

/** Loading placeholder of a Slider: its label (`label` characters) and value row, then the range track. */
export function SliderSkeleton({ label }: { label: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3 text-[13px]">
        <span>
          <SkeletonWords chars={label} />
        </span>
        <span>
          <SkeletonWords chars={5} />
        </span>
      </span>
      <span className="flex h-4 items-center">
        <span className="skeleton h-1.5 w-full rounded-full" />
      </span>
    </div>
  );
}

/** A labelled row of mutually exclusive options. */
export function Choice<T extends string>(props: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[13px] font-medium">{props.label}</legend>
      <div className="segmented w-full">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className="px-2 py-1.5 text-[12.5px]"
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** "+2%", "0%" or "−1.5%" for a slider's percent value. */
export const signedPercent = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}%`;
