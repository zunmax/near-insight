import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import { MAX_ISSUANCE_HALVED_DAY, PREVIOUS_MAX_INFLATION } from "@/config/protocol";
import type { SourceRef } from "@/config/sources";
import { FINDING_LEVELS } from "@/config/thesis-triggers";
import { FINALITY_SECONDS } from "@/content/facts";
import type { SectionId } from "@/content/thesis";
import type { ThesisMetrics } from "@/data/thesis-metrics";
import {
  digitsApart,
  formatBps,
  formatChange,
  formatChangeFromZero,
  formatCount,
  formatGrowthRange,
  formatMonths,
  formatMultiple,
  formatNear,
  formatPercent,
  formatPercentFromFull,
  formatUsd,
  usdDigitsApart,
} from "@/lib/format";
import { isoDay, ratio } from "@/lib/metrics";
import { measuredBurnNote } from "@/lib/projection";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { proposalStatusLabel, votingClosed } from "@/lib/thesis/proposal-status";
import { growthNeededValue, peerDigits, transferCost, valuationDigits } from "@/lib/thesis/triggers";
import { windowName } from "@/lib/thesis/window-name";

/** A live number; `supports` is set where its value decides whether it backs the claim, so the tile moves to that side. */
export type SectionStat = { label: string; value: string; supports?: boolean };

/** Label of the tile with NEAR bought's monthly growth, naming its 95% range printed at `digits`. */
const growthLabel = (m: ThesisMetrics, digits: number) =>
  `Monthly growth rate of NEAR bought (${windowName(m, "90 days")} vs the 90 days before${m.buybacks?.monthlyGrowthRange ? `; 95% range ${formatGrowthRange(m.buybacks.monthlyGrowthRange, digits)}` : ""})`;

type SectionStats = {
  /** Where the section's numbers come from, listed in the "i" note. */
  sources: SourceRef[];
  /** True when the numbers use flow windows that end on the shared data-through day. */
  flows: boolean;
  /** Numbers of the section that end on their own day, named in the note's date line: e.g. NearBlocks or CoinGecko supply. */
  ownThrough?: (m: ThesisMetrics) => { label: string; day: string | null };
  /** Key numbers, most important first; null when the database has not filled them yet. */
  stats: (m: ThesisMetrics) => SectionStat[] | null;
  /** Numbers that can cut against the claim; one whose value backs it (`supports: true`) is shown with the evidence for. Null until the database has filled them. */
  against: (m: ThesisMetrics) => SectionStat[] | null;
};

const utcDay = (iso: string) => isoDay(Date.parse(iso) / 1000);

/** A year-on-year change that backs the claim when it is a rise. */
const change = (value: number | null): Pick<SectionStat, "value" | "supports"> =>
  value === null ? { value: "—" } : { value: formatChangeFromZero(value), supports: value > 0 };

/** The live state of the HSP-029 vote, with the day its voting or veto window closes while one is open. */
function hsp029Stat(p: ThesisMetrics["hsp029"]): SectionStat {
  if (!p) return { label: "HSP-029 vote", value: "—" };
  const value = proposalStatusLabel(p);
  if (p.status === "Voting" && p.votingEndsAt) return { label: `HSP-029 vote, ${votingClosed(p) ? "closed" : "closes"} ${utcDay(p.votingEndsAt)}`, value };
  if (p.status === "Timelock" && p.timelockEndsAt) return { label: `HSP-029 vote, council can veto until ${utcDay(p.timelockEndsAt)}`, value };
  return { label: "HSP-029 vote", value };
}

/** The live numbers for and against each section's claim. */
export const SECTION_STATS: Record<SectionId, SectionStats> = {
  demand: {
    sources: ["dune", "defillama", "nearblocks"],
    flows: true,
    ownThrough: (m) => ({ label: "NearBlocks", day: m.activity?.through ?? null }),
    stats: (m) =>
      m.intents && [
        { label: `Intents volume, ${windowName(m, "30 days")}`, value: formatUsd(m.intents.total30d) },
        { label: `Change in Intents volume, ${windowName(m, "30 days")} vs the same 30 days a year earlier`, value: m.intents.changeYoY30d === null ? "—" : formatChangeFromZero(m.intents.changeYoY30d) },
        { label: `Intents volume, ${windowName(m, "12 months")}`, value: m.intents.total1y === null ? "—" : formatUsd(m.intents.total1y) },
        { label: `Change in Intents volume, ${windowName(m, "90 days")} vs the 90 days before`, value: m.intents.change90d === null ? "—" : formatChangeFromZero(m.intents.change90d) },
      ],
    against: (m) =>
      m.activity && [
        { label: `Change in NEAR transactions, ${windowName(m, "30 days", m.activity.through)} vs the same 30 days a year earlier`, ...change(m.activity.txns.change) },
        { label: `Change in new NEAR accounts, ${windowName(m, "30 days", m.activity.through)} vs the same 30 days a year earlier`, ...change(m.activity.newAccounts.change) },
        { label: `Change in median daily active accounts, ${windowName(m, "30 days", m.activity.through)} vs the same 30 days a year earlier`, ...change(m.activity.activeAccounts.change) },
      ],
  },
  capture: {
    sources: ["dune", "defillama", "coingecko", "nearRpc", "nearblocks", "nearArchive"],
    flows: true,
    stats: (m) =>
      m.buybacks && [
        { label: `NEAR bought, ${windowName(m, "30 days")}`, value: formatNear(m.buybacks.bought30dNear) },
        { label: growthLabel(m, 1), value: m.buybacks.monthlyGrowth === null ? "—" : formatChange(m.buybacks.monthlyGrowth) },
        { label: `Share of volume that buys NEAR, ${windowName(m, "90 days")}, in basis points (1 bp = 0.01%)`, value: m.buybacks.takeRate90d === null ? "—" : formatBps(m.buybacks.takeRate90d) },
        {
          /** While mainnet burns every fee but the window still holds days from before, the label says why the share is below that. */
          label: `Share of gas fees burned, ${windowName(m, "30 days")}${measuredBurnNote(m.seed)}`,
          value: m.seed ? formatPercentFromFull(m.seed.measuredBurnShare, 0) : "—",
        },
      ],
    against: (m) =>
      (m.feeChain || m.feeWallets) && [
        m.feeChain?.d30?.captureRate == null
          ? { label: `Share of Intents fees that buys NEAR, ${windowName(m, "30 days", m.feeChain?.through ?? null)}`, value: "—" }
          : {
              label: `Share of Intents fees that buys NEAR, ${windowName(m, "30 days", m.feeChain.through)}`,
              value: formatPercent(m.feeChain.d30.captureRate, digitsApart(m.feeChain.d30.captureRate * 100, FINDING_LEVELS.captureRateMajority * 100, 1)),
              supports: m.feeChain.d30.captureRate >= FINDING_LEVELS.captureRateMajority,
            },
        { label: "NEAR held in the three fee wallets, still in total supply", value: m.feeWallets ? formatNear(m.feeWallets.totalNear) : "—" },
      ],
  },
  supply: {
    sources: ["nearRpc", "nearArchive", "nearblocks", "defillama", "coingecko"],
    flows: true,
    stats: (m) => {
      const { supply: s, staking, hsp029 } = m;
      return s || staking
        ? [
            { label: `Max issuance (${formatPercent(PREVIOUS_MAX_INFLATION, 0)} before ${MAX_ISSUANCE_HALVED_DAY})`, value: s ? `${formatMaxIssuance(s.maxInflationRate)} a year` : "—" },
            hsp029Stat(hsp029),
            {
              label: `Share of total supply staked${staking?.grossYield == null ? "" : ` (staking yield before supply growth: ${formatPercent(staking.grossYield, 1)} a year, ${windowName(m, "30 days")})`}`,
              value: staking ? formatPercent(staking.stakedShare, 1) : "—",
            },
            { label: `Staking yield after supply growth (minted less burned), ${windowName(m, "30 days")}`, value: staking?.realYield == null ? "—" : formatPercent(staking.realYield, 2) },
          ]
        : null;
    },
    against: (m) => {
      const { supply: s, issuance: i, absorption: a, treasury: t } = m;
      const treasuryGrowth = t ? ratio(t.balanceNear, t.first.value) : null;
      return s && [
        { label: `Measured issuance, ${windowName(m, "30 days")}, yearly rate`, value: i?.rate30d == null ? "—" : formatPercent(i.rate30d) },
        s.growth1y === null
          ? { label: "Total supply growth, 12 months", value: "—" }
          : { label: `Total supply growth, ${windowName(m, "12 months", s.growthThrough)}`, value: formatChange(s.growth1y, digitsApart(s.growth1y * 100, 0, 2)), supports: s.growth1y <= 0 },
        a?.d30
          ? {
              label: `Share of NEAR minted that was burned + bought, ${windowName(m, "30 days")}`,
              value: formatPercentFromFull(a.d30.share, 1),
              supports: a.d30.share >= 1,
            }
          : { label: `Share of NEAR minted that was burned + bought, ${windowName(m, "30 days")}`, value: "—" },
        t && treasuryGrowth !== null
          ? { label: `Protocol treasury NEAR, change since ${isoDay(t.first.time)}`, value: formatChangeFromZero(treasuryGrowth - 1), supports: t.balanceNear >= t.first.value }
          : { label: "Protocol treasury NEAR, change", value: "—" },
      ];
    },
  },
  valuation: {
    sources: ["coingecko", "dune", "defillama", "nearRpc", "nearArchive"],
    flows: true,
    stats: (m) => {
      const { valuation: v, buybacks: b, revenueMultiple: r } = m;
      /** The rates and the range print with enough decimals to differ whenever they do, as the breaking point compares them unrounded. */
      const growth = b?.monthlyGrowth ?? null;
      const needed = v?.requiredMonthlyGrowth ?? null;
      const digits = valuationDigits(m);
      const since = r ? isoDay(r.daily[0]!.time) : "—";
      const latestDay = r ? isoDay(r.latest.time) : null;
      /** The latest multiple is named by its day when a gap or a stopped source leaves it behind the current data-through day. */
      const onDay = latestDay !== null && (latestDay !== m.dataThrough || !m.flowsCurrent) ? latestDay : null;
      return v || b || r ? [
        { label: growthLabel(m, digits), value: growth === null ? "—" : formatChange(growth, digits) },
        {
          label: `Monthly growth rate of NEAR bought needed for burn + buybacks to match monthly issuance by the end of ${formatMonths(COVERAGE_HORIZON_MONTHS)}`,
          value: needed === null ? "—" : growthNeededValue(needed, digits),
        },
        {
          label: `Market cap ÷ yearly network revenue${onDay ? ` on ${onDay}` : ""}${r ? ` (median since ${since}: ${formatMultiple(r.median)})` : ""}`,
          value: r ? formatMultiple(r.latest.value) : "—",
        },
        {
          label: `Market cap if the multiple returned to its median${r ? ` since ${since}` : ""}, on the latest yearly revenue${onDay ? `, 30 days to ${onDay}` : ""}${r ? ` (lowest to highest multiple: ${formatUsd(r.impliedMarketCapUsd.low)} to ${formatUsd(r.impliedMarketCapUsd.high)})` : ""}; compared with NEAR's own history, not a fair value`,
          value: r ? formatUsd(r.impliedMarketCapUsd.median) : "—",
        },
      ] : null;
    },
    against: (m) => {
      const { valuation: v, supply: s, breakEven: e } = m;
      /** The volume needed and today's volume print with the decimals that tell them apart, as the side is decided unrounded. */
      const usdDigits = e?.d30?.volumePerDayUsd == null ? 2 : usdDigitsApart(e.d30.volumePerDayUsd, e.d30.currentVolumePerDayUsd);
      return v || e ? [
        { label: "Market cap ÷ (burn + buybacks a year)", value: v?.multiple == null ? "—" : formatMultiple(v.multiple) },
        {
          label: `Burn + buybacks a year ÷ market cap${s ? ` (against max issuance of ${formatMaxIssuance(s.maxInflationRate)} a year)` : ""}`,
          value: v ? formatPercent(v.holderYield, 2) : "—",
        },
        {
          label: `Intents volume a day at which burn + buybacks would match the NEAR minted (average over the ${windowName(m, "30 days")}: ${e?.d30 ? formatUsd(e.d30.currentVolumePerDayUsd, usdDigits) : "—"})`,
          ...(e?.d30?.volumePerDayUsd == null
            ? { value: "—" }
            : { value: formatUsd(e.d30.volumePerDayUsd, usdDigits), supports: e.d30.volumePerDayUsd <= e.d30.currentVolumePerDayUsd }),
        },
      ] : null;
    },
  },
  technology: {
    sources: ["nearRpc", "nearArchive", "coingecko", { cite: FINALITY_SECONDS.source }],
    flows: true,
    stats: ({ technology: t }) =>
      t && [
        { label: "Time to finality", value: `${FINALITY_SECONDS.value} s` },
        { label: "Cost of a simple NEAR transfer", value: transferCost(t.transferCostUsd) },
      ],
    against: (m) =>
      m.absorption?.d30
        ? [
            { label: `NEAR burned by gas fees, ${windowName(m, "30 days")}`, value: formatNear(m.absorption.d30.burntNear) },
            {
              label: `Share of NEAR minted that was burned, ${windowName(m, "30 days")}`,
              value: formatPercentFromFull(m.absorption.d30.burntShare, 1),
              supports: m.absorption.d30.burntShare >= 1,
            },
          ]
        : null,
  },
  network: {
    sources: ["nearRpc"],
    flows: false,
    stats: ({ staking }) =>
      staking && [
        { label: "Active validators", value: String(staking.validators) },
        { label: "Chunk-validator seat", value: formatNear(staking.chunkValidatorSeatNear) },
      ],
    against: ({ staking }) =>
      staking && [
        { label: "Validators (staking pools) needed to hold more than a third of stake", value: String(staking.nakamoto) },
        {
          label: `Block-producer seat, smallest stake of the ${formatCount(staking.producers, "block producer")}`,
          value: staking.blockProducerSeatNear === null ? "—" : formatNear(staking.blockProducerSeatNear),
        },
      ],
  },
  peers: {
    sources: ["coingecko", "nearRpc", "nearArchive", "nearblocks"],
    /** The NEAR minted against it is a flow window ending on the data-through day; the supply growth ends on its own day. */
    flows: true,
    ownThrough: (m) => ({ label: "CoinGecko supply", day: m.peers?.through ?? null }),
    /** No market data yet: the page shows its empty state like the others. Market data without a year of supply history:
        the claim shows without numbers. */
    stats: ({ peers: p }) =>
      p === null
        ? null
        : p.count > 0
        ? [
            { label: "NEAR circulating supply growth, 12 months", value: p.nearGrowth1y === null ? "—" : formatChange(p.nearGrowth1y, peerDigits(p)) },
            { label: `Median circulating supply growth, 12 months, of ${formatCount(p.count, "larger coin")} (not dollar-pegged)`, value: p.medianGrowth1y === null ? "—" : formatChange(p.medianGrowth1y, peerDigits(p)) },
            { label: "NEAR FDV ÷ market cap", value: p.nearFdvRatio === null ? "—" : formatMultiple(p.nearFdvRatio, 2) },
            { label: "Larger coins with FDV above market cap, not dollar-pegged", value: `${p.lockedCount} of ${p.peerTotal}` },
          ]
        : [],
    against: (m) => (m.issuance?.rate1y == null ? null : [{ label: `NEAR minted, ${windowName(m, "12 months")}, share of supply`, value: formatPercent(m.issuance.rate1y) }]),
  },
};

/** A section's "i" note: its sources, and where flows are involved the shared data-through day, with the section's own source
    day (`ownThrough`) where it differs. */
export function sectionSources(id: SectionId, m: ThesisMetrics): { sources: SourceRef[]; through?: string } {
  const live = SECTION_STATS[id];
  const own = live.ownThrough?.(m);
  const ownNote = own?.day && own.day !== m.dataThrough ? `; ${own.label} through ${own.day}` : "";
  return { sources: live.sources, through: live.flows && m.dataThrough ? `Data through ${m.dataThrough}${ownNote}` : undefined };
}
