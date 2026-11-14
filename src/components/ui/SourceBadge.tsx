import { SOURCES, type SourceKey, type SourceRef } from "@/config/sources";

/** Badge color by kind of source: market data, the NEAR chain and its releases, news, developer activity. */
const KIND_COLOR: Record<SourceKey, string> = {
  coingecko: "var(--section-usage)",
  dune: "var(--section-usage)",
  intentsExplorer: "var(--section-usage)",
  defillama: "var(--section-usage)",
  nearRpc: "var(--section-revenue)",
  nearArchive: "var(--section-revenue)",
  nearblocks: "var(--section-revenue)",
  github: "var(--section-revenue)",
  cryptopanic: "var(--section-valuation)",
  chaincatcher: "var(--section-valuation)",
  electricCapital: "var(--section-supply)",
};

/** The name a source is shown by. */
export const sourceName = (source: SourceRef) => (typeof source === "string" ? SOURCES[source].name : source.cite);

/** A source's initial on its kind's color; a cited publication gets the neutral color. */
export function SourceBadge({ source, className = "" }: { source: SourceRef; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-extrabold text-white ${className}`}
      style={{ background: typeof source === "string" ? KIND_COLOR[source] : "var(--section-news)" }}
    >
      {sourceName(source).slice(0, 1)}
    </span>
  );
}
