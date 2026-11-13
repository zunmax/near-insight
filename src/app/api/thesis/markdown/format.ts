/** Input type, Markdown table helpers and value formatters shared by every part of the thesis document. */
import type { Fact } from "@/content/facts";
import type { LiveSnapshot } from "@/data/live";
import type { NetworkState } from "@/data/network";
import { PUBLIC_URLS, SOURCES } from "@/config/sources";
import type { Release } from "@/db/schema";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import { formatChange, formatGrowthRange, formatPercentSplit } from "@/lib/format";
import { daysInMonth, type Absorption } from "@/lib/metrics";

/** Everything the thesis document is rendered from. Dates are UTC days (YYYY-MM-DD). */
export type ThesisDocumentInput = {
  metrics: ThesisMetrics;
  network: NetworkState | null;
  /** Minute-level chain activity, for the measured block time. */
  live: LiveSnapshot | null;
  /** Stored nearcore releases, newest first. */
  releases: Release[];
  /** Day of the latest CoinGecko market reading. */
  marketAsOf: string | null;
  /** Day of the newest live sample (today when there is none); the document is dated by it. */
  snapshot: string;
};

export const DASH = "—";

/** Public endpoints named in the re-run requests. */
export const DEFILLAMA = PUBLIC_URLS.defillama;
export const DEFILLAMA_COINS = PUBLIC_URLS.defillamaCoins;
export const DEFILLAMA_STABLECOINS = PUBLIC_URLS.defillamaStablecoins;
export const FASTNEAR_RPC = PUBLIC_URLS.nearRpc;
export const TESTNET_RPC = PUBLIC_URLS.nearTestnetRpc;
export const ARCHIVAL_RPC = PUBLIC_URLS.nearArchive;
export const NEARBLOCKS_V1 = PUBLIC_URLS.nearblocks;
export const NEARBLOCKS_V3 = PUBLIC_URLS.nearblocksV3;
export const GITHUB = SOURCES.github.baseUrl;
export const OPEN_DEV_DATA = SOURCES.electricCapital.baseUrl;

/** The block-header request behind NEAR minted and burned, which several sections name. */
export const EPOCH_HEADERS = `NEAR archival RPC \`POST ${ARCHIVAL_RPC}\` \`block\` with \`{"block_id":<height or hash>}\` at each epoch boundary`;
export const COINGECKO = PUBLIC_URLS.coingecko;

/** Requests that several sections name: the top coins' markets, and NEAR's daily price with the history behind CoinGecko's 365 days. */
export const COINGECKO_MARKETS = `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${SOURCES.coingecko.marketsPageSize}&page=1&price_change_percentage=1y`;
export const COINGECKO_NEAR_CHART = `${COINGECKO}/coins/near/market_chart?vs_currency=usd&days=365&interval=daily`;
export const NEAR_DAILY_PRICE = `CoinGecko \`GET ${COINGECKO_NEAR_CHART}\` (daily price; older days: DefiLlama \`GET ${DEFILLAMA_COINS}/chart/coingecko:near?start={unix}&span=${SOURCES.defillama.coinsMaxPoints}&period=1d&searchWidth=600\`)`;

export const show = <T>(value: T | null | undefined, format: (value: T) => string): string => (value == null ? DASH : format(value));
export const day = (iso: string | null | undefined) => iso?.slice(0, 10) ?? DASH;
/** "30 days to 2026-11-09", or "30 days" while the window's last day is unknown. */
export const daysTo = (days: number, through: string | null) => (through === null ? `${days} days` : `${days} days to ${through}`);
export const reading = (asOf: string | null | undefined) => (asOf ? `reading of ${day(asOf)}` : "no reading yet");

/** NEAR bought's monthly growth with its 95% range: "+19.9% (95% range +9.7% to +31.1%)". */
export const boughtGrowth = (b: ThesisMetrics["buybacks"], digits = 1) =>
  b?.monthlyGrowth == null ? DASH : `${formatChange(b.monthlyGrowth, digits)}${b.monthlyGrowthRange ? ` (95% range ${formatGrowthRange(b.monthlyGrowthRange, digits)})` : ""}`;

/** "16.10% (1.06% burned, 15.04% bought)": two decimals, as on the Supply page, with parts that add up to the total as printed. */
export const absorbed = (a: Absorption) => {
  const [total, burned, bought] = formatPercentSplit(a.share, a.burntShare, 2);
  return `${total} (${burned} burned, ${bought} bought)`;
};

/** "2026-11: 12% (2 of 30 days)" for a month the data covers only partly. */
export const monthEntry = (month: string, value: string, days: number) => {
  const total = daysInMonth(month);
  return days < total ? `${month}: ${value} (${days} of ${total} days)` : `${month}: ${value}`;
};

/** The README's section divider image, shared so both documents look the same on GitHub. */
const DIVIDER = '<img src="assets/divider.svg" width="100%" alt="">';

/** The README's wave footer, closing the document. */
export const FOOTER = '<img src="https://capsule-render.vercel.app/api?type=waving&height=90&color=0:00a37a,100:1ed39b&section=footer" alt="" width="100%">';

/** A section heading in the README's style: the divider, then a centred title framed by its emoji. */
export function sectionHeading(title: string, emoji: string): string {
  const text = title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `${DIVIDER}\n\n<h2 align="center">${emoji} ${text} ${emoji}</h2>`;
}

const escapeCell = (text: string) => text.replaceAll("|", "\\|");

export function table(header: string[], rows: string[][]): string {
  return [header, header.map(() => "---"), ...rows].map((row) => `| ${row.map(escapeCell).join(" | ")} |`).join("\n");
}

export const evidenceTable = (rows: string[][]) => table(["Evidence", "Value", "Window"], rows);

export const factTable = (facts: Fact[]) => table(["Fact", "Value", "Source"], facts.map((f) => [f.label, f.value, f.source]));
