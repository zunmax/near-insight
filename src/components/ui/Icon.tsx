/** Stroke paths on a 16-unit grid for the shared line icons. */
const ICON_PATHS = {
  download: "M8 2.5v8m-3.5-3.5L8 10.5 11.5 7M3 13.5h10",
  search: "M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM10.5 10.5l3 3",
  "chevron-left": "M10 3.5 5.5 8l4.5 4.5",
  "chevron-right": "M6 3.5 10.5 8 6 12.5",
  flag: "M3.33 14V2.67m0 .66h7.67l-1.67 3 1.67 3H3.33",
  /** Stat icons, drawn beside the label of a stat tile or KPI card. */
  trend: "M2.5 11.5 6 7.5l2.5 2.5 5-6",
  bars: "M3 13V8m3.3 5V4m3.4 9V6.5M13 13V9.5",
  pie: "M8 2.5a5.5 5.5 0 1 0 5.5 5.5H8V2.5Z",
  bag: "M3 5.5h10l-1 7H4l-1-7Zm2.5 0V4a2.5 2.5 0 0 1 5 0v1.5",
  price: "M2.5 12 6.5 8l2.5 2.5L13.5 6M10.5 6h3v3",
  change: "M4 12 12 4M6.5 4H12v5.5",
  calendar: "M3 4.5h10v8.5H3zM3 7.5h10M6 3v3M10 3v3",
  percent: "M12.5 3.5l-9 9M5 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z",
  flame: "M8 13.5c2.2 0 3.8-1.5 3.8-3.6 0-2.6-2.3-3.7-2.8-6.4-1.6 1-2.2 2.6-2.2 3.6-.7-.5-1.1-1.3-1.2-2-1.2 1-2.1 2.7-2.1 4.6 0 2.2 1.9 3.8 4.5 3.8Z",
  check: "M3 8.5 6.5 12 13 4.5",
  lock: "M4.5 7.5h7v6h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2",
  coins: "M8 3c2.5 0 4.5.9 4.5 2S10.5 7 8 7 3.5 6.1 3.5 5 5.5 3 8 3ZM3.5 5v3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V5M3.5 8v3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V8",
  target: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  divide: "M3 8h10M8 4.5h.01M8 11.5h.01",
  layers: "M8 2.5 13.5 5 8 7.5 2.5 5ZM2.5 7.5 8 10l5.5-2.5M2.5 10.5 8 13l5.5-2.5",
  server: "M3 3.5h10v4H3zM3 8.5h10v4H3zM5.5 5.5h.01M5.5 10.5h.01",
  shield: "M8 2.5 13 4.5v3.5c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4.5Z",
  seat: "M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 5.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5",
  cube: "M8 2.5 13 5v6l-5 2.5L3 11V5ZM3 5l5 2.5L13 5M8 7.5v6",
  grid: "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
  coin: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM9.8 5.9c-.3-.6-1-1-1.8-1-1 0-1.8.6-1.8 1.4 0 1.9 3.6.9 3.6 2.8 0 .8-.8 1.4-1.8 1.4-.8 0-1.5-.4-1.8-1M8 3.9v1M8 11.1v1",
  clock: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 5v3l2 1.5",
  tag: "M3 3h5l5 5-5 5-5-5ZM5.5 5.5h.01",
} as const;

export type IconName = keyof typeof ICON_PATHS;

type IconProps = { name: IconName; className: string; strokeWidth?: number };

/** A decorative line icon in the current text color. */
export function Icon({ name, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
