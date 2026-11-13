import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalStatus } from "../src/data/governance.ts";
import { describeProposalStatus, proposalFailed, proposalStatusLabel, votingClosed } from "../src/lib/thesis/proposal-status.ts";
import { assertWellFormed, holdingMetrics } from "./thesis-metrics-fixture.ts";

/** HSP-029 as read on 2026-11-11 with its vote open until 2026-11-16 16:48 UTC, with `change` applied. */
const proposal = (change: Partial<ProposalStatus> = {}): ProposalStatus => ({
  ...holdingMetrics().hsp029!,
  status: "Voting",
  votingEndsAt: "2026-11-16T16:48:00.000Z",
  timelockEndsAt: null,
  ...change,
});

const SHARE = "99.97% of the voting power (veNEAR) that voted was for it";

describe("proposalStatusLabel", () => {
  test("names every contract status in one or two words", () => {
    const labels: Record<string, string> = {
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
    for (const [status, label] of Object.entries(labels)) assert.equal(proposalStatusLabel(proposal({ status })), label, status);
  });

  test("reads Result pending while the contract still says Voting after the window closed", () => {
    assert.equal(proposalStatusLabel(proposal({ votingEndsAt: "2026-11-09T16:48:00.000Z" })), "Result pending");
    assert.equal(proposalStatusLabel(proposal({ votingEndsAt: "2026-11-11T08:00:00.000Z" })), "Result pending");
    assert.equal(proposalStatusLabel(proposal({ votingEndsAt: null })), "Voting");
  });

  test("shows a status it does not know as the contract names it", () => {
    assert.equal(proposalStatusLabel(proposal({ status: "Paused" })), "Paused");
  });
});

describe("votingClosed", () => {
  test("is true only for Voting once the window has closed as of the reading", () => {
    assert.equal(votingClosed(proposal()), false);
    assert.equal(votingClosed(proposal({ votingEndsAt: "2026-11-11T08:00:00.000Z" })), true);
    assert.equal(votingClosed(proposal({ votingEndsAt: "2026-11-11T08:00:01.000Z" })), false);
    assert.equal(votingClosed(proposal({ status: "Timelock", votingEndsAt: "2026-11-09T16:48:00.000Z" })), false);
    assert.equal(votingClosed(proposal({ votingEndsAt: null })), false);
  });
});

describe("proposalFailed", () => {
  test("is true for statuses after which the proposal cannot take effect", () => {
    for (const status of ["Failed", "Defeated", "Vetoed", "Rejected", "Slashed", "Expired"]) assert.equal(proposalFailed(proposal({ status })), true, status);
    for (const status of ["Created", "Voting", "Timelock", "Succeeded", "Executable", "InProgress"]) assert.equal(proposalFailed(proposal({ status })), false, status);
  });
});

describe("describeProposalStatus", () => {
  test("words an open vote with its closing time and the share so far", () => {
    assert.equal(describeProposalStatus(proposal()), `The vote is open until 2026-11-16 16:48 UTC; so far ${SHARE}.`);
    assert.equal(describeProposalStatus(proposal({ shareFor: null })), "The vote is open until 2026-11-16 16:48 UTC; no veNEAR has voted yet.");
    assert.equal(describeProposalStatus(proposal({ shareFor: null, votingEndsAt: null })), "The vote is open; no veNEAR has voted yet.");
  });

  test("words a closed vote whose result is not recorded yet", () => {
    const closed = proposal({ votingEndsAt: "2026-11-09T16:48:00.000Z" });
    assert.equal(describeProposalStatus(closed), `The vote closed on 2026-11-09 16:48 UTC; ${SHARE}. The voting contract has not recorded the result yet.`);
    assert.equal(describeProposalStatus({ ...closed, shareFor: null }), "The vote closed on 2026-11-09 16:48 UTC. The voting contract has not recorded the result yet.");
  });

  test("words a passed vote, with its timelock end when known", () => {
    assert.equal(
      describeProposalStatus(proposal({ status: "Timelock", timelockEndsAt: "2026-11-16T16:48:00.000Z" })),
      `The vote passed: ${SHARE}. It is in a timelock until 2026-11-16 16:48 UTC, a waiting period in which the council can still veto it.`,
    );
    assert.equal(
      describeProposalStatus(proposal({ status: "Timelock" })),
      `The vote passed: ${SHARE}. It is in a timelock, a waiting period in which the council can still veto it.`,
    );
    for (const status of ["Succeeded", "FinishLegacy", "Executable", "InProgress"]) assert.equal(describeProposalStatus(proposal({ status })), `The vote passed: ${SHARE}.`, status);
    assert.equal(describeProposalStatus(proposal({ status: "Succeeded", shareFor: null })), "The vote passed.");
  });

  test("words the statuses before and after a vote without effect", () => {
    for (const status of ["Created", "ApprovalLegacy", "Queued", "Sandbox", "Scheduled"]) assert.equal(describeProposalStatus(proposal({ status })), "The vote has not started yet.", status);
    assert.equal(describeProposalStatus(proposal({ status: "Failed" })), `The vote passed: ${SHARE}. Its on-chain execution failed.`);
    assert.equal(describeProposalStatus(proposal({ status: "Defeated", shareFor: 0.3 })), "The vote did not pass: 30.00% of the voting power (veNEAR) that voted was for it.");
    assert.equal(describeProposalStatus(proposal({ status: "Vetoed" })), "The vote passed, but the council vetoed it during the timelock.");
    assert.equal(describeProposalStatus(proposal({ status: "Rejected" })), "A reviewer rejected the proposal before the vote.");
    assert.equal(describeProposalStatus(proposal({ status: "Slashed" })), "A reviewer rejected the proposal before the vote.");
    assert.equal(describeProposalStatus(proposal({ status: "Expired" })), "The proposal expired before the vote.");
  });

  test("names a status it does not know", () => {
    assert.equal(describeProposalStatus(proposal({ status: "Paused" })), "The proposal's status on the voting contract is Paused.");
  });

  test("prints no empty value for any status, with or without a share and times", () => {
    const statuses = ["Created", "Voting", "Timelock", "Succeeded", "Failed", "Defeated", "Vetoed", "Rejected", "Expired", "Paused"];
    for (const status of statuses) {
      assertWellFormed(describeProposalStatus(proposal({ status })));
      assertWellFormed(describeProposalStatus(proposal({ status, shareFor: null, votingEndsAt: null, timelockEndsAt: null })));
    }
  });
});
