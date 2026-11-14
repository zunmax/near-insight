/** SQLite schema as ordered migrations, applied by the writer on start and tracked in PRAGMA user_version. The first is the
    whole schema; a later change is appended as a new migration, never edited in. Dates are UTC: `day` is YYYY-MM-DD,
    timestamps are ISO 8601 strings. */
export const MIGRATIONS: string[] = [
  /** 1: the schema */
  `
  -- Every ingest job run, kept RUN_LOG_RETENTION_DAYS.
  CREATE TABLE ingest_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    ok INTEGER NOT NULL,
    rows_written INTEGER NOT NULL DEFAULT 0,
    error TEXT
  );
  CREATE INDEX ingest_runs_job_finished ON ingest_runs (job, finished_at);

  -- Latest top-100 market snapshot, with all-time high and 1-year change.
  CREATE TABLE coins_latest (
    coin_id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    rank INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    market_cap_usd REAL NOT NULL,
    fdv_usd REAL,
    circulating_supply REAL NOT NULL,
    total_supply REAL,
    max_supply REAL,
    fetched_at TEXT NOT NULL,
    ath_usd REAL,
    ath_date TEXT,
    change_1y REAL
  );

  -- One market row per coin per day: the day's first reading.
  CREATE TABLE coins_daily (
    day TEXT NOT NULL,
    coin_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    market_cap_usd REAL NOT NULL,
    fdv_usd REAL,
    PRIMARY KEY (day, coin_id)
  );

  -- Every daily value, by series name (SERIES).
  CREATE TABLE daily_series (
    series TEXT NOT NULL,
    day TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (series, day)
  );

  -- Latest NEAR network state.
  CREATE TABLE network_latest (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    block_height INTEGER NOT NULL,
    block_time TEXT NOT NULL,
    protocol_version INTEGER NOT NULL,
    node_version TEXT NOT NULL,
    total_supply_near REAL NOT NULL,
    gas_price_yocto TEXT NOT NULL,
    shard_count INTEGER NOT NULL,
    max_inflation_rate REAL NOT NULL,
    burnt_gas_share_to_contracts REAL NOT NULL,
    block_producer_seats INTEGER NOT NULL,
    minimum_stake_ratio REAL NOT NULL,
    fetched_at TEXT NOT NULL
  );

  -- Validator stakes, one set per epoch.
  CREATE TABLE validator_epochs (
    epoch_height INTEGER NOT NULL,
    account_id TEXT NOT NULL,
    stake_near REAL NOT NULL,
    produces_blocks INTEGER NOT NULL,
    PRIMARY KEY (epoch_height, account_id)
  );

  -- Minute-level measurements for the real-time panel; pruned after LIVE_RETENTION_DAYS.
  CREATE TABLE live_samples (
    metric TEXT NOT NULL,
    at TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (metric, at)
  );

  -- nearcore GitHub releases, and which protocol version each network runs.
  CREATE TABLE releases (
    tag TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    published_at TEXT NOT NULL,
    prerelease INTEGER NOT NULL,
    url TEXT NOT NULL
  );
  CREATE TABLE protocol_versions (
    network TEXT PRIMARY KEY,
    protocol_version INTEGER NOT NULL,
    node_version TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  -- Version of each external dataset already ingested (a day stored through, a run id, a key), so unchanged data is skipped.
  CREATE TABLE dataset_versions (
    dataset TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  -- News about NEAR from every news source. id = '<source prefix>-<upstream id>'; published_at is UTC ISO 8601.
  -- title_key is the lower-case alphanumeric title, so one story reported by two sources is stored once.
  CREATE TABLE news_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    title_key TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    publisher TEXT NOT NULL,
    author TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    published_at TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE INDEX news_items_published ON news_items (published_at);
  CREATE INDEX news_items_title_key ON news_items (title_key);

  -- Circulating supply of NEAR and each coin ranked above it, by day (CoinGecko market cap ÷ price).
  CREATE TABLE coin_supply_daily (
    coin_id TEXT NOT NULL,
    day TEXT NOT NULL,
    circulating_supply REAL NOT NULL,
    PRIMARY KEY (coin_id, day)
  );

  -- NEAR supply accounting per epoch from block headers. end_hash is the epoch's last block; prev_end_hash is the
  -- previous epoch's last block, so stored epochs chain back without further calls.
  CREATE TABLE epoch_supply (
    epoch_id TEXT PRIMARY KEY,
    start_height INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_height INTEGER NOT NULL,
    end_time TEXT NOT NULL,
    end_hash TEXT NOT NULL UNIQUE,
    prev_end_hash TEXT NOT NULL,
    supply_start_near REAL NOT NULL,
    supply_end_near REAL NOT NULL,
    minted_near REAL NOT NULL,
    burnt_near REAL NOT NULL
  );
  CREATE INDEX epoch_supply_start ON epoch_supply (start_height);

  -- House of Stake proposals as last read from the voting contract. veNEAR in whole units.
  CREATE TABLE governance_proposals (
    contract TEXT NOT NULL,
    proposal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    venear_for REAL NOT NULL,
    venear_against REAL NOT NULL,
    venear_abstain REAL NOT NULL,
    venear_snapshot REAL NOT NULL,
    voters INTEGER NOT NULL,
    quorum_threshold_bps INTEGER NOT NULL,
    approval_threshold_bps INTEGER NOT NULL,
    voting_ends_at TEXT,
    timelock_ends_at TEXT,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (contract, proposal_id)
  );

  -- NEAR Intents volume per day by chain and by token symbol, all swaps (public and confidential), from Dune.
  CREATE TABLE intents_chain_daily (
    day TEXT NOT NULL,
    chain TEXT NOT NULL,
    volume_usd REAL NOT NULL,
    PRIMARY KEY (day, chain)
  );
  CREATE TABLE intents_symbol_daily (
    day TEXT NOT NULL,
    symbol TEXT NOT NULL,
    volume_usd REAL NOT NULL,
    PRIMARY KEY (day, symbol)
  );

  -- Fees each channel (the referral a swap carries: front end, wallet or app) generated from launch through as_of, from
  -- Dune; the query lists the 100 largest channels with more than $10 and leaves out swaps without a referral.
  CREATE TABLE intents_fee_channels (
    channel TEXT PRIMARY KEY,
    fees_usd REAL NOT NULL,
    as_of TEXT NOT NULL
  );
  `,
  /** 2: NEAR Intents 1Click swaps by referral */
  `
  -- Completed 1Click swaps created on each UTC day, by referral (the front end, wallet or app a swap came through; '(none)'
  -- when it carries none), from the NEAR Intents Explorer API: swaps, dollars swapped in (amountInUsd) and app fees (each
  -- fee's basis points of amountInUsd). Daily totals only: the API's terms allow no swap record to be kept beyond 24 hours.
  CREATE TABLE intents_referral_daily (
    day TEXT NOT NULL,
    referral TEXT NOT NULL,
    swaps INTEGER NOT NULL,
    volume_usd REAL NOT NULL,
    fees_usd REAL NOT NULL,
    PRIMARY KEY (day, referral)
  );
  `,
];

/** The schema version a database has once every migration is applied. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/** Series names written by the ingest jobs and read by the dashboard. */
export const SERIES = {
  nearPriceUsd: "near_price_usd",
  nearTotalSupply: "near_total_supply",
  /** NEAR Intents volume, public and confidential: Dune's value on each day it has one, DefiLlama's otherwise (mergeIntentsFlows). */
  intentsVolumeUsd: "intents_volume_usd",
  intentsBuybacksUsd: "intents_buybacks_usd",
  /** NEAR Intents gross fees, protocol fee plus every front end's fee: Dune's value on each day it has one, DefiLlama's otherwise. */
  intentsFeesUsd: "intents_fees_usd",
  /** The two sources merged into intentsVolumeUsd and intentsFeesUsd. DefiLlama counted only public volume from April to August 2026. */
  duneIntentsVolumeUsd: "dune_intents_volume_usd",
  duneIntentsFeesUsd: "dune_intents_fees_usd",
  defillamaIntentsVolumeUsd: "defillama_intents_volume_usd",
  defillamaIntentsFeesUsd: "defillama_intents_fees_usd",
  /** The part of NEAR Intents volume in confidential swaps (Dune; public = total − confidential). Confidential swaps began 2026-03-23. */
  intentsConfidentialVolumeUsd: "intents_confidential_volume_usd",
  /** NEAR Intents swaps per day, public and confidential (Dune). */
  intentsSwaps: "intents_swaps",
  /** Funds held in NEAR Intents (TVL) by day, in total and in confidential balances (Dune; public = total − confidential). */
  intentsTvlUsd: "intents_tvl_usd",
  intentsConfidentialTvlUsd: "intents_confidential_tvl_usd",
  /** NEAR Intents revenue: the share of fees the app operators keep, swept into their revenue wallets. */
  intentsRevenueUsd: "intents_revenue_usd",
  /** Volume of every DEX DefiLlama tracks on NEAR, NEAR Intents included. */
  nearDexVolumeUsd: "near_dex_volume_usd",
  nearChainFeesUsd: "near_chain_fees_usd",
  nearTvlUsd: "near_tvl_usd",
  nearStablecoinsUsd: "near_stablecoins_usd",
  nearTxns: "near_txns",
  /** Accounts that signed a transaction, and accounts created, per day (NearBlocks v1 active_accounts, new_accounts). */
  nearActiveAccounts: "near_active_accounts",
  nearNewAccounts: "near_new_accounts",
  /** Transactions a relayer signed for another account, and the accounts that acted through relayers, per day (NearBlocks meta_txns, meta_accounts). */
  nearRelayedTxns: "near_relayed_txns",
  nearRelayedAccounts: "near_relayed_accounts",
  /** Gas fees paid on NEAR, in NEAR (NearBlocks txn_fee). */
  nearTxnFeesNear: "near_txn_fees_near",
  /** Transactions of the intents.near contract (NearBlocks). */
  intentsTxns: "intents_txns",
  /** NEAR minted and burned per day, measured from block headers (each epoch spread over its days by time). */
  mintedNear: "minted_near",
  burntNear: "burnt_near",
  buybackWalletNear: "buyback_wallet_near",
  frontendFeeWalletNear: "frontend_fee_wallet_near",
  oneClickFeeWalletNear: "one_click_fee_wallet_near",
  /** End-of-day NEAR balance of the protocol treasury (treasury.near). */
  treasuryNear: "treasury_near",
  devsAllNear: "devs_all_near",
  devsFullTimeNear: "devs_full_time_near",
  devsAllEthereum: "devs_all_ethereum",
  devsAllSolana: "devs_all_solana",
  devsAllBitcoin: "devs_all_bitcoin",
  /** Daily USD prices from DefiLlama's coins API (CoinGecko prices) since COIN_PRICE_HISTORY_START, for the lead-lag test.
      NEAR has its own series here because CoinGecko's public API serves only 365 days; near_price_usd stays the dashboard price. */
  btcPriceUsd: "btc_price_usd",
  ethPriceUsd: "eth_price_usd",
  nearPriceHistoryUsd: "near_price_history_usd",
} as const;

export type SeriesName = (typeof SERIES)[keyof typeof SERIES];

/** The core flow series: the dashboard's data-through day is their shared last day, or earlier before a missing day
    (FlowContext.through in src/data/thesis-metrics/flow-context.ts). */
export const CORE_SERIES: SeriesName[] = [SERIES.intentsVolumeUsd, SERIES.intentsBuybacksUsd, SERIES.nearChainFeesUsd, SERIES.nearPriceUsd];

/** Metrics in live_samples: block readings taken each minute. */
export const LIVE = {
  blockHeight: "block_height",
  chunkGasUsed: "chunk_gas_used",
  chunkGasLimit: "chunk_gas_limit",
} as const;

export type LiveMetric = (typeof LIVE)[keyof typeof LIVE];

/** Ingest job names, as stored in ingest_runs.job. */
export const JOBS = {
  markets: "coingecko.markets",
  nearPrice: "coingecko.near_price",
  defillama: "defillama.series",
  coinPrices: "defillama.prices",
  peerSupply: "coingecko.peer_supply",
  network: "near.network",
  validators: "near.validators",
  epochs: "near.epochs",
  governance: "near.governance",
  liveBlock: "near.live_block",
  nearblocks: "nearblocks.sync",
  dune: "dune.intents",
  intentsExplorer: "intents_explorer.referrals",
  releases: "github.releases",
  developers: "electric_capital.developers",
  cryptopanicNews: "cryptopanic.news",
  chaincatcherNews: "chaincatcher.news",
} as const;

/** News sources, as stored in news_items.source, with the prefix used in news_items.id. */
export const NEWS_SOURCES = { cryptopanic: "cp", chaincatcher: "cc" } as const;

export type NewsSource = keyof typeof NEWS_SOURCES;

/** One news_items row as written by the worker. */
export type NewsItem = {
  id: string;
  source: NewsSource;
  title: string;
  summary: string | null;
  url: string;
  publisher: string;
  author: string | null;
  tags: string[];
  publishedAt: string;
};

/** A House of Stake proposal as last read from its voting contract. veNEAR in whole units; times are ISO 8601. */
export type GovernanceProposal = {
  contract: string;
  proposalId: number;
  title: string;
  /** Contract status, e.g. Voting or Timelock (passed, in the veto window until timelockEndsAt). */
  status: string;
  venearFor: number;
  venearAgainst: number;
  venearAbstain: number;
  /** veNEAR that could vote, at the proposal's snapshot. */
  venearSnapshot: number;
  voters: number;
  quorumThresholdBps: number;
  approvalThresholdBps: number;
  votingEndsAt: string | null;
  timelockEndsAt: string | null;
};

/** One releases row: a nearcore GitHub release; publishedAt is ISO 8601. */
export type Release = { tag: string; name: string; publishedAt: string; prerelease: boolean; url: string };

export type JobName = (typeof JOBS)[keyof typeof JOBS];
