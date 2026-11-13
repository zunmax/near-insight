/** Thesis section 3: issuance, total supply, the share of new supply absorbed, staking, the treasury and HSP-029. */
import { absorbed, COINGECKO_MARKETS, DASH, DEFILLAMA, daysTo, EPOCH_HEADERS, monthEntry, NEAR_DAILY_PRICE, NEARBLOCKS_V1, NEARBLOCKS_V3, reading, show, type ThesisDocumentInput } from "@/app/api/thesis/markdown/format";
import { section } from "@/app/api/thesis/markdown/section";
import { BUYBACKS_START_DAY, FULL_BURN_PROTOCOL, HSP029, MAX_ISSUANCE_HALVED_DAY, PREVIOUS_MAX_INFLATION, PROTOCOL_TREASURY_SHARE } from "@/config/protocol";
import { HOUSE_OF_STAKE_CONTRACT, PROTOCOL_TREASURY_ACCOUNT, SOURCES } from "@/config/sources";
import { formatMultiple, formatNear as near, formatPercent, formatPercentFromFull } from "@/lib/format";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { proposalStatusLabel } from "@/lib/thesis/proposal-status";

/** The full-burn rule and why the measured burn share can sit below 100%. */
function fullBurnNote(input: ThesisDocumentInput): string {
  const { supply: s, protocol: p, seed, dataThrough: t } = input.metrics;
  /** Without both protocol readings, the protocol's burn share of gas fees (1 once no gas is paid to contracts) decides. */
  const live = p ? p.mainnet >= FULL_BURN_PROTOCOL : s?.burnShareOfFees === 1;
  const rebate = live
    ? ` Before protocol ${FULL_BURN_PROTOCOL}, the protocol returned part of contract-call gas to the contract (\`burnt_gas_reward\`).`
    : s
      ? ` Until then, the protocol returns ${formatPercent(1 - s.burnShareOfFees, 0)} of contract-call gas to the contract (\`burnt_gas_reward\`); transfers and fixed costs burn all of their gas.`
      : "";
  const measured = seed
    ? ` Measured over the ${daysTo(30, t)}, ${formatPercentFromFull(seed.measuredBurnShare, 1)} of all gas fees were burned${
        live && seed.measuredBurnShare < 1
          ? `; days in the window before mainnet ran protocol ${FULL_BURN_PROTOCOL} still paid part of contract-call gas to contracts, and DefiLlama's fee count can differ from the burn read from block headers`
          : ""
      }.`
    : "";
  const rule = live
    ? `Protocol ${FULL_BURN_PROTOCOL} (HSP-027) removed the gas rebate to contracts, so all gas is burned.`
    : `Protocol ${FULL_BURN_PROTOCOL} (HSP-027) removes the gas rebate to contracts, so all gas is burned once mainnet runs it.`;
  return `**Full burn.** ${rule}${rebate}${measured}`;
}

export function supplySection(input: ThesisDocumentInput): string {
  const m = input.metrics;
  const { supply: s, issuance: iss, absorption: a, staking, market, hsp029, treasury, dataThrough: t } = m;
  const network = reading(input.network?.fetchedAt);
  const epoch = `epoch ${show(staking?.epochHeight, String)}`;
  const monthly = a?.monthly.length ? a.monthly.map((row) => monthEntry(row.month, formatPercent(row.share, 1), row.days)).join(", ") : DASH;
  return section(
    3,
    "supply",
    input,
    [
      [`Max issuance (${formatPercent(PREVIOUS_MAX_INFLATION, 0)} before ${MAX_ISSUANCE_HALVED_DAY})`, show(s?.maxInflationRate, (v) => `${formatMaxIssuance(v)} a year`), network],
      ["NEAR minted, measured from block headers", show(iss?.minted30dNear, near), daysTo(30, t)],
      ["Measured issuance, yearly rate (NEAR minted ÷ supply at the window's start)", show(iss?.rate30d, (v) => formatPercent(v)), daysTo(30, t)],
      ["NEAR minted, measured from block headers", show(iss?.minted1yNear, near), daysTo(365, t)],
      ["Measured issuance, yearly rate (NEAR minted ÷ supply at the window's start)", show(iss?.rate1y, (v) => formatPercent(v)), daysTo(365, t)],
      ["Total supply", show(s?.totalSupplyNear, (v) => near(v, 2)), network],
      ["Total supply growth", show(s?.growth1y, (v) => formatPercent(v)), daysTo(365, s?.growthThrough ?? null)],
      ["New supply absorbed: (burned + bought) ÷ minted", show(a?.d30, absorbed), daysTo(30, t)],
      ["New supply absorbed", show(a?.d90, absorbed), daysTo(90, t)],
      ["New supply absorbed", show(a?.sinceBuybacks, absorbed), `${BUYBACKS_START_DAY} to ${t ?? DASH}`],
      ["New supply absorbed", show(a?.d365, absorbed), daysTo(365, t)],
      ["New supply absorbed by month", monthly, a ? `calendar months to ${a.monthlyThrough}` : DASH],
      ["Staked share of total supply", show(staking?.stakedShare, (v) => formatPercent(v, 1)), epoch],
      [
        `Gross staking yield, before validator commission (${formatPercent(1 - PROTOCOL_TREASURY_SHARE, 0)} of the NEAR minted goes to stakers)`,
        show(staking?.grossYield, (v) => formatPercent(v, 1)),
        `${daysTo(30, t)}; stake of epoch ${show(staking?.epochHeight, String)}`,
      ],
      ["Staking yield after supply growth (minted less burned)", show(staking?.realYield, (v) => formatPercent(v, 2)), daysTo(30, t)],
      [`NEAR held by ${PROTOCOL_TREASURY_ACCOUNT}`, show(treasury?.balanceNear, near), treasury ? `end of ${treasury.asOf}` : DASH],
      [
        `Gain of ${PROTOCOL_TREASURY_ACCOUNT} against its ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} share of NEAR minted`,
        treasury ? `${near(treasury.gain30dNear)} against ${near(treasury.expected30dNear)}` : DASH,
        treasury ? daysTo(30, treasury.asOf) : DASH,
      ],
      ["FDV ÷ market cap", show(market?.fdvRatio, (v) => formatMultiple(v, 2)), reading(input.marketAsOf)],
      ["HSP-029 vote", show(hsp029, proposalStatusLabel), reading(hsp029?.fetchedAt)],
    ],
    [fullBurnNote(input)],
    `NEAR RPC \`EXPERIMENTAL_protocol_config\`, fields \`max_inflation_rate\` and \`transaction_costs.burnt_gas_reward\` (the gas rebate to contracts); NEAR RPC \`block\` with \`{"finality":"final"}\` (today's total supply) and \`status\` on mainnet and testnet (protocol versions); DefiLlama \`GET ${DEFILLAMA}/summary/fees/near-intents?dataType=dailyHoldersRevenue&excludeTotalDataChartBreakdown=true\` (buybacks, for NEAR bought) and \`GET ${DEFILLAMA}/summary/fees/near?excludeTotalDataChartBreakdown=true\` (gas fees, for the measured burn share); ${NEAR_DAILY_PRICE}, for NEAR bought and gas fees in NEAR; ${EPOCH_HEADERS} for NEAR minted and burned (see Formulas); \`query\` \`call_function\` \`get_proposal\` on \`${HOUSE_OF_STAKE_CONTRACT}\` with \`{"proposal_id":${HSP029.proposalId}}\`; NearBlocks \`GET ${NEARBLOCKS_V3}/block-stats?limit=${SOURCES.nearblocks.maxDailyRows}\` (daily total supply; \`GET ${NEARBLOCKS_V1}/charts\` for older days); NEAR RPC \`validators\` with \`[null]\` (staked share and gross yield); \`query\` \`view_account\` on \`${PROTOCOL_TREASURY_ACCOUNT}\` (today's balance) and NearBlocks \`GET ${NEARBLOCKS_V3}/accounts/${PROTOCOL_TREASURY_ACCOUNT}/stats/balance?limit=${SOURCES.nearblocks.maxDailyRows}\` (past days); CoinGecko \`GET ${COINGECKO_MARKETS}\` (FDV ÷ market cap).`,
  );
}
