import { io } from "next/cache";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, TableSkeleton } from "@/components/ui/PanelSkeleton";
import { TableScroll } from "@/components/ui/TableScroll";
import { getNearAndPeers, getSupplyGrowth1y } from "@/data/market";
import { formatChange, formatCount, formatMultiple, formatUsd } from "@/lib/format";

/** NEAR and every coin ranked above it, with live market data and how fast its circulating supply grew in a year. */
export async function PeersTable() {
  await io();
  const [market, supplyGrowth] = await Promise.all([getNearAndPeers(), getSupplyGrowth1y()]);
  if (!market) return <NoData title="The coins ranked above NEAR" />;
  const rows = [...market.peers, market.near];

  return (
    <Panel title={`The ${formatCount(market.peers.length, "coin")} ranked above NEAR`} sources={["coingecko"]} sqlId="peer-markets" viewLabel="Table">
      {/** "From ATH" shows only where the box fits every column, so a mid-width page never has to scroll the table sideways. */}
      <div className="@container">
        <TableScroll label="Coins ranked above NEAR">
          <table className="data-table sm:min-w-[560px]">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Coin</th>
                <th scope="col" className="text-right max-sm:hidden">Market cap</th>
                <th scope="col" className="text-right max-sm:whitespace-normal">Supply, 1 year</th>
                <th scope="col" className="text-right">FDV ÷ MC</th>
                <th scope="col" className="text-right max-sm:hidden">Price, 1 year</th>
                <th scope="col" className="text-right @max-[650px]:hidden">From ATH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isNear = c.id === "near";
                return (
                  <tr key={c.id} className={isNear ? "bg-surface-2" : ""}>
                    <td className="text-faint tabular-nums">{c.rank}</td>
                    <th scope="row" className="text-left font-medium whitespace-nowrap text-ink">
                      {c.name}
                      <span className="block text-[11px] font-normal text-muted">{c.symbol}</span>
                    </th>
                    <td className="text-right text-ink-2 tabular-nums max-sm:hidden">{formatUsd(c.marketCapUsd)}</td>
                    <td className="text-right text-ink-2 tabular-nums">{supplyGrowth.has(c.id) ? formatChange(supplyGrowth.get(c.id)!, 1) : "—"}</td>
                    <td className="text-right text-ink-2 tabular-nums">{c.fdvUsd ? formatMultiple(c.fdvUsd / c.marketCapUsd, 2) : "—"}</td>
                    <td className="text-right text-ink-2 tabular-nums max-sm:hidden">{c.change1y === null ? "—" : formatChange(c.change1y / 100, 0)}</td>
                    <td className="text-right text-ink-2 tabular-nums @max-[650px]:hidden">{c.athUsd ? formatChange(c.priceUsd / c.athUsd - 1, 0) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </Panel>
  );
}

/** Loading placeholder of PeersTable: a row for each of the about 20 coins ranked above NEAR and NEAR, with the columns the
    table hides on phones and in narrow boxes hidden as well. */
export function PeersTableSkeleton() {
  return (
    <PanelSkeleton title={"The 20 coins ranked above NEAR".length} tabs="Table">
      <div className="@container">
        <TableSkeleton
          headers={["#", "Coin", "Market cap", "Supply, 1 year", "FDV ÷ MC", "Price, 1 year", "From ATH"].map((name) => name.length)}
          rows={21}
          rowHeader={1}
          columns={[
            2,
            { chars: 9, detail: 4, detailClassName: "text-[11px]" },
            { chars: 6, className: "max-sm:hidden" },
            6,
            5,
            { chars: 5, className: "max-sm:hidden" },
            { chars: 4, className: "@max-[650px]:hidden" },
          ]}
          className="sm:min-w-[560px]"
        />
      </div>
    </PanelSkeleton>
  );
}
