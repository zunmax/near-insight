import { MethodNotes, type MethodNote } from "@/components/methodology/MethodNotes";
import { Panel } from "@/components/ui/Panel";
import { EPOCH_HISTORY_START, INGEST_SCHEDULE_MS, MAX_PULL_BACK_DAYS } from "@/config/ingest";
import { DEFILLAMA_PUBLIC_ONLY } from "@/config/intents";
import type { NavIconName } from "@/config/navigation";
import { PEER_SUPPLY_GROWTH } from "@/config/peers";
import { COVERAGE_HORIZON_MONTHS, RECENT_PACE_MONTHS, REQUIREMENT_HORIZON_MONTHS, REQUIREMENT_PRICE_MULTIPLES } from "@/config/projections";
import { BUYBACKS_START_DAY, FULL_BURN_PROTOCOL, HSP029, PROTOCOL_TREASURY_SHARE } from "@/config/protocol";
import { BUYBACK_ACCOUNT, FRONTEND_FEE_ACCOUNT, HOUSE_OF_STAKE_CONTRACT, INTENTS_CONTRACT, ONE_CLICK_FEE_ACCOUNT, SOURCES } from "@/config/sources";
import { BOUGHT_GROWTH_RANGE, TRIGGERS } from "@/config/thesis-triggers";
import { SECTIONS } from "@/content/thesis";
import { formatCount, formatInteger, formatPercent } from "@/lib/format";

type NoteGroup = { topic: string; section: NavIconName; notes: Array<{ title: string; text: string; sources: string[] }> };

/** The definitions by topic, each topic marked with the color of the section it feeds. `sources` are the data services a
    note's text names as its inputs; a note built only from other figures names none. */
const NOTE_GROUPS: NoteGroup[] = [
  {
    topic: "Supply",
    section: "supply",
    notes: [
      {
        title: "Max issuance",
        text: `The NEAR RPC field \`max_inflation_rate\`: the most the protocol can mint in a year, as a share of total supply; the projections mint total supply × this rate ÷ 12 each month. ${formatPercent(1 - PROTOCOL_TREASURY_SHARE, 0)} goes to stakers; nearcore hard-codes the ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} treasury share, while the NEAR RPC field \`protocol_reward_rate\` reads [0, 1], a fraction equal to 0, so it is not used.`,
        sources: ["NEAR RPC"],
      },
      {
        title: "Issuance",
        text: "NEAR minted at the start of an epoch = S(first) − S(last block of the previous epoch) + B(first); it is the reward for the epoch before, and is spread over the days of the epoch it is minted in, the same way as the burn. The measured rate is NEAR minted over 30 or 365 days, annualized, ÷ total supply at the start of the window.",
        sources: [],
      },
      {
        title: "Burn",
        text: `Measured from block headers, read from a NEAR archival RPC node (FastNEAR's by default). NEAR burned in an epoch = S(first) − S(last) + B(first), where S is a block's \`total_supply\` and B is the sum of \`balance_burnt\` over the chunks that block produced (\`height_included\` equal to its height). Each epoch is spread over the UTC days it covers in proportion to time, and only fully covered days are kept. The worker reads epochs back to ${EPOCH_HISTORY_START}, newest first, as many as each run's time limit allows; a new database starts from the committed snapshot's epochs, since block headers never change. A window that reaches back before the oldest epoch stored shows —.`,
        sources: ["NEAR archival RPC"],
      },
      {
        title: "Burn share",
        text: `NEAR burned ÷ gas fees in NEAR over the same 30 days; gas fees are DefiLlama's, converted at each day's price. The projections multiply gas fees by this share, or by 100% once the protocol pays no gas to contracts (\`burnt_gas_reward\` 0). Before protocol ${FULL_BURN_PROTOCOL}, a rebate paid part of contract-call gas to the called contract; transfers and fixed costs burned all of their gas.`,
        sources: ["DefiLlama"],
      },
      {
        title: "Absorption",
        text: `(NEAR burned + NEAR bought) ÷ NEAR minted, all measured, over 30 days, 90 days, since ${BUYBACKS_START_DAY} and 365 days, and by calendar month. A 30-day, 90-day, since-${BUYBACKS_START_DAY} or 365-day window is shown only when NEAR minted, burned and bought each have a value on every day of it; a month the data covers only partly is marked as partial. The supply breaking point compares the last 90 days with the 90 days before, once NEAR minted, burned and bought cover all 180 days.`,
        sources: [],
      },
      {
        title: "Supply growth",
        text: `Change in on-chain total supply over 365 days, from NearBlocks' daily history to today's NEAR RPC reading. Peers: change in CoinGecko circulating supply (market cap ÷ price), the median of the newest ${PEER_SUPPLY_GROWTH.endDays} days against the median of the ${PEER_SUPPLY_GROWTH.endDays} days a year earlier, scaled to a year.`,
        sources: ["NearBlocks", "NEAR RPC", "CoinGecko"],
      },
    ],
  },
  {
    topic: "Revenue",
    section: "revenue",
    notes: [
      {
        title: "NEAR bought",
        text: `DefiLlama's daily holders revenue of NEAR Intents (buyback dollars), converted to NEAR at each day's price. Buybacks started on ${BUYBACKS_START_DAY}. DefiLlama counts NEAR arriving at all three fee wallets, so "NEAR bought" is spread across them and can exceed the balance of ${BUYBACK_ACCOUNT} alone. Bought NEAR is held in the three fee wallets, off the market; it is not burned, so it stays in total supply (CoinGecko's circulating supply still counts it).`,
        sources: ["DefiLlama"],
      },
      {
        title: "Fee chain",
        text: `Four steps, over 30 and 90 days, since ${BUYBACKS_START_DAY} and by month: NEAR Intents volume, the gross fees charged on it, the revenue kept from those fees (DefiLlama \`dailyRevenue\`), and the buyback dollars paid from that revenue (\`dailyHoldersRevenue\`). Fee rate = gross fees ÷ volume; fees per $1M swapped = fee rate × 1,000,000. Share of fees that buys NEAR = buyback dollars ÷ gross fees; fees count from ${BUYBACKS_START_DAY}, so the month buying began is not diluted.`,
        sources: ["DefiLlama"],
      },
      {
        title: "Share of volume that buys NEAR",
        text: "Buyback dollars ÷ volume, summed over the same days, in basis points (1 bp = 0.01%): over the last 90 days against the 90 days before, and in each fee chain window and month; the projections use the last 30 days, and break-even uses each of its own windows.",
        sources: [],
      },
      {
        title: "Fee wallets",
        text: `Balances (\`amount\` + \`locked\`) of ${BUYBACK_ACCOUNT}, ${FRONTEND_FEE_ACCOUNT} and ${ONE_CLICK_FEE_ACCOUNT}, read with the NEAR RPC \`view_account\` query; today keeps its last reading. Each finished day since ${BUYBACKS_START_DAY} is NearBlocks' end-of-day balance, which it records only on days the balance changed; a day without a record keeps the last one. The 30-day gain is the change of the three balances combined, set against the NEAR bought over the same days. Largest daily gap = for each of the 30 days, the NEAR bought since the window began − the three wallets' gain since then, the largest of those values (not below 0); the breaking point of "${SECTIONS.capture.title}" is reached when it exceeds ${formatPercent(TRIGGERS.walletShortfallShare, 0)} of the 30 days' NEAR bought.`,
        sources: ["NEAR RPC", "NearBlocks"],
      },
      {
        title: "Break-even",
        text: "Over 30 and 90 days. Multiple = NEAR minted ÷ (NEAR burned + NEAR bought): how many times burn plus buybacks must grow. Volume needed a day = (NEAR minted − NEAR burned, not below 0) × today's price ÷ the window's share of volume that buys NEAR ÷ its days, compared with the Intents volume a day over the same window.",
        sources: [],
      },
    ],
  },
  {
    topic: "Usage",
    section: "usage",
    notes: [
      {
        title: "NEAR Intents data",
        text: `Volume (public and confidential), swaps, gross fees, fees by channel (the 100 largest channels above $10, leaving out swaps without a referral, so not total fees), volume by chain and by token, and TVL come from the NEAR team's Dune dashboard (${SOURCES.dune.dashboard.handle}/${SOURCES.dune.dashboard.slug}). The worker reads it every ${formatCount(INGEST_SCHEDULE_MS.dune / 3_600_000, "hour")}; Dune refreshes it about once a day. Volume and fees use Dune's value on each day it has one and DefiLlama's otherwise. From ${DEFILLAMA_PUBLIC_ONLY.label}, DefiLlama counted only public swaps, leaving out confidential ones. Confidential swaps run inside a private NEAR shard; Dune counts both kinds.`,
        sources: ["Dune", "DefiLlama"],
      },
      {
        title: "Share of DEX volume",
        text: "DefiLlama's NEAR Intents volume ÷ the volume of every DEX that DefiLlama tracks on NEAR, which includes NEAR Intents, over 30 and 180 days and by month; both from DefiLlama, so they count the same swaps.",
        sources: ["DefiLlama"],
      },
      {
        title: "Share of transactions",
        text: `Daily transactions of the ${INTENTS_CONTRACT} contract (NearBlocks API v3) ÷ all NEAR transactions that day. The 30-day share divides the two 30-day sums, ending on the last day both series have.`,
        sources: ["NearBlocks"],
      },
      {
        title: "Chain activity",
        text: "Transactions and new accounts: the total of the last 30 days against the same 30 days a year earlier. Active accounts: the median daily count of the last 30 days against the median of the same 30 days a year earlier.",
        sources: [],
      },
    ],
  },
  {
    topic: "Valuation",
    section: "valuation",
    notes: [
      {
        title: "Valuation",
        text: `Market cap divided by the run rate of burn plus buybacks: NEAR burned plus NEAR bought (at the prices paid) over the last 30 days, × 365 ÷ 30, valued at today's price; the yield is the run rate ÷ market cap. The growth needed is the monthly growth of NEAR bought at which burn plus buybacks match that month's issuance in month ${COVERAGE_HORIZON_MONTHS}. It starts from the last 30 days' buyback dollars converted at today's price, holds the burn at the same 30 days' gas fees in NEAR (each day at its own price) × the share burned, and keeps today's price and max issuance rate, while supply changes by issuance minus burn. It is zero or negative when burn plus buybacks at their current rate already match issuance in month ${COVERAGE_HORIZON_MONTHS} (how far NEAR bought could fall a month and still match it), and None when the burn alone does. It compares directly with the measured growth of NEAR bought and its ${formatPercent(BOUGHT_GROWTH_RANGE.level, 0)} range: the middle ${formatPercent(BOUGHT_GROWTH_RANGE.level, 0)} of the growth over ${formatInteger(BOUGHT_GROWTH_RANGE.draws)} draws that rebuild each 90-day window from blocks of its own days (${BOUGHT_GROWTH_RANGE.meanBlock} days long on average, seed ${BOUGHT_GROWTH_RANGE.seed}). The valuation breaking point holds while the whole range is at or above the growth needed, breaks while all of it is below, and is too close to call in between. The Valuation page also shows it at ${REQUIREMENT_HORIZON_MONTHS.join(", ")} months and at ${REQUIREMENT_PRICE_MULTIPLES.map((m) => `${m}×`).join(", ")} today's price; at a higher price the same buyback dollars buy less NEAR. Market cap ÷ network revenue = each day's market cap ÷ (Intents revenue + gas fees over the 30 days to that day × 365 ÷ 30), from the first month with Intents revenue on every day, shown against its median. Market cap at the lowest, median and highest of those multiples = each multiple × the yearly revenue behind the latest one; it places today's market cap against its own history and is not a fair value. The model on the Valuation page lets you grow fees and buybacks separately.`,
        sources: [],
      },
      {
        title: "Projections",
        text: `Month by month from the last 30 days, holding today's price: buyback dollars converted at today's price, and gas fees converted to NEAR at each day's price × the share burned (all of it once mainnet pays no gas to contracts; the measured burn share before that). Scenarios: no growth, the growth needed for burn plus buybacks to match issuance in month ${COVERAGE_HORIZON_MONTHS}, and the growth of NEAR bought in the last 90 days against the 90 days before, as a monthly rate, for ${RECENT_PACE_MONTHS} months, then flat. Supply outlook: today's max issuance against HSP-029's ${formatPercent(HSP029.targetRate, 1)} (${HSP029.rampMonths}-month ramp starting ${HSP029.graceDays} days after the vote's timelock ends, or after the data-through day while that end is unknown or the vote has failed; once started, from today's rate over the months left), minus the burn. Usage and Revenue models: NEAR bought = Intents volume × fees ÷ volume × buyback dollars ÷ fees ÷ price, starting from the same 30 days, so at their starting values they buy what the scenarios start from; volume growth carries NEAR bought with it.`,
        sources: [],
      },
      {
        title: "HSP-029 status",
        text: `The \`get_proposal\` view of ${HOUSE_OF_STAKE_CONTRACT} with {"proposal_id":${HSP029.proposalId}}: status, veNEAR for, against and abstaining, voters and deadlines. Share for = veNEAR for ÷ all veNEAR voted, abstentions included.`,
        sources: ["House of Stake"],
      },
    ],
  },
  {
    topic: "Network & data",
    section: "network",
    notes: [
      {
        title: "Validator seats",
        text: "Chunk-validator seat = total stake × `minimum_stake_ratio`. Block-producer seat = the smallest stake among validators expected to produce blocks.",
        sources: [],
      },
      {
        title: "Live rates",
        text: "Transactions a minute = the newest finished day's NearBlocks transaction count ÷ 1,440. NearBlocks' lifetime counter moves only once a day, so it gives no rate within a day.",
        sources: ["NearBlocks"],
      },
      {
        title: "Developers",
        text: "Monthly active developers (28-day window) from eco_mads.parquet; only first-of-month values are stored, and the chart indexes them to 100. Open Dev Data by Electric Capital (Electric Capital Partners, LLC), CC BY 4.0, indexed and sampled monthly by this dashboard.",
        sources: ["Electric Capital"],
      },
      {
        title: "Data windows",
        text: `Every flow window ends on one shared day: the last day that Intents volume, Intents buyback dollars, gas fees and the NEAR price all have, or, when one of them or NEAR minted or burned misses a day in the 30 days before it, the latest earlier day (at most ${MAX_PULL_BACK_DAYS} days back) whose 30 days are all stored, so a missing day dates the figures earlier instead of emptying them. A figure built on other series (DEX volume) ends on the same day and is left out while its series do not reach it; monthly tables stop at the last day their series all have. Windows on Intents fees and revenue (fee chain, fee rate, share of fees that buys NEAR) end on the last day both have, often a day before the shared day, because the newest day of fees is still filling, and earlier by the same missing-day rule applied to fees, revenue and Intents volume. Chain activity and the Intents share of transactions end on the last day their NearBlocks series have. Fee wallet and treasury gains end on the shared day, or earlier where their data ends first or misses a day, and total supply growth ends on today's reading. Swaps, average swap size and the confidential share come from Dune alone, so they end on the last day Dune's swaps and confidential volume both have, at most the shared day, and earlier by the same missing-day rule. TVL, fees by channel and volume by chain and token end on Dune's newest stored day.`,
        sources: [],
      },
      {
        title: "Data checks",
        text: "Each row sets two independent figures side by side: two measurements of one quantity, a measurement against what it should equal, or this dashboard's figure against a published one. Difference = A ÷ B − 1.",
        sources: [],
      },
      {
        title: "Static facts",
        text: "NEAR's finality, technology milestones, NEAR Intents fee rates, NEAR account features, the gas of a simple transfer, the shard cap and the Home sector chips are fixed values with no free API. Finality and the technology milestones show their source and the date checked; THESIS.md lists the sources of the fee rates and account features.",
        sources: [],
      },
    ],
  },
];

const NOTES: MethodNote[] = NOTE_GROUPS.flatMap(({ topic, section, notes }) => notes.map((note) => ({ ...note, topic, section })));

export function MethodNotesPanel() {
  return (
    <Panel title="How each number is calculated" description="The definitions behind every figure on this dashboard, grouped by the page they feed." textBody>
      <MethodNotes notes={NOTES} />
    </Panel>
  );
}
