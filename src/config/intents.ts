/** Stablecoin symbols in NEAR Intents volume by token (Dune), upper-cased: dollar, euro and pound stablecoins, with the
    bridged spellings seen in the data (checked 2026-11-10). Vault shares such as gtUSDCp are not stablecoins; volume
    counted under any other symbol is non-stablecoin. */
const STABLECOIN_SYMBOLS = [
  "USDC",
  "USDCX",
  "USDT",
  "USDT0",
  "USD₮0",
  "DAI",
  "XDAI",
  "USDF",
  "USDG",
  "USD1",
  "USDE",
  "USDS",
  "FDUSD",
  "PYUSD",
  "RLUSD",
  "FRAX",
  "TUSD",
  "GHO",
  "USDD",
  "CRVUSD",
  "EURC",
  "EURE",
  "GBPE",
] as const;

/** Days on which DefiLlama's NEAR Intents volume counted only public swaps, leaving out confidential ones; it matches Dune
    on every other day (checked 2026-11-11: 3% to 13% below Dune each month of this span). */
export const DEFILLAMA_PUBLIC_ONLY = { from: "2026-04-01", through: "2026-08-31", label: "April to August 2026" } as const;

/** STABLECOIN_SYMBOLS as a SQL list for `UPPER(symbol) IN (...)`. */
export const STABLECOIN_SQL_LIST = STABLECOIN_SYMBOLS.map((symbol) => `'${symbol}'`).join(", ");

/** Display names of the chain ids in NEAR Intents volume by chain (Dune writes them upper-cased), by lower-case id; an id not listed is shown upper-cased. */
export const INTENTS_CHAIN_NAMES: Record<string, string> = {
  eth: "Ethereum",
  bsc: "BNB Chain",
  tron: "Tron",
  sol: "Solana",
  near: "NEAR",
  zec: "Zcash",
  btc: "Bitcoin",
  base: "Base",
  arb: "Arbitrum",
  op: "Optimism",
  pol: "Polygon",
  avax: "Avalanche",
  sui: "Sui",
  ton: "TON",
  xrp: "XRP Ledger",
  stellar: "Stellar",
  aptos: "Aptos",
  gnosis: "Gnosis",
  ltc: "Litecoin",
  doge: "Dogecoin",
  bch: "Bitcoin Cash",
  starknet: "Starknet",
  monad: "Monad",
  aleo: "Aleo",
  xlayer: "X Layer",
  hood: "Robinhood Chain",
  cardano: "Cardano",
  dash: "Dash",
  plasma: "Plasma",
  bera: "Berachain",
  scroll: "Scroll",
  fogo: "Fogo",
  adi: "ADI Chain",
  movement: "Movement",
  miden: "Miden",
};

/** Chains shown by name in the chain mix; the rest are summed as "Other chains". */
export const INTENTS_CHAIN_ROWS = 8;
