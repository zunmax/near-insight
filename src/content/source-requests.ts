/** Relative import: scripts/query.ts runs this module directly with Node. */
import {
  BUYBACK_ACCOUNT,
  FRONTEND_FEE_ACCOUNT,
  HOUSE_OF_STAKE_CONTRACT,
  INTENTS_CONTRACT,
  ONE_CLICK_FEE_ACCOUNT,
  PROTOCOL_TREASURY_ACCOUNT,
  SOURCES,
} from "../config/sources.ts";

const { dashboard, queries: dune } = SOURCES.dune;

/** A query on the NEAR team's Dune dashboard, read from its latest run. */
const duneQuery = (id: number, name: string, gives: string) => `Dune ${dashboard.handle}/${dashboard.slug} query ${id} "${name}" (${gives}, latest run)`;

/** The request behind each stored series, as the query catalog lists it under each query. */
export const SOURCE_REQUESTS = {
  duneVolume: duneQuery(dune.volume, "NEAR Intents - All-time Volume", "daily volume, public and confidential"),
  duneSwaps: duneQuery(dune.swaps, "NEAR Intents - Activity", "daily swaps"),
  duneFees: duneQuery(dune.fees, "Total generated fees All-time", "daily gross fees"),
  duneFeeChannels: duneQuery(dune.feeChannels, "Total generated fees by channel", "fees since launch for the 100 largest channels above $10"),
  duneSymbolVolume: duneQuery(dune.symbolVolume, "NEAR Intents - Token Volume", "daily volume by token"),
  duneChainVolume: duneQuery(dune.chainVolume, "NEAR Intents - Blockchain Volume", "daily volume by chain"),
  duneTvl: duneQuery(dune.tvl, "NEAR Intents - TVL", "daily TVL, public and confidential"),
  intentsVolume: "DefiLlama GET /summary/dexs/near-intents (daily volume)",
  intentsFees: "DefiLlama GET /summary/fees/near-intents?dataType=dailyFees",
  intentsRevenue: "DefiLlama GET /summary/fees/near-intents?dataType=dailyRevenue",
  intentsBuybacks: "DefiLlama GET /summary/fees/near-intents?dataType=dailyHoldersRevenue",
  dexVolume: "DefiLlama GET /overview/dexs/near",
  chainFees: "DefiLlama GET /summary/fees/near",
  tvl: "DefiLlama GET /v2/historicalChainTvl/Near",
  stablecoins: "DefiLlama GET stablecoins.llama.fi/stablecoincharts/Near",
  priceHistory: "DefiLlama GET coins.llama.fi/chart/coingecko:{near,bitcoin,ethereum} (daily)",
  nearPrice: "CoinGecko GET /coins/near/market_chart?days=365 (daily price)",
  markets: "CoinGecko GET /coins/markets (price, market cap, FDV, rank)",
  peerSupply: "CoinGecko GET /coins/{id}/market_chart?days=365 (market cap ÷ price)",
  epochHeaders: "NEAR archival RPC block (by height or hash) at each epoch boundary",
  protocolConfig: "NEAR RPC EXPERIMENTAL_protocol_config",
  block: "NEAR RPC block (finality final)",
  validators: "NEAR RPC validators",
  walletBalances: `NEAR RPC view_account for ${BUYBACK_ACCOUNT}, ${FRONTEND_FEE_ACCOUNT}, ${ONE_CLICK_FEE_ACCOUNT} (today); NearBlocks GET /v3/accounts/{wallet}/stats/balance (finished days)`,
  treasuryBalance: `NEAR RPC view_account for ${PROTOCOL_TREASURY_ACCOUNT} (today); NearBlocks GET /v3/accounts/${PROTOCOL_TREASURY_ACCOUNT}/stats/balance (finished days)`,
  hsp029: `NEAR RPC call_function get_proposal on ${HOUSE_OF_STAKE_CONTRACT}`,
  nearblocksCharts: "NearBlocks GET /v1/charts (daily active and new accounts)",
  nearblocksDaily: "NearBlocks GET /v3/txn-stats, /v3/block-stats and /v3/address-stats (daily, last 365 days; older days from GET /v1/charts)",
  intentsTxns: `NearBlocks GET /v3/accounts/${INTENTS_CONTRACT}/stats/txns`,
  releases: "GitHub GET /repos/near/nearcore/releases; NEAR RPC status on mainnet and testnet",
  developers: "Open Dev Data eco_mads.parquet",
} as const;
