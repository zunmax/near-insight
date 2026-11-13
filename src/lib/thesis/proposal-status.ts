import type { ProposalStatus } from "@/data/governance";
import { formatDateTimeUtc, formatPercent } from "@/lib/format";

/** One or two words for a status, for a stat value. Statuses come from the voting contract (ProposalStatus in
    houseofstake/house-of-stake-contracts, common/src/voting.rs); those not listed are shown as the contract names them. */
const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  Created: "Not started",
  ApprovalLegacy: "Not started",
  Queued: "Not started",
  Sandbox: "Not started",
  Scheduled: "Not started",
  Voting: "Voting",
  Timelock: "Passed",
  Succeeded: "Passed",
  FinishLegacy: "Passed",
  Executable: "Passed",
  InProgress: "Executing",
  Defeated: "Defeated",
  Vetoed: "Vetoed",
  Failed: "Execution failed",
  Rejected: "Rejected",
  Slashed: "Rejected",
  Expired: "Expired",
};

/** A proposal's status as its stat value: "Passed" for "Timelock", or "Result pending" while the contract still reads "Voting"
    after the voting window closed, as describeProposalStatus words it. */
export const proposalStatusLabel = (p: ProposalStatus) => (votingClosed(p) ? "Result pending" : (PROPOSAL_STATUS_LABEL[p.status] ?? p.status));

/** Statuses after which the proposal will not take effect. */
const ENDED_WITHOUT_EFFECT = new Set(["Failed", "Defeated", "Vetoed", "Rejected", "Slashed", "Expired"]);

/** True when a proposal can no longer take effect: defeated, vetoed, rejected, expired or failed on execution. */
export function proposalFailed(p: ProposalStatus): boolean {
  return ENDED_WITHOUT_EFFECT.has(p.status);
}

/** True while the contract still reads "Voting" after the voting window closed, as of the reading: the result is not recorded yet. */
export const votingClosed = (p: ProposalStatus) => p.status === "Voting" && p.votingEndsAt !== null && Date.parse(p.votingEndsAt) <= Date.parse(p.fetchedAt);

/** A proposal's state as a plain sentence, with its vote share and the date its open window closes. */
export function describeProposalStatus(p: ProposalStatus): string {
  const share = p.shareFor === null ? null : `${formatPercent(p.shareFor, 2)} of the voting power (veNEAR) that voted was for it`;
  /** `sentence` ends where the vote share follows, e.g. "The vote passed" → "The vote passed: 99.97% of the voting power (veNEAR) that voted was for it." */
  const withShare = (sentence: string, joiner = ":") => (share ? `${sentence}${joiner} ${share}.` : `${sentence}.`);
  const open = p.votingEndsAt ? `The vote is open until ${formatDateTimeUtc(p.votingEndsAt)}` : "The vote is open";
  switch (p.status) {
    case "Created":
    case "ApprovalLegacy":
    case "Queued":
    case "Sandbox":
    case "Scheduled":
      return "The vote has not started yet.";
    case "Voting":
      if (votingClosed(p)) return `${withShare(`The vote closed on ${formatDateTimeUtc(p.votingEndsAt!)}`, ";")} The voting contract has not recorded the result yet.`;
      return share ? withShare(open, "; so far") : `${open}; no veNEAR has voted yet.`;
    case "Timelock":
      return p.timelockEndsAt
        ? `${withShare("The vote passed")} It is in a timelock until ${formatDateTimeUtc(p.timelockEndsAt)}, a waiting period in which the council can still veto it.`
        : `${withShare("The vote passed")} It is in a timelock, a waiting period in which the council can still veto it.`;
    case "Succeeded":
    case "FinishLegacy":
    case "Executable":
    case "InProgress":
      return withShare("The vote passed");
    case "Failed":
      return `${withShare("The vote passed")} Its on-chain execution failed.`;
    case "Defeated":
      return withShare("The vote did not pass");
    case "Vetoed":
      return "The vote passed, but the council vetoed it during the timelock.";
    case "Rejected":
    case "Slashed":
      return "A reviewer rejected the proposal before the vote.";
    case "Expired":
      return "The proposal expired before the vote.";
    default:
      return `The proposal's status on the voting contract is ${p.status}.`;
  }
}
