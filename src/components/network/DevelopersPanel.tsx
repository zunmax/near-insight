import { io } from "next/cache";
import { LineChart, LineChartSkeleton } from "@/components/charts/LineChart";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { getSeries } from "@/data/series";
import { SERIES } from "@/db/schema";
import { formatChange, formatInteger } from "@/lib/format";
import { dayTime, firstOfMonth, indexTo100, isoDay, type DailyPoint } from "@/lib/metrics";

const TITLE = "Monthly active developers";
const DESCRIPTION = "Monthly active developers in each ecosystem, indexed to 100 on 2023-01-01: a value of 80 means 20% fewer developers than on that day.";
const SINCE = dayTime("2023-01-01");

/** Latest monthly value and its change against the same month a year earlier. */
function latestWithChange(points: DailyPoint[]) {
  const now = points.at(-1);
  const before = points.at(-13);
  return { now: now?.value ?? 0, change: now && before && before.value > 0 ? now.value / before.value - 1 : null };
}

/** Monthly active developers, each ecosystem indexed to 100 on 2023-01-01 so they share one axis. */
export async function DevelopersPanel() {
  await io();
  const [near, nearFullTime, eth, sol, btc] = (
    await Promise.all([
      getSeries(SERIES.devsAllNear),
      getSeries(SERIES.devsFullTimeNear),
      getSeries(SERIES.devsAllEthereum),
      getSeries(SERIES.devsAllSolana),
      getSeries(SERIES.devsAllBitcoin),
    ])
  ).map(firstOfMonth);
  const indexed = (points: DailyPoint[]) => indexTo100(points.filter((p) => p.time >= SINCE));
  const series = [
    { name: "NEAR", points: indexed(near!) },
    { name: "Ethereum", points: indexed(eth!) },
    { name: "Solana", points: indexed(sol!) },
  ];
  if (series.some((s) => s.points.length < 2)) return <NoData title={TITLE} />;

  const rows = [
    { name: "NEAR", ...latestWithChange(near!) },
    { name: "Ethereum", ...latestWithChange(eth!) },
    { name: "Solana", ...latestWithChange(sol!) },
    { name: "Bitcoin", ...latestWithChange(btc!) },
  ];
  const fullTime = latestWithChange(nearFullTime!);
  const latestDay = isoDay(near!.at(-1)!.time);

  return (
    <Panel
      title={TITLE}
      description={DESCRIPTION}
      sources={["electricCapital"]}
      through={`Data through ${latestDay}`}
      sqlId="developers"
    >
      {/** The table's column takes the width its numbers need, so no column is cut off; the chart gets the rest. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <LineChart series={series} format="index" title="Monthly active developers, indexed to 100 on 2023-01-01" />
        <div className="min-w-0 self-start">
          <TableScroll label="Monthly active developers by ecosystem">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Ecosystem</th>
                  <th scope="col" className="text-right">{latestDay}</th>
                  <th scope="col" className="text-right">12-mo change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" className={`text-left font-medium ${r.name === "NEAR" ? "text-ink" : "text-ink-2"}`}>{r.name}</th>
                    <td className="text-right tabular-nums">{formatInteger(r.now)}</td>
                    <td className="text-right tabular-nums">{r.change === null ? "—" : formatChange(r.change, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {/** w-0 min-w-full: the note wraps to the table's width instead of widening the column. */}
          <p className="mt-3 w-0 min-w-full text-[12px] leading-relaxed text-muted">
            NEAR full-time developers: {formatInteger(fullTime.now)}
            {fullTime.change === null ? "" : ` (${formatChange(fullTime.change, 0)} in 12 months)`}.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** Loading placeholder of DevelopersPanel: the chart of three ecosystems beside the table of four. */
export function DevelopersPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} text={DESCRIPTION.length} tabs="Chart">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <LineChartSkeleton legend={[4, 8, 6]} />
        <div className="min-w-0 self-start">
          {/** TableScroll's box, clipped instead of scrolled. */}
          <div className="-mx-1 overflow-hidden px-1">
            <TableSkeleton headers={["Ecosystem", "YYYY-MM-DD", "12-mo change"].map((name) => name.length)} rows={4} columns={[8, 5, 4]} />
          </div>
          <p className="mt-3 w-0 min-w-full text-[12px] leading-relaxed">
            <SkeletonWords chars={52} />
          </p>
        </div>
      </div>
    </PanelSkeleton>
  );
}
