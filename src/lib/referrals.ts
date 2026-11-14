import { NO_REFERRAL } from "@/config/intents";
import type { ThesisMetrics } from "@/data/thesis-metrics";

/** A NEAR Intents referral as people read it: an account under intents-referral.near by its name and "(referral)", a partner
    known only by an id as unnamed with the id's first 8 characters (so two stay apart), and swaps without one as "No referral". */
export function referralLabel(referral: string): string {
  if (referral === NO_REFERRAL) return "No referral";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referral)
    ? `Unnamed partner ${referral.slice(0, 8)}`
    : referral.replace(/\.intents-referral\.near$/, " (referral)");
}

/** The swaps of a referral named as a subject: "Swaps through swapkit". */
export const referralSwaps = (referral: string) => `Swaps through ${referralLabel(referral)}`;

/** The named referral whose 1Click swaps paid the most app fees over the 30 days (swaps without one are no single front end), with
    its shares of all their fees and volume; null without a named referral or without fees. */
export function largestReferral(r: ThesisMetrics["referrals"]): { referral: string; feeShare: number; volumeShare: number } | null {
  const top = r?.byReferral.find((totals) => totals.referral !== NO_REFERRAL);
  if (!r || !top || r.feesUsd <= 0 || r.volumeUsd <= 0) return null;
  return { referral: top.referral, feeShare: top.feesUsd / r.feesUsd, volumeShare: top.volumeUsd / r.volumeUsd };
}
