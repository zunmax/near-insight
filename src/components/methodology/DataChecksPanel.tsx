import { io } from "next/cache";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { checkDifference, checkWindow, DATA_CHECKS } from "@/content/data-checks";
import { getThesisMetrics } from "@/data/thesis-metrics";

const TITLE = "Data checks";

/** Independent measurements of the same quantity side by side, with their difference, window and last day. */
export async function DataChecksPanel() {
  await io();
  const { dataChecks } = await getThesisMetrics();
  if (DATA_CHECKS.every(({ key }) => dataChecks[key] === null)) return <NoData title={TITLE} />;

  return (
    <Panel
      title={TITLE}
      sources={["nearblocks", "defillama", "nearArchive", "nearRpc", "coingecko", "intentsExplorer", "dune", { cite: "Blockworks Research" }]}
    >
      <TableScroll label="Data checks">
        <table className="data-table data-table-stack sm:min-w-[560px]">
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">A</th>
              <th scope="col">B</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {DATA_CHECKS.map(({ key, title, detail, a, b, format }) => {
              const check = dataChecks[key];
              return (
                <tr key={key} className="align-top">
                  <th scope="row" className="text-left font-normal">
                    <span className="block font-medium text-ink">{title}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{detail(check)}</span>
                  </th>
                  <td data-label="A">
                    <div className="max-sm:text-right">
                      <span className="block text-ink tabular-nums">{check ? format(check.a) : "—"}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">
                        <NoBreakTokens text={a} />
                      </span>
                    </div>
                  </td>
                  <td data-label="B">
                    <div className="max-sm:text-right">
                      <span className="block text-ink tabular-nums">{check ? format(check.b) : "—"}</span>
                      <span className="mt-0.5 block text-[11.5px] text-muted">{b}</span>
                    </div>
                  </td>
                  <td data-label="Difference">
                    <div className="max-sm:text-right">
                      <span className="block font-medium text-ink tabular-nums">{check?.difference == null ? "—" : checkDifference(check.difference)}</span>
                      {check ? (
                        <span className="mt-0.5 block text-[11.5px] text-muted">
                          <NoBreakTokens text={`${checkWindow(check.days)}, as of ${check.through} (UTC)`} />
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
    </Panel>
  );
}

/** Lengths of each check's title and note, A and B with their sources, and the difference with its window, in DATA_CHECKS order. */
const SKELETON_ROWS: Array<Array<[number, number]>> = [
  [[21, 28], [11, 27], [11, 49], [6, 31]],
  [[24, 216], [11, 40], [11, 47], [6, 31]],
  [[17, 43], [18, 43], [18, 29], [6, 35]],
  [[34, 65], [12, 55], [12, 54], [6, 31]],
  [[33, 113], [4, 99], [4, 85], [5, 31]],
  [[34, 131], [12, 40], [12, 51], [6, 31]],
  [[33, 173], [6, 66], [6, 105], [6, 31]],
];

/** Loading placeholder of DataChecksPanel: a row for each check, every cell a value over a note. */
export function DataChecksPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length}>
      <TableSkeleton
        headers={["Check", "A", "B", "Difference"].map((name) => name.length)}
        rows={SKELETON_ROWS.map((cells) => cells.map(([chars, detail]) => ({ chars, detail })))}
        columns={[27, 11, 11, 6]}
        stack
        className="sm:min-w-[560px]"
      />
    </PanelSkeleton>
  );
}
