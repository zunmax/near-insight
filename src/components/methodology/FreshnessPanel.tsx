import { io } from "next/cache";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { SOURCES } from "@/config/sources";
import { getSourceFreshness } from "@/data/freshness";

const TITLE = "Data freshness";

/** A read interval in hours from one hour up, in minutes below that. */
const intervalLabel = (ms: number) => (ms >= 3_600_000 ? `${ms / 3_600_000} h` : `${ms / 60_000} min`);

/** Each source, how often the worker reads it, and the day its stored data runs through. */
export async function FreshnessPanel() {
  await io();
  const sources = await getSourceFreshness();
  if (sources.length === 0) return <NoData title={TITLE} />;

  return (
    <Panel title={TITLE} sources={[{ cite: "The dashboard's database" }]}>
      <TableScroll label="Data freshness by source">
        <table className="data-table data-table-stack sm:min-w-[420px]">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Read every</th>
              <th scope="col">Data through (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source}>
                <th scope="row" className="text-left font-medium text-ink">{s.source}</th>
                <td data-label="Read every" className="text-ink-2">{intervalLabel(s.everyMs)}</td>
                <td data-label="Data through (UTC)" className="text-ink-2 tabular-nums">{s.through ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Panel>
  );
}

/** Loading placeholder of FreshnessPanel: a row for each source. */
export function FreshnessPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length}>
      <TableSkeleton headers={["Source", "Read every", "Data through (UTC)"].map((name) => name.length)} rows={Object.keys(SOURCES).length} columns={[18, 10, 10]} stack className="sm:min-w-[420px]" />
    </PanelSkeleton>
  );
}
