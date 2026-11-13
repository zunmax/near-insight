/** The investment thesis as structured content; THESIS.md is generated from it (`npm run thesis`). Text here holds no live
    numbers; components fill those in from the database. Dates, rates and terms come from config. */
import { COVERAGE_HORIZON_MONTHS } from "@/config/projections";
import {
  BUYBACKS_START_DAY,
  FULL_BURN_PROTOCOL,
  HSP029,
  MAX_ISSUANCE_HALVED_DAY,
  PREVIOUS_MAX_INFLATION,
  PROTOCOL_TREASURY_SHARE,
  VESTING_END_DAY,
} from "@/config/protocol";
import { formatMonths, formatMonthYear, formatPercent, upperFirst } from "@/lib/format";

/** HSP-029's terms, stated as a proposal: its live vote status is shown with the supply data. */
const HSP029_TERMS = `HSP-029, a House of Stake proposal, would ramp max issuance down to ${formatPercent(HSP029.targetRate, 1)} over ${formatMonths(HSP029.rampMonths)}, starting ${HSP029.graceDays} days after its vote's timelock ends; it changes issuance only once it is approved and validators adopt it in a protocol upgrade`;

/** The halving of max issuance, a dated protocol change. */
const ISSUANCE_HALVED = `max issuance was halved from ${formatPercent(PREVIOUS_MAX_INFLATION, 0)} to ${formatPercent(PREVIOUS_MAX_INFLATION / 2, 1)} a year in ${formatMonthYear(MAX_ISSUANCE_HALVED_DAY)}`;

export const THESIS_STATEMENT =
  "NEAR Intents turns cross-chain trading into buying of NEAR on the open market. If the NEAR it buys plus the NEAR burned grows to match the NEAR the protocol issues, all newly issued NEAR is either burned or held off the market.";

/** How the thesis works, in three steps that follow the three pillars; shown under the statement on Home and in THESIS.md. */
export const THESIS_STEPS = [
  "People swap tokens across chains through NEAR Intents, and they never need to hold NEAR to do it.",
  `Since ${formatMonthYear(BUYBACKS_START_DAY)}, the NEAR Intents app and the 1Click API have spent the fees they keep on buying NEAR on the open market, and the NEAR bought is not burned. Gas fees on NEAR are burned, all of them from protocol ${FULL_BURN_PROTOCOL} on.`,
  `New supply grows more slowly: ${ISSUANCE_HALVED}, and ${HSP029_TERMS}.`,
] as const;

type PillarId = "demand" | "capture" | "supply";

export type SectionId = PillarId | "valuation" | "technology" | "network" | "peers";

/** Every thesis section in the order the thesis presents them: the three pillars, then valuation and the supporting checks. */
export const SECTION_ORDER: SectionId[] = ["demand", "capture", "supply", "valuation", "technology", "network", "peers"];

/** The three pillars the thesis rests on. */
export const PILLARS = new Set<SectionId>(["demand", "capture", "supply"] satisfies PillarId[]);

/** Sections whose breaking points test the thesis itself, the pillars and valuation; the verdict counts the rest as supporting checks. */
export const CORE_SECTIONS = new Set<SectionId>([...PILLARS, "valuation"]);

/** One thesis section: its claim and fixed bear-case text, shown at the top of its page. The text holds only what the data
    cannot change (mechanisms, dates, protocol rules); live sentences come from src/lib/thesis/findings.ts and the breaking
    point, with its status, from src/lib/thesis/triggers.ts. */
type ThesisSection = {
  eyebrow: string;
  title: string;
  claim: string;
  /** Fixed reasons the claim could fail, shown after the live bear-case sentences (lib/thesis/findings) and numbers (lib/thesis/stats). */
  against: string;
  /** A shorter `against`, shown at phone widths. */
  againstShort: string;
  href: string;
};

export const SECTIONS: Record<SectionId, ThesisSection> = {
  demand: {
    eyebrow: "Pillar 1",
    title: "Cross-chain trading runs through NEAR",
    claim: "NEAR Intents settles swaps across chains. Its users never need to hold NEAR, so they can come from any chain, not only from apps built on NEAR.",
    against:
      "Activity on NEAR itself need not follow Intents volume. Because Intents users never need to hold NEAR, their trading creates demand for the token mainly through the fees that buy it.",
    againstShort: "Intents users never need to hold NEAR, so their trading creates demand for the token mainly through the fees that buy it.",
    href: "/dashboard/usage",
  },
  capture: {
    eyebrow: "Pillar 2",
    title: "That trading buys NEAR",
    claim: `Since ${BUYBACKS_START_DAY}, the NEAR Intents app and the 1Click API have sent the fees they keep to their fee wallets and used them to buy NEAR on the open market. Their operators chose this; no protocol rule requires it. The NEAR bought stays in the three fee wallets and is not burned, so it remains in total supply. Gas fees on NEAR are burned, all of them from protocol ${FULL_BURN_PROTOCOL} on. Burn removes NEAR from total supply; buying holds it off the market.`,
    against:
      "The buying depends on the operators keeping their fee switch on, and no protocol rule makes them. Fees kept by other front ends and partners never buy NEAR, and the NEAR bought is not burned, so it can be sold.",
    againstShort: "No protocol rule keeps the buying on, and the NEAR bought is not burned, so it can be sold.",
    href: "/dashboard/revenue",
  },
  supply: {
    eyebrow: "Pillar 3",
    title: "New supply is growing more slowly",
    claim: `${upperFirst(ISSUANCE_HALVED)}, and NEAR's vesting schedule ended on ${VESTING_END_DAY}. ${HSP029_TERMS}.`,
    against: `Issuance adds NEAR every epoch (a fixed run of blocks), so total supply grows unless burn exceeds it, and the NEAR on the market grows unless burn plus buybacks exceed it. ${formatPercent(PROTOCOL_TREASURY_SHARE, 0)} of the NEAR minted goes to the protocol treasury, a multisig (an account whose transfers need approval from several keyholders) that can send it on to other accounts; that NEAR is not burned and stays in total supply. HSP-029 lowers issuance only after validators adopt it in a protocol upgrade.`,
    againstShort: "Total supply grows unless burn exceeds issuance, and HSP-029 lowers issuance only after validators adopt it.",
    href: "/dashboard/supply",
  },
  valuation: {
    eyebrow: "Valuation",
    title: "What today's price requires of buybacks",
    claim: `This section compares two monthly growth rates of NEAR bought. The first is the rate needed for burn plus buybacks to match monthly issuance by the end of ${formatMonths(COVERAGE_HORIZON_MONTHS)}, at today's price and with the burn held at its current rate. The second is the rate measured over the last 90 days against the 90 days before, with its 95% range. More NEAR bought needs more NEAR Intents volume or a larger share of that volume spent buying NEAR.`,
    against: `The measured growth of NEAR bought covers only the buying since ${formatMonthYear(BUYBACKS_START_DAY)}, and at a higher price the same fees buy less NEAR, so the growth needed rises with the price.`,
    againstShort: `The measured growth of NEAR bought covers only the buying since ${formatMonthYear(BUYBACKS_START_DAY)}.`,
    href: "/dashboard/valuation",
  },
  technology: {
    eyebrow: "Technology",
    title: "The chain can carry the usage",
    claim: "NEAR finalizes blocks within seconds and charges low gas fees, so the NEAR side of a cross-chain trade settles quickly and cheaply. Protocol upgrades ship through nearcore releases.",
    against:
      "Cheap transactions cut both ways: the lower the gas fees, the less NEAR the burn removes against issuance.",
    againstShort: "The lower the gas fees, the less NEAR the burn removes.",
    href: "/dashboard/technology",
  },
  network: {
    eyebrow: "Network",
    title: "No single party controls the network",
    claim: "Independent validators secure NEAR, and anyone with enough stake can join: a chunk-validator seat (the validator role open to the smallest stakes) needs only a fixed minimum share of total stake.",
    against: "A group holding more than a third of all stake can stop the chain from finalizing blocks if it acts together, and block-producer seats go to the largest stakes.",
    againstShort: "A group holding more than a third of all stake can stop the chain from finalizing blocks if it acts together.",
    href: "/dashboard/network",
  },
  peers: {
    eyebrow: "Peers",
    title: "No supply overhang left to unlock",
    claim: `NEAR's vesting schedule ended on ${VESTING_END_DAY}, so no scheduled unlocks remain. NEAR's supply still grows through issuance, so this thesis compares its yearly circulating-supply growth with that of the coins ranked above it.`,
    against:
      "Having no unlocks left does not mean no new supply: issuance still adds NEAR every year. Only burn offsets it in circulating supply, because the NEAR bought still counts as circulating. FDV (fully diluted value: the price × the total or maximum supply, counting tokens not yet circulating) ÷ market cap cannot show this, because newly issued NEAR adds to both.",
    againstShort: "Having no unlocks left does not mean no new supply: issuance still adds NEAR every year.",
    href: "/dashboard/peers",
  },
};
