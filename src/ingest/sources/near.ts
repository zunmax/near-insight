import { bearer, SOURCES } from "../../config/sources.ts";
import type { GovernanceProposal } from "../../db/schema.ts";
import { asArray, asRecord, readNumber, readRatio, readString, readYocto, ShapeError, yoctoToNear } from "../../lib/validate.ts";
import { EPOCH_LENGTH } from "../../config/protocol.ts";
import { rateGate, rpcCall, RpcError, UpstreamError } from "../http.ts";

/** JSON-RPC call to a NEAR node, with the optional FastNEAR key. */
const call = (method: string, params: unknown, url: string = SOURCES.nearRpc.baseUrl) =>
  rpcCall(url, method, params, bearer(SOURCES.nearRpc.apiKey));

const archiveGate = rateGate(SOURCES.nearArchive.ratePerMinute);

/** Gap between archival calls; a retry waits at least this long. */
const ARCHIVE_SPACING_MS = 60_000 / SOURCES.nearArchive.ratePerMinute;

const nanosToIso = (nanos: bigint) => new Date(Number(nanos / 1_000_000n)).toISOString();

/** Block header timestamp (nanoseconds as a string) → ISO time. */
const blockTime = (header: Record<string, unknown>) => nanosToIso(BigInt(readString(header, "timestamp_nanosec", "block.header")));

/** Chunks produced in this block. A shard that missed the block repeats its previous chunk (height_included < height). */
function newChunks(block: Record<string, unknown>, height: number): Array<Record<string, unknown>> {
  return asArray(block.chunks, "block.chunks")
    .map((chunk, i) => asRecord(chunk, `block.chunks[${i}]`))
    .filter((chunk, i) => readNumber(chunk, "height_included", `block.chunks[${i}]`) === height);
}

type NetworkState = {
  blockHeight: number;
  blockTime: string;
  protocolVersion: number;
  nodeVersion: string;
  totalSupplyNear: number;
  gasPriceYocto: string;
  shardCount: number;
  maxInflationRate: number;
  burntGasShareToContracts: number;
  blockProducerSeats: number;
  minimumStakeRatio: number;
};

type ValidatorSet = {
  epochHeight: number;
  validators: Array<{ accountId: string; stakeNear: number; producesBlocks: boolean }>;
};

/** Node status, latest final block header and protocol config, read in parallel. */
export async function fetchNetworkState(): Promise<NetworkState> {
  const [statusRaw, blockRaw, configRaw] = await Promise.all([
    call("status", []),
    call("block", { finality: "final" }),
    call("EXPERIMENTAL_protocol_config", { finality: "final" }),
  ]);
  const status = asRecord(statusRaw, "status");
  const version = asRecord(status.version, "status.version");
  const header = asRecord(asRecord(blockRaw, "block").header, "block.header");
  const config = asRecord(configRaw, "protocol_config");
  const txCosts = asRecord(asRecord(config.runtime_config, "runtime_config").transaction_costs, "transaction_costs");
  const layout = asRecord(Object.values(asRecord(config.shard_layout, "shard_layout"))[0], "shard_layout.*");

  return {
    blockHeight: readNumber(header, "height", "block.header"),
    blockTime: blockTime(header),
    protocolVersion: readNumber(config, "protocol_version", "protocol_config"),
    nodeVersion: readString(version, "version", "status.version"),
    totalSupplyNear: yoctoToNear(readString(header, "total_supply", "block.header"), "block.header.total_supply"),
    gasPriceYocto: readString(header, "gas_price", "block.header"),
    shardCount: asArray(layout.shard_ids, "shard_layout.*.shard_ids").length,
    maxInflationRate: readRatio(config, "max_inflation_rate", "protocol_config"),
    burntGasShareToContracts: readRatio(txCosts, "burnt_gas_reward", "transaction_costs"),
    blockProducerSeats: readNumber(config, "num_block_producer_seats", "protocol_config"),
    minimumStakeRatio: readRatio(config, "minimum_stake_ratio", "protocol_config"),
  };
}

type LiveBlock = { height: number; time: string; chunkGasUsed: number; chunkGasLimit: number };

/** Latest final block: height, time, gas used by the chunks produced in this block, and the gas limit of all shards.
    A repeated chunk of a shard that missed the block is not counted again. */
export async function fetchLiveBlock(): Promise<LiveBlock> {
  const block = asRecord(await call("block", { finality: "final" }), "block");
  const header = asRecord(block.header, "block.header");
  const height = readNumber(header, "height", "block.header");
  const chunks = asArray(block.chunks, "block.chunks").map((chunk, i) => asRecord(chunk, `block.chunks[${i}]`));
  return {
    height,
    time: blockTime(header),
    chunkGasUsed: newChunks(block, height).reduce((sum, c) => sum + readNumber(c, "gas_used", "block.chunks[]"), 0),
    chunkGasLimit: chunks.reduce((sum, c, i) => sum + readNumber(c, "gas_limit", `block.chunks[${i}]`), 0),
  };
}

/** Header fields of a block used for supply accounting. Amounts are exact yoctoNEAR. */
export type EpochBlock = {
  hash: string;
  /** Hash of the block before it, so a block's parent is read exactly, whatever heights were skipped between them. */
  prevHash: string;
  height: number;
  time: string;
  epochId: string;
  /** The header's next_epoch_id: an epoch's id is the hash of the last block two epochs earlier, so this is the previous epoch's last block. */
  previousEpochEndHash: string;
  totalSupplyYocto: bigint;
  /** NEAR burned by the chunks this block includes, already taken out of its total_supply. */
  burntYocto: bigint;
};

/** An epoch's first block and the block before it, the previous epoch's last. */
type EpochStart = { first: EpochBlock; previousLast: EpochBlock };

/** Height of the current epoch's first block. */
export async function fetchEpochStartHeight(): Promise<number> {
  return readNumber(asRecord(await call("validators", [null]), "validators"), "epoch_start_height", "validators");
}

/** Block by height or hash from the archival RPC (header and chunk headers); null when no block was produced at that height. */
async function fetchArchiveBlock(blockId: number | string): Promise<EpochBlock | null> {
  let body: unknown;
  try {
    body = await archiveGate(() => rpcCall(SOURCES.nearArchive.baseUrl, "block", { block_id: blockId }, {}, ARCHIVE_SPACING_MS));
  } catch (error) {
    if (typeof blockId === "number" && error instanceof RpcError && error.causeName === "UNKNOWN_BLOCK") return null;
    throw error;
  }
  const block = asRecord(body, `block ${blockId}`);
  const header = asRecord(block.header, "block.header");
  const blockHeight = readNumber(header, "height", "block.header");
  return {
    hash: readString(header, "hash", "block.header"),
    prevHash: readString(header, "prev_hash", "block.header"),
    height: blockHeight,
    time: blockTime(header),
    epochId: readString(header, "epoch_id", "block.header"),
    previousEpochEndHash: readString(header, "next_epoch_id", "block.header"),
    totalSupplyYocto: readYocto(header, "total_supply", "block.header"),
    burntYocto: newChunks(block, blockHeight).reduce((sum, c) => sum + readYocto(c, "balance_burnt", "block.chunks[]"), 0n),
  };
}

/** Heights searched upward for the next existing block; producers skip a height only now and then. */
const MAX_SKIPPED_HEIGHTS = 20;

/** Block with this hash, read from a later block's header, so it exists. */
async function fetchBlockByHash(hash: string): Promise<EpochBlock> {
  const block = await fetchArchiveBlock(hash);
  if (!block) throw new UpstreamError(`no block with hash ${hash}`);
  return block;
}

/** Last block before the epoch that starts at height `epochStart`: the parent of that epoch's first block. */
export async function fetchLastBlockBefore(epochStart: number): Promise<EpochBlock> {
  const first = await fetchArchiveBlock(epochStart);
  if (!first) throw new UpstreamError(`no block at epoch start height ${epochStart}`);
  return fetchBlockByHash(first.prevHash);
}

/** Lowest block at or above `height`. */
async function fetchBlockFrom(height: number): Promise<EpochBlock> {
  for (let next = height; next < height + MAX_SKIPPED_HEIGHTS; next++) {
    const block = await fetchArchiveBlock(next);
    if (block) return block;
  }
  throw new UpstreamError(`no block within ${MAX_SKIPPED_HEIGHTS} heights from ${height}`);
}

/** Blocks searched around the expected height of an epoch's first block; skipped heights move it by a few (43,203 once in 119 epochs). */
const MAX_BOUNDARY_STEPS = 50;

/** First block of `last`'s epoch and the block before it (the previous epoch's last), searched from `guess`. The first block
    is the one whose parent's hash equals its header's next_epoch_id; one call per step away from the guess. */
async function fetchEpochStart(last: EpochBlock, guess: number): Promise<EpochStart> {
  let first = await fetchBlockFrom(guess);
  for (let step = 0; step < MAX_BOUNDARY_STEPS; step++) {
    if (first.epochId !== last.epochId) {
      first = await fetchBlockFrom(first.height + 1);
      continue;
    }
    const before = await fetchBlockByHash(first.prevHash);
    if (before.hash === first.previousEpochEndHash) return { first, previousLast: before };
    first = before;
  }
  throw new UpstreamError(`epoch ${last.epochId}: no first block within ${MAX_BOUNDARY_STEPS} blocks of height ${guess}`);
}

/** Epochs guessed at once: one per call the rate allows each second, at least one. */
const EPOCHS_AT_ONCE = Math.max(1, Math.floor(SOURCES.nearArchive.ratePerMinute / 60));

/** The epochs below the one ending in `last` (whose next epoch starts at height `nextStart`), newest first: their first blocks are
    guessed one epoch length apart and read at once, each kept only if it is its epoch's first block (prev_hash = next_epoch_id)
    and links to the epoch above by hash. When the first guess misses, `fetchEpochStart` searches for that epoch alone. */
export async function fetchEpochsBelow(last: EpochBlock, nextStart: number): Promise<EpochStart[]> {
  const guesses = await Promise.all(Array.from({ length: EPOCHS_AT_ONCE }, (_, i) => fetchArchiveBlock(nextStart - (i + 1) * EPOCH_LENGTH)));
  const firsts: EpochBlock[] = [];
  for (const block of guesses) {
    if (!block || block.prevHash !== block.previousEpochEndHash) break;
    firsts.push(block);
  }
  const parents = await Promise.all(firsts.map((first) => fetchBlockByHash(first.prevHash)));
  const epochs: EpochStart[] = [];
  let end = last;
  for (const [i, first] of firsts.entries()) {
    const previousLast = parents[i]!;
    if (first.epochId !== end.epochId || previousLast.hash !== end.previousEpochEndHash) break;
    epochs.push({ first, previousLast });
    end = previousLast;
  }
  return epochs.length > 0 ? epochs : [await fetchEpochStart(last, nextStart - EPOCH_LENGTH)];
}

export type EpochSupply = {
  epochId: string;
  startHeight: number;
  startTime: string;
  endHeight: number;
  endTime: string;
  endHash: string;
  previousEndHash: string;
  supplyStartNear: number;
  supplyEndNear: number;
  /** NEAR minted in the epoch's first block (the reward for the epoch before). */
  mintedNear: number;
  /** NEAR burned by every block of the epoch. */
  burntNear: number;
};

/** Exact supply accounting of one epoch from three headers: total_supply(block) = total_supply(parent) + minted (first block
    of an epoch only) − burned by the block's chunks. So burned = S(first) − S(last) + B(first) and minted = S(first) − S(last
    block of the previous epoch) + B(first); negative results mean the headers broke that rule and are rejected. */
export function epochSupply(first: EpochBlock, last: EpochBlock, previousLast: EpochBlock): EpochSupply {
  if (first.epochId !== last.epochId || previousLast.hash !== last.previousEpochEndHash) {
    throw new ShapeError(`epoch ${last.epochId}`, "first and last blocks of one epoch, and the previous epoch's last block");
  }
  return {
    epochId: last.epochId,
    startHeight: first.height,
    startTime: first.time,
    endHeight: last.height,
    endTime: last.time,
    endHash: last.hash,
    previousEndHash: previousLast.hash,
    supplyStartNear: yoctoToNear(String(first.totalSupplyYocto), "epoch.supply_start"),
    supplyEndNear: yoctoToNear(String(last.totalSupplyYocto), "epoch.supply_end"),
    mintedNear: yoctoToNear(String(first.totalSupplyYocto - previousLast.totalSupplyYocto + first.burntYocto), `epoch ${last.epochId} minted`),
    burntNear: yoctoToNear(String(first.totalSupplyYocto - last.totalSupplyYocto + first.burntYocto), `epoch ${last.epochId} burned`),
  };
}

/** veNEAR per vote option, in the voting contract's order. */
const VOTE_OPTIONS = { for: 0, against: 1, abstain: 2 } as const;

/** A House of Stake proposal from the voting contract's `get_proposal` view. */
export async function fetchProposal(contract: string, proposalId: number): Promise<GovernanceProposal> {
  const args = Buffer.from(JSON.stringify({ proposal_id: proposalId })).toString("base64");
  const params = { request_type: "call_function", finality: "final", account_id: contract, method_name: "get_proposal", args_base64: args };
  const bytes = asArray(asRecord(await call("query", params), "call_function").result, "call_function.result");
  if (!bytes.every((b) => typeof b === "number")) throw new ShapeError("call_function.result", "an array of bytes");
  const at = "get_proposal";
  const p = asRecord(JSON.parse(Buffer.from(bytes as number[]).toString("utf8")), at);
  const votes = asArray(p.votes, `${at}.votes`).map((v, i) => yoctoToNear(readString(asRecord(v, `${at}.votes[${i}]`), "total_venear", `${at}.votes[${i}]`), `${at}.votes[${i}]`));
  const snapshot = asRecord(p.snapshot_and_state, `${at}.snapshot_and_state`);
  const start = p.voting_start_time_ns == null ? null : BigInt(readString(p, "voting_start_time_ns", at));
  const votingEnd = start === null ? null : start + BigInt(readString(p, "voting_duration_ns", at));
  const timelock = p.timelock_duration_ns == null ? null : BigInt(readString(p, "timelock_duration_ns", at));
  return {
    contract,
    proposalId: readNumber(p, "id", at),
    title: readString(p, "title", at),
    status: readString(p, "status", at),
    venearFor: votes[VOTE_OPTIONS.for] ?? 0,
    venearAgainst: votes[VOTE_OPTIONS.against] ?? 0,
    venearAbstain: votes[VOTE_OPTIONS.abstain] ?? 0,
    venearSnapshot: yoctoToNear(readString(snapshot, "total_venear", `${at}.snapshot_and_state`), `${at}.snapshot_and_state.total_venear`),
    voters: readNumber(asRecord(p.total_votes, `${at}.total_votes`), "total_votes", `${at}.total_votes`),
    quorumThresholdBps: readNumber(p, "quorum_threshold_bps", at),
    approvalThresholdBps: readNumber(p, "approval_threshold_bps", at),
    votingEndsAt: votingEnd === null ? null : nanosToIso(votingEnd),
    timelockEndsAt: votingEnd === null || timelock === null ? null : nanosToIso(votingEnd + timelock),
  };
}

/** NEAR balance of an account (liquid plus locked as its own stake), in NEAR: the balance NearBlocks gives as amount plus amount_staked. */
export async function fetchAccountBalanceNear(accountId: string): Promise<number> {
  const account = asRecord(await call("query", { request_type: "view_account", finality: "final", account_id: accountId }), "view_account");
  const liquid = yoctoToNear(readString(account, "amount", "view_account"), "view_account.amount");
  const locked = yoctoToNear(readString(account, "locked", "view_account"), "view_account.locked");
  return liquid + locked;
}

/** Protocol version a network currently runs (`protocol_version`, not the node's `latest_protocol_version`). */
export async function fetchProtocolVersion(url: string): Promise<{ protocolVersion: number; nodeVersion: string }> {
  const status = asRecord(await call("status", [], url), "status");
  return {
    protocolVersion: readNumber(status, "protocol_version", "status"),
    nodeVersion: readString(asRecord(status.version, "status.version"), "version", "status.version"),
  };
}

/** Active validators of the current epoch. */
export async function fetchValidatorSet(): Promise<ValidatorSet> {
  const result = asRecord(await call("validators", [null]), "validators");
  return {
    epochHeight: readNumber(result, "epoch_height", "validators"),
    validators: asArray(result.current_validators, "validators.current_validators").map((row, i) => {
      const at = `validators.current_validators[${i}]`;
      const r = asRecord(row, at);
      return {
        accountId: readString(r, "account_id", at),
        stakeNear: yoctoToNear(readString(r, "stake", at), `${at}.stake`),
        producesBlocks: readNumber(r, "num_expected_blocks", at) > 0,
      };
    }),
  };
}
