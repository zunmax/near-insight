import { io } from "next/cache";
import { Meter } from "@/components/charts/Meter";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { NoteSkeleton, PanelSkeleton, SkeletonWords, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { BUYBACKS_START_DAY } from "@/config/protocol";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatCompact, formatPercentFromFull, formatPercentSplit, upperFirst } from "@/lib/format";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "New supply absorbed by burn and buybacks";

/** Share of the NEAR minted that was burned or bought with NEAR Intents fees, over four windows. */
export async function AbsorptionPanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { absorption: a, dataThrough } = metrics;
  if (!a?.d30) return <NoData title={TITLE} />;
  const window30 = windowName(metrics, "30 days");
  const windows = [
    { label: upperFirst(window30), row: a.d30 },
    { label: upperFirst(windowName(metrics, "90 days")), row: a.d90 },
    { label: `Since buybacks began, ${BUYBACKS_START_DAY}`, row: a.sinceBuybacks },
    { label: upperFirst(windowName(metrics, "365 days")), row: a.d365 },
  ];

  return (
    <Panel
      title={TITLE}
      sources={["nearArchive", "defillama", "coingecko"]}
      through={`Data through ${dataThrough}`}
      sqlId="absorption"
      viewLabel="Values"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[30px] leading-none font-extrabold tabular-nums">{formatPercentFromFull(a.d30.share, 1)}</p>
        <p className="text-right text-[13px] text-muted">over the {window30}</p>
      </div>
      <div className="mt-4">
        <Meter share={a.d30.share} label={`Share of the NEAR minted over the ${window30} that was burned or bought`} />
      </div>
      <TableScroll label="New supply absorbed by window">
        <table className="data-table data-table-stack mt-5 sm:min-w-[360px]">
          <thead>
            <tr>
              <th scope="col">Window</th>
              <th scope="col" className="text-right">NEAR minted</th>
              <th scope="col" className="text-right">Burned</th>
              <th scope="col" className="text-right">Bought</th>
              <th scope="col" className="text-right">Absorbed</th>
            </tr>
          </thead>
          <tbody>
            {windows.map(({ label, row }) => {
              /** The bought part is the absorbed share less the burned one as printed, so each row adds up. */
              const [absorbed, burned, bought] = row ? formatPercentSplit(row.share, row.burntShare, 2) : ["—", "—", "—"];
              return (
                <tr key={label}>
                  <th scope="row" className="text-left font-medium text-ink">{label}</th>
                  <td data-label="NEAR minted" className="text-right text-ink-2 tabular-nums">{row ? formatCompact(row.mintedNear) : "—"}</td>
                  <td data-label="Burned" className="text-right text-ink-2 tabular-nums">{burned}</td>
                  <td data-label="Bought" className="text-right text-ink-2 tabular-nums">{bought}</td>
                  <td data-label="Absorbed" className="text-right font-semibold text-ink tabular-nums">{absorbed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Each share is NEAR burned or bought ÷ NEAR minted over the same days. NEAR burned and minted are measured from block headers; NEAR bought is
        each day&apos;s buyback dollars at that day&apos;s price. Burned NEAR leaves total supply. Bought NEAR is held off the market in the three fee
        wallets; it is not burned, so it stays in total supply and in circulating supply.
      </p>
    </Panel>
  );
}

/** Loading placeholder of AbsorptionPanel. */
export function AbsorptionPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Values">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[30px] leading-none font-extrabold">
          <SkeletonWords chars={5} />
        </p>
        <p className="text-right text-[13px]">
          <SkeletonWords chars={21} />
        </p>
      </div>
      <span className="skeleton mt-4 block h-1.5 rounded-full" />
      <TableSkeleton headers={["Window", "NEAR minted", "Burned", "Bought", "Absorbed"].map((name) => name.length)} rows={4} columns={[24, 6, 5, 5, 5]} stack className="mt-5 sm:min-w-[360px]" />
      <NoteSkeleton chars={355} />
    </PanelSkeleton>
  );
}
