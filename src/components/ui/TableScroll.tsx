import type { ReactNode } from "react";

/** Horizontal scroller for a table wider than its box. It can take keyboard focus, has an accessible name, shows a thin
    scrollbar when the table overflows, and fades its right edge while columns are still hidden (`.table-scroll` in
    globals.css). */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="table-scroll thin-scroll -mx-1 overflow-x-auto px-1">
      {children}
    </div>
  );
}
