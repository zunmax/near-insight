import { io } from "next/cache";
import { Meter } from "@/components/charts/Meter";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatBps, formatNear, formatPercent, formatUsd } from "@/lib/format";
import { annualized, ratio } from "@/lib/metrics";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "From NEAR Intents volume to NEAR bought";
const WINDOW_DAYS = 30;

/** NEAR Intents volume → fees → revenue → NEAR bought over the 30 days to the fee windows' last day: each step as a share of
    volume and of the step before, and the yearly rate of buying as a share of circulating NEAR. */
export async function FeeChainPanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { feeChain, market } = metrics;
  const chain = feeChain?.d30;
  if (!feeChain || !chain || chain.captureRate === null) return <NoData title={TITLE} />;
  const windowLabel = windowName(metrics, `${WINDOW_DAYS} days`, feeChain.through);

  const bps = (share: number | null) => (share === null ? "—" : formatBps(share));
  const pct = (share: number | null) => (share === null ? "—" : formatPercent(share, 1));
  const rows = [
    { label: "NEAR Intents volume", amount: formatUsd(chain.volumeUsd), rate: "", kept: "" },
    { label: "Fees paid on that volume", amount: formatUsd(chain.feesUsd), rate: bps(chain.feeRate), kept: chain.feeRate === null ? "—" : formatPercent(chain.feeRate, 2) },
    { label: "NEAR Intents revenue, kept by the app operators", amount: formatUsd(chain.revenueUsd), rate: bps(ratio(chain.revenueUsd, chain.volumeUsd)), kept: pct(ratio(chain.revenueUsd, chain.feesUsd)) },
    { label: "Spent buying NEAR", amount: formatUsd(chain.buybacksUsd), rate: bps(chain.buybackRate), kept: pct(ratio(chain.buybacksUsd, chain.revenueUsd)) },
    { label: "NEAR bought", amount: formatNear(chain.boughtNear), rate: "", kept: "", highlight: true },
  ];
  /** Circulating NEAR = market cap ÷ price; NEAR bought is counted in NEAR, so a price move in the window does not change it. */
  const buybackYield = market && market.priceUsd > 0 ? annualized(chain.boughtNear, WINDOW_DAYS, market.marketCapUsd / market.priceUsd) : null;

  return (
    <Panel
      title={`${TITLE}, ${windowLabel}`}
      sources={["dune", "defillama", "coingecko"]}
      through={`Data through ${feeChain.through}`}
      sqlId="fee-chain-30d"
      viewLabel="Values"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[30px] leading-none font-extrabold tabular-nums">{formatPercent(chain.captureRate, 1)}</p>
        <p className="text-right text-[13px] text-muted">of fees spent buying NEAR</p>
      </div>
      <div className="mt-4">
        <Meter share={chain.captureRate} label={`Share of NEAR Intents fees spent buying NEAR over the ${windowLabel}`} />
      </div>
      <TableScroll label="NEAR Intents volume to NEAR bought, step by step">
        <table className="data-table data-table-stack mt-5 sm:min-w-[420px]">
          <caption className="sr-only">NEAR Intents volume, fees, NEAR Intents revenue and NEAR bought over the {windowLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col" className="text-right">Of volume</th>
              <th scope="col" className="text-right">Of step before</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className={`text-left font-medium ${row.highlight ? "font-semibold text-ink" : "text-ink-2"}`}>
                  {row.label}
                </th>
                <td data-label="Amount" className={`text-right tabular-nums ${row.highlight ? "font-semibold text-ink" : "text-ink-2"}`}>{row.amount}</td>
                <td data-label="Of volume" className="text-right text-ink-2 tabular-nums">{row.rate}</td>
                <td data-label="Of step before" className="text-right text-ink-2 tabular-nums">{row.kept}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-[13px]">
        <span className="text-ink-2">NEAR bought a year at this pace ÷ circulating NEAR</span>
        <span className="font-semibold tabular-nums">{buybackYield === null ? "—" : formatPercent(buybackYield, 2)}</span>
      </p>
    </Panel>
  );
}

/** Loading placeholder of FeeChainPanel. */
export function FeeChainPanelSkeleton() {
  return (
    <PanelSkeleton title={`${TITLE}, ${WINDOW_DAYS} days to YYYY-MM-DD`.length} tabs="Values">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[30px] leading-none font-extrabold">
          <SkeletonWords chars={5} />
        </p>
        <p className="text-right text-[13px]">
          <SkeletonWords chars={25} />
        </p>
      </div>
      <span className="skeleton mt-4 block h-1.5 rounded-full" />
      <TableSkeleton
        headers={["Step", "Amount", "Of volume", "Of step before"].map((name) => name.length)}
        rows={[
          [19, 8, 0, 0],
          [24, 8, 5, 5],
          [47, 8, 5, 5],
          [17, 8, 5, 5],
          [11, 8, 0, 0],
        ]}
        columns={[24, 8, 5, 5]}
        stack
        className="mt-5 sm:min-w-[420px]"
      />
      <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-[13px]">
        <span>
          <SkeletonWords chars={50} />
        </span>
        <span>
          <SkeletonWords chars={5} />
        </span>
      </p>
    </PanelSkeleton>
  );
}
