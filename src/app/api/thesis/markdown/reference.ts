/** The thesis document's reference parts: the data and method, what could not be measured, how to reproduce it, and the formulas. */
import {
  ARCHIVAL_RPC,
  COINGECKO,
  COINGECKO_MARKETS,
  DASH,
  day,
  DEFILLAMA,
  DEFILLAMA_COINS,
  DEFILLAMA_STABLECOINS,
  EXPLORER_SWAPS,
  FASTNEAR_RPC,
  GITHUB,
  NEAR_DAILY_PRICE,
  NEARBLOCKS_V1,
  NEARBLOCKS_V3,
  OPEN_DEV_DATA,
  reading,
  sectionHeading,
  table,
  TESTNET_RPC,
  type ThesisDocumentInput,
} from "@/app/api/thesis/markdown/format";
import { sectionNumber } from "@/app/api/thesis/markdown/section";
import { EPOCH_HISTORY_START, MAX_PULL_BACK_DAYS } from "@/config/ingest";
import { DEFILLAMA_PUBLIC_ONLY, NO_REFERRAL } from "@/config/intents";
import { LEAD_LAG } from "@/config/lead-lag";
import { PEER_SUPPLY_GROWTH } from "@/config/peers";
import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import { BUYBACKS_START_DAY, HSP029, PROTOCOL_TREASURY_SHARE, TRANSFER_TGAS } from "@/config/protocol";
import {
  BUYBACK_ACCOUNT,
  DEVELOPER_ECOSYSTEMS,
  FRONTEND_FEE_ACCOUNT,
  HOUSE_OF_STAKE_CONTRACT,
  INTENTS_CONTRACT,
  ONE_CLICK_FEE_ACCOUNT,
  PROTOCOL_TREASURY_ACCOUNT,
  SOURCES,
} from "@/config/sources";
import { BOUGHT_GROWTH_RANGE, TRIGGERS } from "@/config/thesis-triggers";
import { DUNE_QUERY_DATA } from "@/content/source-requests";
import { SECTIONS } from "@/content/thesis";
import { formatCount, formatInteger, formatPercent, formatUsd } from "@/lib/format";
import { DAY_SECONDS, dayTime } from "@/lib/metrics";
import { TRIGGER_STATUS_LABEL } from "@/lib/thesis/triggers";

/** Section `n`: metrics the thesis would use that the free sources cannot give, and why; nothing is estimated in their place. */
export function notMeasured(input: ThesisDocumentInput, n: number): string {
  const measuredFrom = input.metrics.issuance?.measuredFrom ?? EPOCH_HISTORY_START;
  const confidential = input.metrics.intents?.confidentialShare30d;
  const lines = [
    `- **Days since March 2026 from the NEAR BigQuery public dataset (\`bigquery-public-data.crypto_near_mainnet_us\`).** The dataset is loaded from NEAR Lake, which NEAR's docs say "was deprecated on March 24, 2026 and no longer indexes new blocks" (docs.near.org/data-infrastructure/big-query). The same page says the dataset itself remains available, but its loader repository (github.com/near/near-public-lakehouse) names no source other than NEAR Lake. The thesis needs windows of 30 to 365 days ending on the data-through day, and buybacks began on ${BUYBACKS_START_DAY}, so daily transactions and active and new accounts come from NearBlocks instead. Its Q2 2026 averages match Nansen's NEAR report for that quarter: 854K transactions and 121K active addresses a day (nansen.ai/post/nansen-near-quarterly-report-q2-2026).`,
    `- **Single NEAR Intents swaps.** The NEAR Intents Explorer API lists every 1Click swap, but its terms allow no API data to be kept beyond 24 hours. The worker therefore adds up each finished day's swaps by referral and stores only those daily totals. Single swap sizes, routes and solvers are not measured, and the API does not list swaps made outside 1Click (section ${sectionNumber("capture")} compares the 1Click swaps' app fees with all NEAR Intents gross fees). The data also does not show how each app fee splits between the front end and NEAR Intents, so the share of fees that buys NEAR comes from DefiLlama's revenue and buybacks.`,
    `- **Accounts that swapped through NEAR Intents.** No query on the NEAR team's Dune dashboard counts them by day. NearBlocks' count covers public swaps only and leaves out confidential swaps${confidential == null ? "" : ` (${formatPercent(confidential, 1)} of volume over the 30 days to ${input.metrics.intents?.duneThrough ?? DASH})`}, so it is not used.`,
    "- **Contract usage beyond `intents.near`.** The free sources give daily transactions of named contracts, not a ranking of all contracts, so the dashboard measures only the contract the thesis rests on.",
    `- **Burn and issuance before ${measuredFrom}.** The stored epoch block headers start that day${measuredFrom > EPOCH_HISTORY_START ? ` and are read back toward ${EPOCH_HISTORY_START}` : ""}; longer windows show "${DASH}" until the stored epochs cover them.`,
    "- **The trades that buy NEAR.** DefiLlama's buybacks are the NEAR and wNEAR that reach the three fee wallets (its `near-intents` adapter in github.com/DefiLlama/dimension-adapters), and it books the same inflow as revenue. This paper measures NEAR delivered to the wallets, not the swaps that bought it, so buybacks ÷ revenue is 100% by construction.",
    "- **NEAR bought and later sold.** The fee wallets' balances are measured, but a sale cannot be told apart from another outflow without labeling every counterparty.",
  ];
  return [
    sectionHeading(`${n}. What we could not measure`, "🚫"),
    "The free sources cannot give the following, and nothing is estimated in their place.",
    lines.join("\n"),
  ].join("\n\n");
}

/** Where `through` falls against the snapshot day: ", 5 days before the snapshot", ", the snapshot day" or ", 1 day after the snapshot". */
function fromSnapshot(through: string, snapshot: string): string {
  const days = Math.round((dayTime(snapshot) - dayTime(through)) / DAY_SECONDS);
  return days === 0 ? ", the snapshot day" : `, ${formatCount(Math.abs(days), "day")} ${days > 0 ? "before" : "after"} the snapshot`;
}

/** Section 2: where the numbers come from, the days they run to, and how a section tests its claim. */
export function dataAndMethod(input: ThesisDocumentInput): string {
  const { market, protocol, activity, feeChain, dataThrough } = input.metrics;
  const lines = [
    `- **Snapshot:** ${input.snapshot}. \`npm run thesis\` writes this document from the dashboard's database (\`GET /api/thesis\`). The dashboard updates as the worker stores new data; this document is a dated copy.`,
    `- **Data through:** flow windows end on **${dataThrough ?? DASH}**${dataThrough ? fromSnapshot(dataThrough, input.snapshot) : ""}. Windows built on Intents gross fees (the fee chain, the fee rate and the share of fees that buys NEAR) end on ${day(feeChain?.through)}, and NearBlocks figures (transactions and accounts) on ${day(activity?.through)}. The first item of Appendix A gives the rule behind each day.`,
    `- **NEAR Intents:** volume (public and confidential), swaps, fees, volume by chain and token, fees by channel and TVL come from the NEAR team's Dune dashboard (\`${SOURCES.dune.baseUrl}/${SOURCES.dune.dashboard.handle}/${SOURCES.dune.dashboard.slug}\`), which refreshes about once a day. On a day Dune does not have, volume and fees come from DefiLlama. DefiLlama is not the primary source because from ${DEFILLAMA_PUBLIC_ONLY.label} it counted only public swaps. Revenue and buybacks come from DefiLlama.`,
    `- **Market:** ${market ? `NEAR at **${formatUsd(market.priceUsd)}**, rank **#${market.rank}**, market cap **${formatUsd(market.marketCapUsd)}**` : DASH} (CoinGecko, ${reading(input.marketAsOf)}).`,
    `- **Network:** ${protocol ? `mainnet runs **protocol ${protocol.mainnet}**; testnet runs ${protocol.testnet}` : DASH}.`,
    `- **Burn and issuance:** measured epoch by epoch from block headers on a NEAR archival RPC node (FastNEAR's by default), from ${input.metrics.issuance?.measuredFrom ?? EPOCH_HISTORY_START}.`,
    "- **Units:** issuance is paid in NEAR, so buybacks are measured in NEAR too: each day's dollar amount is converted at that day's NEAR price. Burn is read in NEAR from block headers.",
    `- **Windows:** Intents buybacks began on ${BUYBACKS_START_DAY}. Growth compares the last 90 days with the 90 days before; year-on-year compares the last 30 days with the same 30 days a year earlier.`,
    `- **Missing values:** "${DASH}" marks a window the database does not cover yet. Nothing is estimated in its place.`,
    `- **Statuses:** each breaking point is **${TRIGGER_STATUS_LABEL["not-happened"]}** (not reached), **${TRIGGER_STATUS_LABEL.happened}** (reached), **${TRIGGER_STATUS_LABEL["too-close"]}** (the measured range spans the limit) or **${TRIGGER_STATUS_LABEL["no-data"]}** (the data does not cover it).`,
  ];
  return [sectionHeading("2. Data and method", "🗂️"), lines.join("\n")].join("\n\n");
}

/** Section `n`: the commands that rebuild every number, and the request behind each dataset. */
export function howToReproduce(n: number): string {
  const proposalArgs = btoa(JSON.stringify({ proposal_id: HSP029.proposalId }));
  const rows = [
    [
      "Every number in this document",
      "`npm run rebuild` (every source, a new snapshot and this document) or `npm run verify` (offline, from the committed snapshot); setup and run times are under Reproduce and verify in [README.md](README.md)",
    ],
    [
      "The SQL behind every chart",
      "`/dashboard/queries` on the dashboard, `GET /api/query/{id}` (add `?format=csv` for CSV), or `npm run query -- {id}` (add `--db snapshot/dashboard.db` for the snapshot)",
    ],
    ["Market cap, FDV, rank", `\`GET ${COINGECKO_MARKETS}\``],
    ["Daily NEAR price and market cap", NEAR_DAILY_PRICE],
    [
      "Daily NEAR, BTC and ETH prices for the lead-lag test",
      `\`GET ${DEFILLAMA_COINS}/chart/coingecko:near?start={unix}&span=${SOURCES.defillama.coinsMaxPoints}&period=1d&searchWidth=600\`, then \`bitcoin\` and \`ethereum\` (at most ${SOURCES.defillama.coinsMaxPoints} points a request)`,
    ],
    ["Peer circulating supply", `\`GET ${COINGECKO}/coins/{id}/market_chart?vs_currency=usd&days=365&interval=daily\` (the public API serves at most 365 days)`],
    [
      "Max issuance rate, shards, contract gas rebate",
      `\`POST ${FASTNEAR_RPC}\` with \`{"jsonrpc":"2.0","id":1,"method":"EXPERIMENTAL_protocol_config","params":{"finality":"final"}}\`. \`protocol_reward_rate\` reads [0, 1], a fraction equal to 0, but nearcore hard-codes the ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} treasury share.`,
    ],
    ["Total supply, gas price", `Same endpoint, \`block\` with \`{"finality":"final"}\``],
    [
      "NEAR minted and burned per epoch",
      `\`POST ${ARCHIVAL_RPC}\` with \`{"jsonrpc":"2.0","id":1,"method":"block","params":{"block_id":<height or hash>}}\` for the three blocks named in Appendix A; each epoch's previous block is read by the hash in the next block's \`prev_hash\``,
    ],
    ["Validators, stake", "Same endpoint as the max issuance rate, `validators` with `[null]`"],
    ["Protocol status", `\`status\` on \`${FASTNEAR_RPC}\` and \`${TESTNET_RPC}\``],
    ["nearcore releases (protocol upgrades shipped)", `\`GET ${GITHUB}/repos/near/nearcore/releases?per_page=50\``],
    [
      "Fee wallet balances",
      `\`query\` with \`{"request_type":"view_account","finality":"final","account_id":"<wallet>"}\` for ${BUYBACK_ACCOUNT}, ${FRONTEND_FEE_ACCOUNT} and ${ONE_CLICK_FEE_ACCOUNT}; past days: NearBlocks \`GET ${NEARBLOCKS_V3}/accounts/<wallet>/stats/balance?limit=${SOURCES.nearblocks.maxDailyRows}\``,
    ],
    [
      "Protocol treasury balance",
      `The same two requests for ${PROTOCOL_TREASURY_ACCOUNT}`,
    ],
    [
      "HSP-029 vote",
      `\`query\` with \`{"request_type":"call_function","finality":"final","account_id":"${HOUSE_OF_STAKE_CONTRACT}","method_name":"get_proposal","args_base64":"${proposalArgs}"}\` (\`{"proposal_id":${HSP029.proposalId}}\`)`,
    ],
    ...Object.entries(SOURCES.dune.queries).map(([name, id]) => [
      `NEAR Intents ${DUNE_QUERY_DATA[name as keyof typeof SOURCES.dune.queries]}`,
      `Dune query ${id} on \`${SOURCES.dune.baseUrl}/${SOURCES.dune.dashboard.handle}/${SOURCES.dune.dashboard.slug}\`: SQL and latest result at \`${SOURCES.dune.baseUrl}/queries/${id}\``,
    ]),
    ["NEAR Intents 1Click swaps, volume and app fees by referral", EXPLORER_SWAPS],
    ["Intents volume on days Dune does not have", `\`GET ${DEFILLAMA}/summary/dexs/near-intents?excludeTotalDataChartBreakdown=true\``],
    [
      "Intents revenue, buybacks (and gross fees on days Dune does not have)",
      `\`GET ${DEFILLAMA}/summary/fees/near-intents?dataType=dailyRevenue&excludeTotalDataChartBreakdown=true\`, then with \`dailyHoldersRevenue\` and \`dailyFees\``,
    ],
    ["DEX volume on NEAR", `\`GET ${DEFILLAMA}/overview/dexs/near?excludeTotalDataChartBreakdown=true\``],
    ["Gas fees", `\`GET ${DEFILLAMA}/summary/fees/near?excludeTotalDataChartBreakdown=true\``],
    ["TVL, stablecoins on NEAR", `\`GET ${DEFILLAMA}/v2/historicalChainTvl/Near\`, \`GET ${DEFILLAMA_STABLECOINS}/stablecoincharts/Near\``],
    [`Daily ${INTENTS_CONTRACT} transactions`, `\`GET ${NEARBLOCKS_V3}/accounts/${INTENTS_CONTRACT}/stats/txns?limit=${SOURCES.nearblocks.maxDailyRows}\``],
    ["Last day NearBlocks has finished its daily figures", `\`GET ${NEARBLOCKS_V3}/sync/status/daily-stats\``],
    [
      "Transactions, fees, total supply, relayed transactions and relayed accounts",
      `\`GET ${NEARBLOCKS_V3}/txn-stats\`, \`/v3/block-stats\` and \`/v3/address-stats\`, each with \`?limit=${SOURCES.nearblocks.maxDailyRows}\` (the most it serves)`,
    ],
    ["Active and new accounts (every day); transactions, fees and supply before v3's window", `\`GET ${NEARBLOCKS_V1}/charts\``],
    [
      "Developers",
      `\`${OPEN_DEV_DATA}/manifest.json\`, \`eco_mads.parquet\` (ids: NEAR ${DEVELOPER_ECOSYSTEMS.near}, Ethereum ${DEVELOPER_ECOSYSTEMS.ethereum}, Solana ${DEVELOPER_ECOSYSTEMS.solana}, Bitcoin ${DEVELOPER_ECOSYSTEMS.bitcoin})`,
    ],
  ];
  return [
    sectionHeading(`${n}. How to reproduce this`, "🔁"),
    "Every source is free. All are public except the NEAR Intents Explorer API, which needs a free partner key. Each request below returns one dataset on its own.",
    table(["Data", "Request"], rows),
  ].join("\n\n");
}

export const FORMULAS = [
  `Every flow window ends on \`dataThrough\`: the last day that Intents volume, Intents buybacks, gas fees and the NEAR price all have, or, when one of them or NEAR minted or burned misses a day in the 30 days before it, the latest earlier day (at most ${MAX_PULL_BACK_DAYS} days back) whose 30 days are all stored, so one missing day dates the figures earlier instead of emptying them. A metric built on another series (DEX volume) shows "${DASH}" unless that series has data on every day of its window. Metrics on Intents gross fees and revenue end on the last day both have, at most \`dataThrough\` and usually a day before it, as the newest day of fees is still filling, and earlier by the same missing-day rule applied to fees, revenue and Intents volume. NearBlocks metrics end on the last day their own series share. NEAR Intents swaps, average swap and confidential share, from Dune alone, end on the last day Dune's swaps and confidential volume both have, at most \`dataThrough\`, and earlier by the same missing-day rule.`,
  "The worker keeps DefiLlama's flow series only through the day before yesterday (UTC), because DefiLlama finishes a day's total during the next day.",
  "NEAR bought each day = that day's Intents buybacks (USD) ÷ that day's NEAR price. Gas fees in NEAR = that day's gas fees (USD) ÷ that day's price.",
  "Per epoch, from block headers: S is a block's `total_supply` and B is the sum of `balance_burnt` over the chunks that block produced (`height_included` equal to its height). NEAR burned = S(first block) − S(last block) + B(first block). NEAR minted = S(first block) − S(last block of the previous epoch) + B(first block); it is the reward for the epoch before. Each epoch is spread over the UTC days it covers in proportion to time, and only fully covered days are kept.",
  "Measured burn share = NEAR burned ÷ gas fees in NEAR over the same 30 days.",
  "Measured issuance rate = NEAR minted over 30 (or 365) days × 365 ÷ the days ÷ total supply at the window's start.",
  `New supply absorbed = (NEAR burned + NEAR bought) ÷ NEAR minted, over the same days: 30 days, 90 days, from ${BUYBACKS_START_DAY} through \`dataThrough\`, 365 days, and each calendar month. Burned NEAR leaves total supply. Bought NEAR is held in the three fee wallets, off the market; it is not burned, so it stays in total supply (CoinGecko's circulating supply still counts it). The supply breaking point compares the 90 days to \`dataThrough\` with the 90 days before.`,
  "NEAR Intents volume and gross fees each day = the NEAR team's Dune value for that day, or DefiLlama's on a day Dune does not have. Dune keeps the days before the day it ran the query and drops one more day of fees, since a run's newest day of fees is still filling. DefiLlama's fees copy Dune's, that day included, so DefiLlama's newest day of fees is left out too.",
  `Fee chain, in four steps, over the 30 and 90 days to the last day Intents fees and revenue both have: NEAR Intents volume, the gross fees charged on it, the revenue kept from those fees (DefiLlama \`dailyRevenue\`), and the buybacks paid from that revenue (\`dailyHoldersRevenue\`). Fee rate = gross fees ÷ volume; fees per $1M swapped = fee rate × 1,000,000; each later step is also shown as a share of the step before (revenue ÷ fees, buybacks ÷ revenue). Capture rate (share of fees that buys NEAR) = buybacks ÷ gross fees, also from ${BUYBACKS_START_DAY} to that day. Share of volume that buys NEAR = buybacks ÷ volume; it needs no fees, so its windows (the 90-day rows, break-even and the projections) end on \`dataThrough\`.`,
  "Share of DEX volume = DefiLlama's NEAR Intents volume ÷ the volume of every DEX DefiLlama tracks on NEAR, which includes NEAR Intents, over 30 and 180 days; both from DefiLlama, so they count the same swaps.",
  "Swaps, public and confidential, compare the 30-day total with the same 30 days a year earlier. Average swap = volume ÷ swaps over the same 30 days. Confidential share = confidential volume ÷ all volume, over 30 days and in 7-day blocks.",
  "Chain mix and stablecoin share: Dune's volume by chain and its volume by token each sum to its total volume, so the shares add up to 100%. Stablecoin share = volume under the symbols in `STABLECOIN_SYMBOLS` (`src/config/intents.ts`) ÷ all volume.",
  `1Click swaps by referral: for each UTC day, once the day after it has ended, the completed swaps the Explorer API lists as created that day, added up by referral (\`${NO_REFERRAL}\` when a swap carries none). Volume = \`amountInUsd\`; app fees = each fee's basis points × \`amountInUsd\` ÷ 10,000. Over the 30 days to the newest stored day: largest referral's share of fees = its app fees ÷ all app fees; fee rate = app fees ÷ volume. 1Click share of gross fees = app fees ÷ NEAR Intents gross fees over the 30 days to the last day both have.`,
  `Share of transactions = ${INTENTS_CONTRACT} transactions over 30 days ÷ all NEAR transactions over the same 30 days, ending on the last day both NearBlocks series have.`,
  "Chain activity: transactions and new accounts compare the 30-day total with the same 30 days a year earlier. Active accounts compare the median daily count of the 30 days with the median of the same 30 days a year earlier.",
  "Monthly growth rate of NEAR bought = (1 + the change of NEAR bought over the 90 days to `dataThrough` against the 90 days before)^(365 ÷ 12 ÷ 90) − 1, a month being 365 ÷ 12 days as in the projection.",
  `Its ${formatPercent(BOUGHT_GROWTH_RANGE.level, 0)} range = the ${formatPercent((1 - BOUGHT_GROWTH_RANGE.level) / 2, 1)} and ${formatPercent(1 - (1 - BOUGHT_GROWTH_RANGE.level) / 2, 1)} quantiles of the same rate over ${formatInteger(BOUGHT_GROWTH_RANGE.draws)} draws, each rebuilding both 90-day windows from stationary blocks of their own days (${BOUGHT_GROWTH_RANGE.meanBlock} days long on average, wrapping at the end, seed ${BOUGHT_GROWTH_RANGE.seed}). The valuation breaking point holds while the whole range is at or above the growth needed, breaks while all of it is below, and is too close to call in between.`,
  `Growth needed = the monthly growth of NEAR bought, with the burn held at its starting rate, at which NEAR burned plus bought equals issuance in month ${COVERAGE_HORIZON_MONTHS} of a month-by-month projection (found by bisection). The projection starts from the buyback dollars of the 30 days to \`dataThrough\`, converted at today's price (the NEAR they buy while the price holds). The burn starts from the same 30 days' gas fees in NEAR × the share burned: all of it once mainnet pays no gas to contracts (\`burnt_gas_reward\` 0), the measured burn share before that. Both are scaled to a month (× 365 ÷ 30 ÷ 12). Issuance each month = total supply at the month's start × the max issuance rate ÷ 12, starting from today's total supply (NEAR RPC \`block\`), not from the NEAR minted. The projection holds the price and the max issuance rate fixed, adds issuance to supply and removes the burn; burn and buying never take more than the NEAR not yet bought.`,
  "Run rate = (NEAR burned + NEAR bought over the 30 days to `dataThrough`) × 365 ÷ 30 × today's price. Market cap ÷ (burn + buybacks a year) = market cap ÷ run rate. (Burn + buybacks a year) ÷ market cap = run rate ÷ market cap.",
  "Market cap ÷ network revenue = each day's market cap ÷ ((NEAR Intents revenue + gas fees over the 30 days to that day) × 365 ÷ 30), from the first 30-day window that starts on or after the first day of the first month with Intents revenue on every day. Market cap at the lowest, median and highest of those multiples = each multiple × the yearly revenue behind the latest one: a range against NEAR's own history, not a fair value.",
  "Break-even, over 30 and 90 days: multiple = NEAR minted ÷ (NEAR burned + NEAR bought). Needed NEAR = NEAR minted − NEAR burned (not below 0). Intents volume a day at which burn + buybacks match issuance = needed NEAR × today's price ÷ the window's share of volume that buys NEAR ÷ its days. It is compared with the window's Intents volume ÷ its days.",
  `Fee wallets: \`amount\` + \`locked\` from \`view_account\` for ${BUYBACK_ACCOUNT}, ${FRONTEND_FEE_ACCOUNT} and ${ONE_CLICK_FEE_ACCOUNT}; today keeps its last reading. Each finished day since ${BUYBACKS_START_DAY} is NearBlocks' end-of-day balance (\`amount\` + \`amount_staked\`), which it records only on days the balance changed; a day without a record keeps the last one. The 30-day change is the change of the three balances combined. Largest daily gap = for each day of the 30 days, the NEAR bought since the window began − the three wallets' gain since then, the largest of those 30 values (not below 0). The breaking point of *${SECTIONS.capture.title}* is reached when it exceeds ${formatPercent(TRIGGERS.walletShortfallShare, 0)} of the 30 days' NEAR bought.`,
  `Protocol treasury: ${PROTOCOL_TREASURY_ACCOUNT}'s balance, read the same way. Its paid share = ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} × NEAR minted over the 30 days to \`dataThrough\` (or earlier: the last day both are stored, or before a day missing from NEAR minted), against the balance's gain over those days; a lower gain means the treasury sent NEAR to other accounts.`,
  `HSP-029: \`get_proposal\` on \`${HOUSE_OF_STAKE_CONTRACT}\` with \`{"proposal_id":${HSP029.proposalId}}\`. Share for = veNEAR for ÷ all veNEAR voted, abstentions included.`,
  "Total supply growth = the change of on-chain total supply over 365 days (NearBlocks daily history plus the worker's own daily reading).",
  `Peer supply growth = the median CoinGecko circulating supply (market cap ÷ price) of the newest ${PEER_SUPPLY_GROWTH.endDays} days ÷ the median of the ${PEER_SUPPLY_GROWTH.endDays} days ending 365 days earlier (or the first ${PEER_SUPPLY_GROWTH.endDays} stored days), scaled to a year, − 1, for coins with at least ${PEER_SUPPLY_GROWTH.minHistoryDays} days of history. Medians stop a single wrong reading from moving the result.`,
  `Gross staking yield = NEAR minted over the 30 days to \`dataThrough\` × 365 ÷ 30 × (1 − the ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} treasury share) ÷ NEAR staked in the latest epoch. Chunk-validator seat = total stake × \`minimum_stake_ratio\`. Block-producer seat = the smallest stake among validators with \`num_expected_blocks\` > 0. Nakamoto coefficient = the fewest validators whose stake exceeds a third of all stake.`,
  "Staking yield after supply growth = (1 + gross staking yield) ÷ (1 + total supply growth over the same 30 days, a yearly rate) − 1, where total supply growth = (NEAR minted − NEAR burned) ÷ total supply at the window's start × 365 ÷ 30; bought NEAR stays in total supply, so it is not subtracted.",
  "NEAR bought a year at this pace ÷ circulating NEAR = NEAR bought over 30 days × 365 ÷ 30 ÷ (market cap ÷ price).",
  "Revenue in NEAR = each day's Intents revenue (USD) ÷ that day's NEAR price. Each month's revenue a day (its sum ÷ the days with revenue), in USD and in NEAR, is indexed to 100 in the first month with revenue on every day; only such months are shown (earlier revenue arrived in occasional lumps).",
  `Lead-lag test: weekly log changes in 7-day blocks ending on \`dataThrough\` (blocks need all seven days): Intents volume summed, prices at the close of the block's last day (the next day's 00:00 UTC price), active accounts averaged. The sample starts at the first week with at least ${formatUsd(LEAD_LAG.minWeeklyVolumeUsd)} of Intents volume. NEAR's return beyond the market = the residual of an ordinary least-squares fit of NEAR's weekly return on the average of BTC's and ETH's. Correlation at lag k = Pearson correlation of x with y k weeks later. p = (1 + draws with |r| at least the observed) ÷ (1 + draws), over ${formatInteger(LEAD_LAG.nullDraws)} stationary block bootstraps of x (blocks of ${LEAD_LAG.meanBlockWeeks} weeks on average, wrapping at the end, seed ${LEAD_LAG.seed}), which keep x's week-to-week pattern and break its alignment with y. Holm adjustment across every test; significant at ${formatPercent(LEAD_LAG.alpha, 0)}.`,
  `Transfer cost = gas price × ${TRANSFER_TGAS} Tgas × the NEAR price.`,
  "Block time = seconds between the first and the last block-height sample of the window ÷ the blocks between them; the worker samples the latest final block every minute.",
  "Protocol upgrades shipped = stable (not release-candidate) nearcore releases on GitHub whose version ends in .0, published in the last 365 days; shown only when the stored releases reach back that far.",
];
