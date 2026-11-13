const archivalRatePerMinute = Number(process.env.NEAR_ARCHIVAL_RPC_RATE_PER_MINUTE ?? 55);
if (!Number.isInteger(archivalRatePerMinute) || archivalRatePerMinute < 1) throw new Error("NEAR_ARCHIVAL_RPC_RATE_PER_MINUTE must be a whole number of calls, 1 or more");

/** Each source's public address. The environment can point the worker's requests elsewhere, and a provider URL can carry its
    own key, so pages and documents show only these. */
export const PUBLIC_URLS = {
  coingecko: "https://api.coingecko.com/api/v3",
  defillama: "https://api.llama.fi",
  defillamaStablecoins: "https://stablecoins.llama.fi",
  defillamaCoins: "https://coins.llama.fi",
  nearRpc: "https://free.rpc.fastnear.com",
  nearTestnetRpc: "https://rpc.testnet.fastnear.com",
  nearArchive: "https://archival-rpc.mainnet.fastnear.com",
  nearblocks: "https://api.nearblocks.io/v1",
  nearblocksV3: "https://api.nearblocks.io/v3",
} as const;

/** Public data sources; base URLs and optional API keys come from the environment. Free tiers (checked 2026-10-21):
    CoinGecko Demo 30 calls/min and 10,000/month with attribution; NearBlocks free 6 calls/min, 333/day and 10,000/month
    with attribution. */
export const SOURCES = {
  coingecko: {
    name: "CoinGecko",
    usedFor: "Price, market cap, FDV, circulating supply and rank for NEAR and the coins ranked above it",
    baseUrl: process.env.COINGECKO_BASE_URL ?? PUBLIC_URLS.coingecko,
    /** Optional Demo API key, sent as x-cg-demo-api-key. */
    apiKey: process.env.COINGECKO_API_KEY ?? null,
    /** Minimum gap between CoinGecko calls from every job: 2.5 s with the Demo key (30 calls a minute allowed); 12.5 s
        without one, where the public limit is about 5 a minute and faster calls draw 429s. */
    pacingMs: process.env.COINGECKO_API_KEY ? 2_500 : 12_500,
    /** Coins asked for in one markets call. */
    marketsPageSize: 100,
    docsUrl: "https://docs.coingecko.com/reference/coins-markets",
  },
  /** dune.com's own web API (no account): the NEAR team's NEAR Intents dashboard, read as the site reads it, through
      Cloudflare with a browser's TLS fingerprint (curl_cffi, src/ingest/sources/dune.py) and a request signature keyed with a
      value from its public web client; the worker finds a new key there when the signature is refused. */
  dune: {
    name: "Dune",
    usedFor:
      "NEAR Intents volume (public and confidential), swaps, fees, fees by channel, volume by chain and by token, and NEAR Intents TVL, from the NEAR team's NEAR Intents dashboard",
    baseUrl: "https://dune.com",
    /** The dashboard whose queries the job reads; only queries shown on it are used. */
    dashboard: { handle: "near", slug: "near-intents" },
    /** Query ids on the dashboard, by what each one gives. */
    queries: {
      volume: 5179085,
      swaps: 4374089,
      fees: 6162763,
      feeChannels: 6162721,
      symbolVolume: 5157527,
      chainVolume: 5157565,
      tvl: 7586891,
    },
    /** HMAC key the site signs result requests with (found in its web client, 2026-11-10); replaced in the database when the site ships a new one. */
    signingKey: "public-01K4W0KHXNC30MKZMRZY91HKM6",
    /** Python interpreter with curl_cffi installed (requirements.txt). */
    python: process.env.DUNE_PYTHON ?? (process.platform === "win32" ? "python" : "python3"),
    /** Retries of each request after the first attempt. */
    retries: 3,
    /** curl_cffi browser families the helper presents, in order: each retry moves to the next one, and the run keeps the one
        that answered. Each name follows that browser's newest version in the installed curl_cffi; these three use different
        TLS engines, and all passed Cloudflare on 2026-11-11 (chrome_android, still Chrome 131, was challenged). */
    browsers: ["chrome", "safari", "firefox"],
    /** After this the helper starts no new request and returns the queries it read; a request in progress can take up to 60 s more. */
    runBudgetMs: 6 * 60_000,
    /** Longest one job run may take, every request included; the helper is stopped then and nothing it read is kept. */
    runTimeoutMs: 10 * 60_000,
    docsUrl: "https://dune.com/near/near-intents",
  },
  defillama: {
    name: "DefiLlama",
    usedFor:
      "NEAR Intents revenue and buybacks, Intents volume and fees on days Dune does not have, DEX volume on NEAR, gas fees, DeFi TVL on NEAR and stablecoins, and daily BTC, ETH and NEAR prices for the lead-lag test",
    baseUrl: process.env.DEFILLAMA_BASE_URL ?? PUBLIC_URLS.defillama,
    stablecoinsUrl: process.env.DEFILLAMA_STABLECOINS_URL ?? PUBLIC_URLS.defillamaStablecoins,
    /** Coins API: daily price history by CoinGecko id. */
    coinsUrl: process.env.DEFILLAMA_COINS_URL ?? PUBLIC_URLS.defillamaCoins,
    /** Most points the coins chart endpoint returns per request, across all coins requested (checked 2026-11-04). */
    coinsMaxPoints: 500,
    /** Days the newest stored flow day normally trails today: a day's totals are partial until the next day, so flows end the day before yesterday. */
    flowLagDays: 2,
    docsUrl: "https://api-docs.defillama.com/",
  },
  nearRpc: {
    name: "NEAR RPC",
    usedFor:
      "Blocks, total supply, max issuance rate, contract gas rebate, epoch start, latest fee wallet and protocol treasury balances, House of Stake votes, validators and protocol version",
    baseUrl: process.env.NEAR_RPC_URL ?? PUBLIC_URLS.nearRpc,
    testnetUrl: process.env.NEAR_TESTNET_RPC_URL ?? PUBLIC_URLS.nearTestnetRpc,
    /** Optional FastNEAR API key, sent as a Bearer token. */
    apiKey: process.env.FASTNEAR_API_KEY ?? null,
    docsUrl: "https://docs.near.org/api/rpc/providers",
  },
  /** A NEAR RPC node that keeps every block since genesis; FastNEAR's answers without an account. A provider URL
      (NEAR_ARCHIVAL_RPC_URL) can replace it for requests. */
  nearArchive: {
    name: "NEAR archival RPC",
    usedFor: "Block headers of every epoch boundary: total supply, NEAR minted and NEAR burned",
    baseUrl: process.env.NEAR_ARCHIVAL_RPC_URL ?? PUBLIC_URLS.nearArchive,
    /** Most calls started a minute (NEAR_ARCHIVAL_RPC_RATE_PER_MINUTE). FastNEAR's free node answers about 60 a minute per IP
        (2026-11-11: one a second all succeeded, one every 0.6 s got 429 from the 62nd call); with a provider URL it holds that provider's own limit. */
    ratePerMinute: archivalRatePerMinute,
    docsUrl: "https://docs.fastnear.com/",
  },
  nearblocks: {
    name: "NearBlocks",
    usedFor:
      "Daily transactions, relayed transactions, active, new and relayed accounts, gas fees, supply history, daily fee wallet and protocol treasury balances, and daily transactions of the NEAR Intents contract",
    /** API version 1, deprecated by NearBlocks; kept only for /charts, the one source of the active and new account counts NEAR reports. */
    baseUrl: process.env.NEARBLOCKS_BASE_URL ?? PUBLIC_URLS.nearblocks,
    v3BaseUrl: process.env.NEARBLOCKS_V3_BASE_URL ?? PUBLIC_URLS.nearblocksV3,
    /** Most daily rows a v3 stats call returns (`limit` above it answers 422, checked 2026-11-04); each 25 rows of `limit` cost one credit. */
    maxDailyRows: 365,
    /** Minimum gap between calls: the free tier allows 6 calls a minute. */
    pacingMs: 10_500,
    /** Optional NearBlocks API key, sent as a Bearer token. */
    apiKey: process.env.NEARBLOCKS_API_KEY ?? null,
    docsUrl: "https://api.nearblocks.io/api-docs/",
  },
  github: {
    name: "GitHub",
    usedFor: "nearcore releases",
    baseUrl: "https://api.github.com",
    docsUrl: "https://github.com/near/nearcore/releases",
  },
  /** cryptopanic.com's own web API (no account). The posts feed is AES-encrypted with a key from its public web client. */
  cryptopanic: {
    name: "CryptoPanic",
    usedFor: "NEAR news headlines and summaries from many publishers",
    baseUrl: "https://cryptopanic.com",
    aesKey: ")b7Z*$+)/T}$9>/L",
    docsUrl: "https://cryptopanic.com/news/near/",
  },
  /** chaincatcher.com's own search API (plain JSON, no account). Its times are China Standard Time (UTC+8). */
  chaincatcher: {
    name: "ChainCatcher",
    usedFor: "NEAR news in English",
    baseUrl: "https://www.api.chaincatcher.com",
    siteUrl: "https://www.chaincatcher.com",
    docsUrl: "https://www.chaincatcher.com/en",
  },
  electricCapital: {
    name: "Electric Capital",
    usedFor: "Monthly active developers for NEAR, Ethereum, Solana and Bitcoin (adapted: indexed and sampled monthly)",
    baseUrl: "https://data.opendevdata.org",
    docsUrl: "https://data.opendevdata.org/manifest.json",
  },
} as const;

export type SourceKey = keyof typeof SOURCES;

/** A configured data source, or a cited publication that is not one (named only, without a link). */
export type SourceRef = SourceKey | { cite: string };

/** Bearer header for an optional API key. */
export const bearer = (apiKey: string | null): Record<string, string> => (apiKey ? { authorization: `Bearer ${apiKey}` } : {});

/** Request limits for every upstream call. A 429 without Retry-After waits rateLimitDelayMs, then twice that. */
export const HTTP_LIMITS = {
  timeoutMs: 15_000,
  retries: 2,
  retryBaseDelayMs: 1000,
  rateLimitDelayMs: 15_000,
} as const;

/** Account that holds NEAR bought back with NEAR Intents revenue. */
export const BUYBACK_ACCOUNT = "buybacks.multisignature.near";

/** Revenue wallets of the NEAR Intents front end and the 1Click API (listed on revenue.near.org), beside the buyback account. */
export const FRONTEND_FEE_ACCOUNT = "fefundsadmin.sputnik-dao.near";
export const ONE_CLICK_FEE_ACCOUNT = "1csfundsadmin.sputnik-dao.near";

/** Protocol treasury account, paid PROTOCOL_TREASURY_SHARE of every epoch's newly minted NEAR. */
export const PROTOCOL_TREASURY_ACCOUNT = "treasury.near";

/** NEAR Intents verifier contract; its daily transactions measure Intents activity. */
export const INTENTS_CONTRACT = "intents.near";

/** House of Stake voting contract, which holds the veNEAR votes on each proposal. */
export const HOUSE_OF_STAKE_CONTRACT = "vote.dao";

/** NEAR Protocol on each news source: CryptoPanic currency slug, ChainCatcher search keywords. */
export const NEAR_IDS = { cryptopanic: "near", chaincatcher: "NEAR Protocol" } as const;

/** Browser User-Agent for the sites' own web APIs, which reject unknown clients. */
export const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** CoinGecko ids whose daily price the lead-lag test reads through DefiLlama's coins API: NEAR, and BTC and ETH as the market. */
export const PRICE_HISTORY_COINS = { near: "near", btc: "bitcoin", eth: "ethereum" } as const;

/** Electric Capital ecosystem ids (ecosystems.parquet) for the developer comparison. */
export const DEVELOPER_ECOSYSTEMS = { near: 2817, ethereum: 2, solana: 391, bitcoin: 1 } as const;
