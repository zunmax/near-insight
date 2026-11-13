import { LIVE_RETENTION_DAYS } from "./ingest.ts";

/** Tables anyone can download as CSV from /api/export/<table>. */
export const EXPORT_TABLES = {
  daily_series:
    "Every daily series: NEAR price and longer BTC, ETH and NEAR price history, total supply, NEAR minted and burned, Intents volume and fees (each merged, Dune and DefiLlama), confidential volume, revenue, buybacks, swaps, intents.near transactions, TVL and confidential TVL, DEX volume, gas fees, NEAR transactions and relayed transactions, active, new and relayed accounts, fee wallet and treasury balances, DeFi TVL, stablecoins, developers",
  intents_chain_daily: "NEAR Intents volume per day, counted under each chain, public and confidential swaps (Dune)",
  intents_symbol_daily: "NEAR Intents volume per day, counted under each token symbol, public and confidential swaps (Dune)",
  intents_fee_channels: "NEAR Intents gross fees since launch by channel, for the 100 largest channels above $10 (Dune)",
  live_samples: `Live readings of the last ${LIVE_RETENTION_DAYS} days: block height and chunk gas each minute`,
  coins_latest: "Latest top-100 market snapshot",
  coins_daily: "One market row per coin per day, read just after 00:00 UTC",
  network_latest:
    "Latest NEAR network state: block height and time, protocol and nearcore version, total supply, gas price, shard count, max issuance rate, contract gas rebate, block-producer seats and minimum stake ratio",
  epoch_supply: "NEAR minted and burned per epoch, with total supply at its first and last block, from block headers",
  governance_proposals: "House of Stake vote on HSP-029: status, veNEAR for, against and abstaining, deadlines",
  validator_epochs: "Validator stakes per epoch",
  coin_supply_daily: "Circulating supply per day for NEAR and each coin ranked above it",
  protocol_versions: "Protocol version on mainnet and testnet",
  releases: "nearcore releases",
  news_items: "NEAR news: headline, summary, publisher, time and link",
} as const;

export type ExportTable = keyof typeof EXPORT_TABLES;
