import { CodeTokens } from "@/components/ui/CodeTokens";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { COIN_PRICE_HISTORY_START, EPOCHS_RUN_BUDGET_MS, FRESH_INGEST_MINUTES } from "@/config/ingest";
import { EPOCH_LENGTH, HSP029 } from "@/config/protocol";
import {
  BUYBACK_ACCOUNT,
  FRONTEND_FEE_ACCOUNT,
  HOUSE_OF_STAKE_CONTRACT,
  INTENTS_CONTRACT,
  ONE_CLICK_FEE_ACCOUNT,
  PRICE_HISTORY_COINS,
  PROTOCOL_TREASURY_ACCOUNT,
  PUBLIC_URLS,
  SOURCES,
} from "@/config/sources";
import { formatCount } from "@/lib/format";
import { shellTokens } from "@/lib/shell-tokens";

const STEPS = `git clone <this repository> near-insights
cd near-insights
npm ci
pip install -r requirements.txt   # curl_cffi, for the Dune reader (Python 3.10 or later)
npm run ingest     # every source with its full history into data/dashboard.db; from empty about ${formatCount(FRESH_INGEST_MINUTES.withSnapshot, "minute")},
                   # as block headers older than snapshot/ are copied from it (about ${formatCount(FRESH_INGEST_MINUTES.withoutSnapshot, "minute")} without it)
npm run worker     # keeps every job on its schedule; each epochs run reads history for up to ${EPOCHS_RUN_BUDGET_MS / 60_000} minutes
npm run dev        # http://localhost:3000`;

const EPOCH_REQUESTS = String.raw`# NEAR minted and burned in the latest complete epoch, from block headers on an archival NEAR RPC node
curl -s ${PUBLIC_URLS.nearRpc} -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"validators","params":[null]}'
E=<result.epoch_start_height>
# A block by height, or by hash written as '"<hash>"'; a height with no block answers UNKNOWN_BLOCK
block() { curl -s ${PUBLIC_URLS.nearArchive} -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"block","params":{"block_id":'"$1"'}}'; }
block $E                # the current epoch's first block: its header.prev_hash is L, the last block of the latest complete epoch
block '"<L>"'           # S(last) = header.total_supply
block $((E-${EPOCH_LENGTH}))  # near that epoch's first block F: step until header.epoch_id matches L's and F's header.prev_hash
                        # equals F's header.next_epoch_id. S(first) = header.total_supply,
                        # B(first) = sum of chunks[].balance_burnt where height_included = F
block '"<prev_hash of F>"'  # the previous epoch's last block: S(previous last) = header.total_supply
# burned = S(first) − S(last) + B(first); minted = S(first) − S(previous last) + B(first), in yoctoNEAR`;

const RPC_REQUESTS = `# Validators of the current epoch
curl -s ${PUBLIC_URLS.nearRpc} -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"validators","params":[null]}'

# HSP-029 vote; args_base64 is {"proposal_id":${HSP029.proposalId}}
curl -s ${PUBLIC_URLS.nearRpc} -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"${HOUSE_OF_STAKE_CONTRACT}","method_name":"get_proposal","args_base64":"${btoa(JSON.stringify({ proposal_id: HSP029.proposalId }))}"}}'
# result.result is the proposal as UTF-8 JSON bytes: status, votes[].total_venear (for, against, abstain), snapshot_and_state.total_venear

# Max issuance (max_inflation_rate), gas rebate (transaction_costs.burnt_gas_reward), seats and minimum stake ratio
curl -s ${PUBLIC_URLS.nearRpc} -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"EXPERIMENTAL_protocol_config","params":{"finality":"final"}}'
# Latest final block (height, total supply, chunk gas) and the protocol version mainnet and testnet run
curl -s ${PUBLIC_URLS.nearRpc} -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"block","params":{"finality":"final"}}'
for rpc in ${PUBLIC_URLS.nearRpc} ${PUBLIC_URLS.nearTestnetRpc}; do
  curl -s $rpc -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"status","params":[]}'
done`;

const MARKET_REQUESTS = `# Price, market cap, FDV, rank and 1-year change of the top ${SOURCES.coingecko.marketsPageSize} coins
curl -s "${PUBLIC_URLS.coingecko}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${SOURCES.coingecko.marketsPageSize}&page=1&price_change_percentage=1y"
# NEAR's daily price (00:00 UTC) over 365 days; every NEAR amount bought is that day's USD ÷ this price
curl -s "${PUBLIC_URLS.coingecko}/coins/near/market_chart?vs_currency=usd&days=365&interval=daily"
# Each coin ranked above NEAR: circulating supply each day = market_caps ÷ prices
curl -s "${PUBLIC_URLS.coingecko}/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily"
# Longer daily NEAR, BTC and ETH price history for the lead-lag test (DefiLlama coins API, from ${COIN_PRICE_HISTORY_START},
# at most ${SOURCES.defillama.coinsMaxPoints} days a request, one coin at a time)
for id in ${Object.values(PRICE_HISTORY_COINS).join(" ")}; do
  curl -s "${PUBLIC_URLS.defillamaCoins}/chart/coingecko:$id?start=<unix seconds>&span=${SOURCES.defillama.coinsMaxPoints}&period=1d&searchWidth=600"
done`;

const OTHER_REQUESTS = `# nearcore releases
curl -s "${SOURCES.github.baseUrl}/repos/near/nearcore/releases?per_page=50"
# Monthly active developers: the manifest names eco_mads.parquet, read with HTTP range requests
curl -s "${SOURCES.electricCapital.baseUrl}/manifest.json"`;

const WALLET_REQUESTS = `# Today's balances of the three NEAR Intents fee wallets and the protocol treasury: amount + locked, in yoctoNEAR
for account in ${BUYBACK_ACCOUNT} ${FRONTEND_FEE_ACCOUNT} ${ONE_CLICK_FEE_ACCOUNT} ${PROTOCOL_TREASURY_ACCOUNT}; do
  curl -s ${PUBLIC_URLS.nearRpc} -H "content-type: application/json" \\
    -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_account","finality":"final","account_id":"'"$account"'"}}'
done
# End-of-day balances on the days each balance changed (amount + amount_staked); a day without a row keeps the last one.
# ${PROTOCOL_TREASURY_ACCOUNT} is the protocol treasury, paid its share of the NEAR minted each epoch
for account in ${BUYBACK_ACCOUNT} ${FRONTEND_FEE_ACCOUNT} ${ONE_CLICK_FEE_ACCOUNT} ${PROTOCOL_TREASURY_ACCOUNT}; do
  curl -s "${PUBLIC_URLS.nearblocksV3}/accounts/$account/stats/balance?limit=${SOURCES.nearblocks.maxDailyRows}"
done`;

const { dashboard, queries: duneQueries } = SOURCES.dune;

const DUNE_REQUESTS = `# NEAR Intents volume (public and confidential), swaps, fees, fees by channel, volume by chain and token, and TVL.
# Each query's SQL and latest result are public on the NEAR team's dashboard:
#   ${SOURCES.dune.baseUrl}/${dashboard.handle}/${dashboard.slug}
#   ${Object.entries(duneQueries)
    .map(([name, id]) => `${SOURCES.dune.baseUrl}/queries/${id}  (${name})`)
    .join("\n#   ")}
# The worker reads the same results with its Dune reader (curl_cffi; pip install -r requirements.txt):
echo '{"baseUrl":"${SOURCES.dune.baseUrl}","dashboard":${JSON.stringify(dashboard)},"queries":[${Object.values(duneQueries).join(",")}],"known":{},"signingKey":"${SOURCES.dune.signingKey}","retries":${SOURCES.dune.retries},"browsers":${JSON.stringify(SOURCES.dune.browsers)},"budgetSeconds":${SOURCES.dune.runBudgetMs / 1000}}' \\
  | python3 src/ingest/sources/dune.py   # python on Windows`;

const DEFILLAMA_REQUESTS = `# NEAR Intents volume, gross fees, revenue and buyback dollars; totalDataChart holds [unix seconds, USD] per day
# (volume and fees fill only the days Dune does not have)
curl -s "${PUBLIC_URLS.defillama}/summary/dexs/near-intents?excludeTotalDataChartBreakdown=true"
curl -s "${PUBLIC_URLS.defillama}/summary/fees/near-intents?dataType=dailyFees&excludeTotalDataChartBreakdown=true"
curl -s "${PUBLIC_URLS.defillama}/summary/fees/near-intents?dataType=dailyRevenue&excludeTotalDataChartBreakdown=true"
curl -s "${PUBLIC_URLS.defillama}/summary/fees/near-intents?dataType=dailyHoldersRevenue&excludeTotalDataChartBreakdown=true"
# Volume of every DEX on NEAR, and gas fees paid on NEAR
curl -s "${PUBLIC_URLS.defillama}/overview/dexs/near?excludeTotalDataChartBreakdown=true"
curl -s "${PUBLIC_URLS.defillama}/summary/fees/near?excludeTotalDataChartBreakdown=true"
# DeFi TVL and USD-pegged stablecoins on NEAR
curl -s "${PUBLIC_URLS.defillama}/v2/historicalChainTvl/Near"
curl -s "${PUBLIC_URLS.defillamaStablecoins}/stablecoincharts/Near"`;

const NEARBLOCKS_REQUESTS = `# Last day NearBlocks has finished its daily stats for
curl -s "${PUBLIC_URLS.nearblocksV3}/sync/status/daily-stats"
# Daily transactions, relayed transactions (meta_txns), txn_fee (NEAR); total_supply (yoctoNEAR);
# accounts acting through relayers (meta_accounts); up to ${SOURCES.nearblocks.maxDailyRows} days
curl -s "${PUBLIC_URLS.nearblocksV3}/txn-stats?limit=${SOURCES.nearblocks.maxDailyRows}"
curl -s "${PUBLIC_URLS.nearblocksV3}/block-stats?limit=${SOURCES.nearblocks.maxDailyRows}"
curl -s "${PUBLIC_URLS.nearblocksV3}/address-stats?limit=${SOURCES.nearblocks.maxDailyRows}"
# Active accounts (transaction signers) and new accounts since genesis (API v1); also transactions, fees and total supply
# for the days before v3's ${SOURCES.nearblocks.maxDailyRows}
curl -s "${PUBLIC_URLS.nearblocks}/charts"
# Daily ${INTENTS_CONTRACT} transactions
curl -s "${PUBLIC_URLS.nearblocksV3}/accounts/${INTENTS_CONTRACT}/stats/txns?limit=${SOURCES.nearblocks.maxDailyRows}"`;

const REQUESTS = [
  { title: "Run the dashboard", code: STEPS },
  { title: "NEAR minted and burned, from block headers", code: EPOCH_REQUESTS },
  { title: "Validators, the HSP-029 vote and protocol settings", code: RPC_REQUESTS },
  { title: "Fee wallet and treasury balances", code: WALLET_REQUESTS },
  { title: "NEAR Intents volume, swaps, fees and TVL (Dune)", code: DUNE_REQUESTS },
  { title: "NEAR Intents revenue and buyback dollars, DEX volume, DeFi TVL and stablecoins (DefiLlama)", code: DEFILLAMA_REQUESTS },
  { title: "Chain activity and intents.near transactions (NearBlocks)", code: NEARBLOCKS_REQUESTS },
  { title: "Prices, market caps and circulating supply (CoinGecko, DefiLlama)", code: MARKET_REQUESTS },
  { title: "nearcore releases and developers", code: OTHER_REQUESTS },
];

/** Every request behind the dashboard's numbers (news requests are not listed), one folding section per group; the first is
    open and each has a copy button. */
export function RerunPanel() {
  return (
    <Panel id="rerun" title="Re-run the data yourself">
      <div>
        {REQUESTS.map(({ title, code }, i) => (
          <div key={title} className="relative border-t border-line first:border-t-0">
            <details open={i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-2.5 py-2 pl-0.5 text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 py-[4.5px]">{title}</span>
                <span aria-hidden="true" className="flex shrink-0 items-center gap-0.5">
                  <span className="size-[30px]" />
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-muted transition-transform group-open:rotate-180">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </span>
              </summary>
              <pre className="m-0 mb-3 overflow-hidden rounded-[8px] bg-surface-3 px-3.5 py-3 text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-ink">
                <CodeTokens pieces={shellTokens(code)} />
              </pre>
            </details>
            {/** Over the space the summary keeps for it, outside the section: a summary is a button, so a button inside it is
                not announced, and a closed section hides everything but its summary. */}
            <span className="absolute top-2 right-[18px]">
              <CopyButton text={code} label={title} />
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
