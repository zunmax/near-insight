import { SkeletonWords } from "@/components/ui/PanelSkeleton";

type BarRow = { label: string; value: number; display: string; highlight?: boolean };

/** Horizontal bars on a shared linear scale over a light track; the highlighted row (NEAR) is in the accent color, the
    rest gray. With negative values the scale spans both signs: bars grow right or left from a zero line. */
export function BarList({ rows, caption }: { rows: BarRow[]; caption: string }) {
  const values = rows.map((r) => r.value);
  const low = Math.min(0, ...values);
  const span = Math.max(0, ...values) - low || 1;
  const zero = (-low / span) * 100;
  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className={`w-28 py-[7px] pr-3 text-left font-medium whitespace-nowrap ${row.highlight ? "font-semibold text-ink" : "text-ink-2"}`}>
              {row.label}
            </th>
            <td className="py-[7px]">
              <div className="flex items-center gap-2.5">
                <div aria-hidden="true" className="relative flex-1">
                  <span className="meter block h-2">
                    <span
                      className={row.highlight ? undefined : "bg-[color-mix(in_srgb,var(--muted)_45%,transparent)]"}
                      style={{
                        marginLeft: `${row.value < 0 ? zero + (row.value / span) * 100 : zero}%`,
                        width: `${Math.max(0.5, (Math.abs(row.value) / span) * 100)}%`,
                        transformOrigin: row.value < 0 ? "right" : undefined,
                      }}
                    />
                  </span>
                  {low < 0 ? <span className="absolute -inset-y-1 w-px bg-[var(--axis)]" style={{ left: `${zero}%` }} /> : null}
                </div>
                <span className={`w-14 shrink-0 text-right text-[12.5px] tabular-nums ${row.highlight ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                  {row.display}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Loading placeholder of a BarList with `rows` rows: the same table and row padding, with bars that shorten down the list. */
export function BarListSkeleton({ rows }: { rows: number }) {
  return (
    <table aria-hidden="true" className="w-full border-collapse text-[13px]">
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <th className="w-28 py-[7px] pr-3 text-left font-medium whitespace-nowrap">
              <SkeletonWords chars={8} />
            </th>
            <td className="py-[7px]">
              <div className="flex items-center gap-2.5">
                <div className="flex-1">
                  <span className="skeleton block h-2" style={{ width: `${100 - (i * 80) / rows}%` }} />
                </div>
                <span className="w-14 shrink-0 text-right text-[12.5px]">
                  <SkeletonWords chars={5} />
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
