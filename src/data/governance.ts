import "server-only";
import { cacheLife } from "next/cache";
import { getReader } from "@/data/reader";
import type { GovernanceProposal } from "@/db/schema";

export type ProposalStatus = GovernanceProposal & {
  /** veNEAR for ÷ all veNEAR voted (abstentions included). */
  shareFor: number | null;
  fetchedAt: string;
};

/** A House of Stake proposal as last read, or null before the governance job has stored it. */
export async function getProposal(contract: string, proposalId: number): Promise<ProposalStatus | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;
  const r = db.prepare("SELECT * FROM governance_proposals WHERE contract = ? AND proposal_id = ?").get(contract, proposalId);
  if (!r) return null;
  const venearFor = Number(r.venear_for);
  const voted = venearFor + Number(r.venear_against) + Number(r.venear_abstain);
  return {
    contract: String(r.contract),
    proposalId: Number(r.proposal_id),
    title: String(r.title),
    status: String(r.status),
    venearFor,
    venearAgainst: Number(r.venear_against),
    venearAbstain: Number(r.venear_abstain),
    venearSnapshot: Number(r.venear_snapshot),
    voters: Number(r.voters),
    quorumThresholdBps: Number(r.quorum_threshold_bps),
    approvalThresholdBps: Number(r.approval_threshold_bps),
    votingEndsAt: r.voting_ends_at === null ? null : String(r.voting_ends_at),
    timelockEndsAt: r.timelock_ends_at === null ? null : String(r.timelock_ends_at),
    shareFor: voted > 0 ? venearFor / voted : null,
    fetchedAt: String(r.fetched_at),
  };
}
