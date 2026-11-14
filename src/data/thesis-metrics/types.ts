/** Shape of every number the thesis pages, the projections and the model read. */
import type { ProposalStatus } from "@/data/governance";
import type { ReferralTotals } from "@/data/intents-flows";
import type { LeadLagResult } from "@/lib/lead-lag";
import type { Absorption, BreakEven, DailyPoint, DataCheck, FeeChain, FlowYoY } from "@/lib/metrics";
import type { ProjectionSeed } from "@/lib/projection";

export type ThesisMetrics = {
  market: {
    priceUsd: number;
    marketCapUsd: number;
    rank: number;
    /** FDV ÷ market cap; null when CoinGecko gives no FDV. */
    fdvRatio: number | null;
  } | null;
  supply: {
    totalSupplyNear: number;
    maxInflationRate: number;
    growth1y: number | null;
    /** Last day of the total supply series, where growth1y's 12 months end. */
    growthThrough: string | null;
    /** Protocol share of gas fees burned today (1 − burnt_gas_reward); the measured share is seed.measuredBurnShare. */
    burnShareOfFees: number;
  } | null;
  staking: {
    stakedShare: number;
    /** NEAR minted over the last 30 days, a year's worth, less the treasury's share, ÷ NEAR staked; null until minted and
        burned NEAR cover those days. */
    grossYield: number | null;
    /** Gross yield after total supply growth over the same 30 days (minted less burned): (1 + gross) ÷ (1 + growth) − 1. */
    realYield: number | null;
    validators: number;
    nakamoto: number;
    chunkValidatorSeatNear: number;
    blockProducerSeatNear: number | null;
    producers: number;
    epochHeight: number;
  } | null;
  /** Last day the core flow series all have (Intents volume, buybacks, chain fees, NEAR price), or the latest day before a day
      missing from them or from minted and burned NEAR (FlowContext.through); flow windows end here, except the fee windows
      (feeChain.through) and Dune-only ones (intents.duneThrough). NearBlocks metrics carry their own `through`. */
  dataThrough: string | null;
  /** True while `dataThrough` is as recent as the sources allow; false once a core source stopped, so windows name their end day (`windowName`). */
  flowsCurrent: boolean;
  /** Newest live sample when these numbers were read: THESIS.md is dated by it, so its date always matches its numbers. */
  readAt: string | null;
  /** Live starting values for the projections and the coverage model. */
  seed: ProjectionSeed | null;
  /** Measured issuance from block headers: NEAR minted, annualized, as a share of total supply at the window's start. */
  issuance: {
    /** First day of the stored burn and issuance history; it reaches EPOCH_HISTORY_START once the epochs job has read back that far. */
    measuredFrom: string | null;
    minted30dNear: number | null;
    rate30d: number | null;
    minted1yNear: number | null;
    rate1y: number | null;
  } | null;
  /** NEAR burned and bought as shares of NEAR minted over the same window (denominator: measured minted NEAR). Each null until its window is covered. */
  absorption: {
    d30: Absorption | null;
    d90: Absorption | null;
    /** The 90 days before the last 90, compared with `d90` by the supply breaking point. */
    d90Prior: Absorption | null;
    /** From BUYBACKS_START_DAY through dataThrough. */
    sinceBuybacks: Absorption | null;
    d365: Absorption | null;
    /** Per calendar month (`days` = days with minted NEAR stored), oldest first; a month with nothing minted is left out. */
    monthly: Array<{ month: string } & Absorption>;
    /** Last day of `monthly`: dataThrough, or the last day minted and burned NEAR both have when earlier. */
    monthlyThrough: string;
  } | null;
  intents: {
    total30d: number;
    /** Last 90 days against the 90 before, with both 90-day totals; null until both windows are stored. */
    change90d: number | null;
    total90d: number | null;
    prior90d: number | null;
    /** Volume of the same 30 days a year earlier. */
    yearAgo30d: number;
    /** Last 30 days against the same 30 days a year earlier. */
    changeYoY30d: number | null;
    /** Volume over the last 365 days; null until every one of them is stored. */
    total1y: number | null;
    /** Last day of the Dune-only windows below: the newest day Dune's swaps and confidential volume both have, at most
        dataThrough, or earlier before a day missing from them or from Intents volume. */
    duneThrough: string | null;
    /** Swaps (public and confidential) over the 30 days to duneThrough and the same 30 days a year earlier; null without a full window. */
    swaps30d: number | null;
    swapsYearAgo30d: number | null;
    swapsChangeYoY30d: number | null;
    /** Volume ÷ swaps over the 30 days to duneThrough and over the same 30 days a year earlier. */
    avgSwapUsd30d: number | null;
    avgSwapUsdYearAgo30d: number | null;
    /** Confidential swaps' share of volume over the 30 days to duneThrough, and over the same 30 days 90 days earlier. */
    confidentialShare30d: number | null;
    confidentialShare30dPrior90d: number | null;
  } | null;
  /** Funds held in NEAR Intents (TVL) on the newest stored day, its confidential share, and its change over 30 days. */
  intentsTvl: { day: string; totalUsd: number; confidentialShare: number | null; change30d: number | null } | null;
  /** NEAR Intents buybacks: USD spent and NEAR bought, each day converted at that day's price. */
  buybacks: {
    total30dUsd: number;
    bought30dNear: number;
    /** NEAR bought, last 90 days against the 90 before, with both 90-day totals; null until both windows fall after buying began. */
    change90d: number | null;
    bought90dNear: number | null;
    boughtPrior90dNear: number | null;
    /** Compound monthly growth of NEAR bought implied by the 90-day change. */
    monthlyGrowth: number | null;
    /** 95% range of that growth from block bootstraps of each window's days (BOUGHT_GROWTH_RANGE), widened to include the growth itself; null with the growth. */
    monthlyGrowthRange: { low: number; high: number } | null;
    /** NEAR bought since buybacks began, and NEAR bought per calendar month (oldest first). */
    boughtNearTotal: number;
    monthlyNear: Array<{ month: string; value: number; days: number }>;
    /** Share of Intents volume that buys NEAR (buyback dollars ÷ volume), last 90 days and the 90 before. */
    takeRate90d: number | null;
    takeRatePrior90d: number | null;
  } | null;
  valuation: {
    marketCapUsd: number;
    /** NEAR burned plus bought over the last 30 days, annualized, at today's price. */
    tokenRevenueRunRateUsd: number;
    /** Market cap divided by the run rate. */
    multiple: number | null;
    /** Run rate as a share of market cap: what burn plus buybacks return to holders a year. */
    holderYield: number;
    /** Monthly growth NEAR bought needs, burn held at today's pace, for burn plus buybacks to match issuance in month COVERAGE_HORIZON_MONTHS;
        negative when they already do, −1 when burn alone does; null without a seed, or when no growth of NEAR bought covers issuance. */
    requiredMonthlyGrowth: number | null;
  } | null;
  /** NEAR Intents volume → gross fees → revenue → buybacks over 30 and 90 days, since buybacks began, and per calendar month (from the first month of fee data). */
  feeChain: {
    /** Last day of every fee window: dataThrough, or the last day of fees and revenue when earlier (YYYY-MM-DD). */
    through: string;
    d30: FeeChain | null;
    d90: FeeChain | null;
    /** Gross fees ÷ volume over the 30 and 90 days to `through`; each needs only fees and volume, not the rest of the chain. */
    feeRates: { d30: number | null; d90: number | null };
    /** From BUYBACKS_START_DAY through `through`. */
    sinceBuybacks: FeeChain | null;
    /** `days` counts the month's fee days; `buyingDays` the days since buying began; `revenueDays` the days with revenue above zero; `revenueNear` is the month's revenue with each day at that day's NEAR price. */
    monthly: Array<{ month: string; days: number; buyingDays: number; revenueDays: number; revenueNear: number } & FeeChain>;
  } | null;
  /** Completed 1Click swaps (Explorer API) over the 30 days to `through`, the newest stored day: their totals and each
      referral's, largest fees first; null until every one of the 30 days is stored. */
  referrals: { through: string; swaps: number; volumeUsd: number; feesUsd: number; byReferral: ReferralTotals[] } | null;
  /** NEAR Intents volume ÷ volume of every DEX on NEAR, both from DefiLlama (which counts Intents among them). */
  dexShare: {
    d30: number | null;
    d180: number | null;
    /** True while that window holds days of DEFILLAMA_PUBLIC_ONLY, when DefiLlama's Intents volume left out confidential swaps. */
    d30PublicOnly: boolean;
    d180PublicOnly: boolean;
    monthly: Array<{ month: string; days: number; share: number | null }>;
    /** Last day of `monthly`: dataThrough, or the last day both volume series have when earlier. */
    monthlyThrough: string;
  } | null;
  /** intents.near transactions ÷ all NEAR transactions (NearBlocks): per day, and over the last 30 days (ratio of sums). */
  intentsTxnShare: { through: string; avg30d: number | null; daily: DailyPoint[] } | null;
  /** Chains and token symbols with NEAR Intents volume (Dune) on the newest day its volume by chain and by token both have. */
  intentsReach: { day: string; chains: number; tokens: number } | null;
  /** Chain activity (NearBlocks), last 30 days against the same 30 days a year earlier. Active accounts compare 30-day medians. */
  activity: {
    through: string;
    txns: FlowYoY;
    newAccounts: FlowYoY;
    activeAccounts: { median30d: number | null; medianYearAgo30d: number | null; change: number | null };
  } | null;
  /** NEAR held by the three NEAR Intents revenue wallets on the latest day all three were read. */
  feeWallets: {
    asOf: string;
    buybackNear: number;
    frontendNear: number;
    oneClickNear: number;
    totalNear: number;
    /** Change of the three balances combined over the 30 days ending gainThrough; null until 30 days of history exist. */
    gain30dNear: number | null;
    /** Last finished day of the 30-day change: the data-through day, or the last balance day when that is earlier. */
    gainThrough: string | null;
    /** NEAR DefiLlama counts as bought over the same 30 days; null when gain30dNear is. */
    bought30dNear: number | null;
    /** Largest gap, on any day of the same 30 days, between the NEAR bought since the window began and the wallets' gain since then; null when gain30dNear is. */
    shortfall30dNear: number | null;
  } | null;
  /** Measured issuance against burn plus buybacks, over the last 30 and 90 days, at today's price. */
  breakEven: { d30: BreakEven | null; d90: BreakEven | null } | null;
  /** Independent measurements of the same quantity, side by side (difference = a ÷ b − 1). */
  dataChecks: {
    /** a: NearBlocks transaction fees (NEAR); b: DefiLlama chain fees converted to NEAR at each day's price. 30 days. */
    txnFees: DataCheck | null;
    /** a: NEAR burned (block headers); b: DefiLlama chain fees in NEAR. a ÷ b is the measured burn share. 30 days to dataThrough. */
    burnShare: DataCheck | null;
    /** a: total supply from the last epoch-boundary block header of the newest epoch end day up to the last NearBlocks day; b: NearBlocks total supply on that day. */
    totalSupply: DataCheck | null;
    /** a: NEAR bought as DefiLlama counts it; b: gain of the three revenue wallets on chain. Up to 30 days, shorter while wallet history is shorter. */
    boughtVsWallets: DataCheck | null;
    /** a: market cap ÷ annualized network revenue from this dashboard's data, on the published figure's dates; b: the published figure. */
    revenueMultiple: DataCheck | null;
    /** a: gain of treasury.near's balance over 30 days; b: the protocol treasury share of the NEAR minted in those days (block headers). */
    treasuryShare: DataCheck | null;
    /** a: app fees of completed 1Click swaps (Explorer API); b: NEAR Intents gross fees, protocol fee plus every front end's fee. 30 days to the last day both have. */
    referralFees: DataCheck | null;
  };
  /** The protocol treasury (treasury.near): its daily balance, and over the 30 days to the data-through day (earlier if its
      balance or minted NEAR ends first), its gain against PROTOCOL_TREASURY_SHARE of the NEAR minted. Null until both cover 30 days. */
  treasury: { daily: DailyPoint[]; asOf: string; balanceNear: number; gain30dNear: number; expected30dNear: number; first: DailyPoint } | null;
  /** Market cap ÷ network revenue (NEAR Intents revenue plus gas fees) of the last 30 days, annualized, for every day the
      revenue window is stored from the first month with revenue every day; with the latest value and the median, low and high,
      and the market cap the latest yearly revenue would carry at each of those three (against its own history, not a fair value). */
  revenueMultiple: {
    daily: DailyPoint[];
    latest: DailyPoint;
    median: number;
    low: number;
    high: number;
    impliedMarketCapUsd: { low: number; median: number; high: number };
  } | null;
  /** Live House of Stake vote on HSP-029. */
  hsp029: ProposalStatus | null;
  /** Does weekly Intents volume growth lead NEAR's price or usage? Weeks end on dataThrough; null until enough weeks are stored. */
  leadLag: LeadLagResult | null;
  /** Protocol version on mainnet and testnet, and when the older of the two readings was taken (ISO 8601). */
  protocol: { mainnet: number; testnet: number; fetchedAt: string } | null;
  /** Cost of a simple transfer in NEAR and in USD at the gas price of the newest block reading, and when that reading was taken (ISO 8601). */
  technology: { transferCostNear: number; transferCostUsd: number; gasPriceReadAt: string } | null;
  /** Circulating-supply growth over 12 months: NEAR and the median of the coins ranked above it that have a year of history, dollar-pegged coins left out. */
  peers: {
    /** Last day of NEAR's stored supply history, where the 12-month growth ends. */
    through: string | null;
    nearGrowth1y: number | null;
    medianGrowth1y: number | null;
    /** Larger coins with a year of supply history that are not dollar-pegged. */
    count: number;
    /** Of those, coins whose circulating supply grew faster than NEAR's; null without NEAR's growth. */
    fasterCount: number | null;
    /** Larger coins, not dollar-pegged, whose FDV exceeds market cap by more than LOCKED_SUPPLY_MARGIN (supply locked, unvested or not yet mined), of `peerTotal`. */
    lockedCount: number;
    /** Larger coins that are not dollar-pegged. */
    peerTotal: number;
    /** NEAR's FDV ÷ market cap (null when CoinGecko gives no FDV), and whether it exceeds 1 by more than LOCKED_SUPPLY_MARGIN. */
    nearFdvRatio: number | null;
    nearLocked: boolean;
  } | null;
};
