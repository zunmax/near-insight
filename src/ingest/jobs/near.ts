/** NEAR RPC jobs: network state and tracked balances, validators, epoch supply (archival RPC), governance and the live block. */
import { DatabaseSync } from "node:sqlite";
import { SNAPSHOT_PATH } from "../../config/database.ts";
import { EPOCH_HISTORY_START, EPOCHS_RUN_BUDGET_MS, INGEST_SCHEDULE_MS } from "../../config/ingest.ts";
import { BUYBACKS_START_DAY, HSP029 } from "../../config/protocol.ts";
import {
  BUYBACK_ACCOUNT,
  FRONTEND_FEE_ACCOUNT,
  HOUSE_OF_STAKE_CONTRACT,
  ONE_CLICK_FEE_ACCOUNT,
  PROTOCOL_TREASURY_ACCOUNT,
} from "../../config/sources.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, LIVE, SCHEMA_VERSION, SERIES, type SeriesName } from "../../db/schema.ts";
import { snapshotMatchesManifest } from "../../db/snapshot.ts";
import { errorMessage } from "../../lib/validate.ts";
import { now, spreadOverDays, today } from "../days.ts";
import {
  epochSupply,
  fetchAccountBalanceNear,
  fetchEpochsBelow,
  fetchEpochStartHeight,
  fetchLastBlockBefore,
  fetchLiveBlock,
  fetchNetworkState,
  fetchProposal,
  fetchValidatorSet,
  type EpochBlock,
  type EpochSupply,
} from "../sources/near.ts";
import type { Job } from "./job.ts";
import { insertLive, pruneLive, upsertSeries } from "./storage.ts";

/** Accounts whose daily NEAR balance is kept, each with the first day of its history: the fee wallets and the protocol treasury. */
export const TRACKED_BALANCES: Array<{ series: SeriesName; account: string; from: string }> = [
  { series: SERIES.buybackWalletNear, account: BUYBACK_ACCOUNT, from: BUYBACKS_START_DAY },
  { series: SERIES.frontendFeeWalletNear, account: FRONTEND_FEE_ACCOUNT, from: BUYBACKS_START_DAY },
  { series: SERIES.oneClickFeeWalletNear, account: ONE_CLICK_FEE_ACCOUNT, from: BUYBACKS_START_DAY },
  { series: SERIES.treasuryNear, account: PROTOCOL_TREASURY_ACCOUNT, from: EPOCH_HISTORY_START },
];

export const networkJob: Job = {
  name: JOBS.network,
  everyMs: INGEST_SCHEDULE_MS.network,
  async run(db) {
    const [n, balances] = await Promise.all([fetchNetworkState(), Promise.all(TRACKED_BALANCES.map(({ account }) => fetchAccountBalanceNear(account)))]);
    return transaction(db, () => {
      db.prepare(
        `INSERT INTO network_latest (id, block_height, block_time, protocol_version, node_version, total_supply_near, gas_price_yocto,
           shard_count, max_inflation_rate, burnt_gas_share_to_contracts, block_producer_seats, minimum_stake_ratio, fetched_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET block_height = excluded.block_height, block_time = excluded.block_time,
           protocol_version = excluded.protocol_version, node_version = excluded.node_version, total_supply_near = excluded.total_supply_near,
           gas_price_yocto = excluded.gas_price_yocto, shard_count = excluded.shard_count, max_inflation_rate = excluded.max_inflation_rate,
           burnt_gas_share_to_contracts = excluded.burnt_gas_share_to_contracts, block_producer_seats = excluded.block_producer_seats,
           minimum_stake_ratio = excluded.minimum_stake_ratio, fetched_at = excluded.fetched_at`,
      ).run(
        n.blockHeight, n.blockTime, n.protocolVersion, n.nodeVersion, n.totalSupplyNear, n.gasPriceYocto, n.shardCount,
        n.maxInflationRate, n.burntGasShareToContracts, n.blockProducerSeats, n.minimumStakeRatio, now(),
      );
      return (
        1 +
        upsertSeries(db, SERIES.nearTotalSupply, [{ day: today(), value: n.totalSupplyNear }]) +
        TRACKED_BALANCES.reduce((sum, { series }, i) => sum + upsertSeries(db, series, [{ day: today(), value: balances[i]! }]), 0)
      );
    });
  },
};

export const validatorsJob: Job = {
  name: JOBS.validators,
  everyMs: INGEST_SCHEDULE_MS.validators,
  async run(db) {
    const set = await fetchValidatorSet();
    /** num_expected_blocks grows during the epoch, so a validator read as no producer early on is updated by a later reading. */
    return transaction(db, () => {
      const stmt = db.prepare(
        `INSERT INTO validator_epochs (epoch_height, account_id, stake_near, produces_blocks) VALUES (?, ?, ?, ?)
         ON CONFLICT (epoch_height, account_id) DO UPDATE SET produces_blocks = MAX(produces_blocks, excluded.produces_blocks)
         WHERE excluded.produces_blocks > produces_blocks`,
      );
      let written = 0;
      for (const v of set.validators) written += Number(stmt.run(set.epochHeight, v.accountId, v.stakeNear, v.producesBlocks ? 1 : 0).changes);
      return written;
    });
  },
};

/** Rewrites the daily minted and burned series from every stored epoch; only days the epochs cover completely are written. */
function writeEpochSeries(db: DatabaseSync): number {
  const epochs = db
    .prepare("SELECT start_time, end_time, minted_near, burnt_near FROM epoch_supply ORDER BY start_height")
    .all()
    .map((r) => ({ start: Date.parse(String(r.start_time)) / 1000, end: Date.parse(String(r.end_time)) / 1000, minted: Number(r.minted_near), burnt: Number(r.burnt_near) }));
  return (
    upsertSeries(db, SERIES.mintedNear, spreadOverDays(epochs.map((e) => ({ start: e.start, end: e.end, value: e.minted })))) +
    upsertSeries(db, SERIES.burntNear, spreadOverDays(epochs.map((e) => ({ start: e.start, end: e.end, value: e.burnt }))))
  );
}

/** EPOCH_HISTORY_START as the ISO time the stored epochs' start_time is compared with. */
const EPOCH_HISTORY_START_TIME = new Date(`${EPOCH_HISTORY_START}T00:00:00Z`).toISOString();

const EPOCH_COLUMNS = "epoch_id, start_height, start_time, end_height, end_time, end_hash, prev_end_hash, supply_start_near, supply_end_near, minted_near, burnt_near";

/** Inserts one epoch row, values in EPOCH_COLUMNS order; an epoch already stored is kept. */
const insertEpoch = (db: DatabaseSync) =>
  db.prepare(`INSERT INTO epoch_supply (${EPOCH_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (epoch_id) DO NOTHING`);

/** Fills an empty epoch table from the committed snapshot when its SHA-256 matches MANIFEST.json and its schema is this one:
    block headers never change, so a new database then reads only the epochs since. Returns the epochs copied. */
function copySnapshotEpochs(db: DatabaseSync): number {
  if (db.prepare("SELECT 1 FROM epoch_supply LIMIT 1").get() || !snapshotMatchesManifest()) return 0;
  const snapshot = new DatabaseSync(SNAPSHOT_PATH, { readOnly: true });
  try {
    if (Number(snapshot.prepare("PRAGMA user_version").get()?.user_version) !== SCHEMA_VERSION) return 0;
    const rows = snapshot.prepare(`SELECT ${EPOCH_COLUMNS} FROM epoch_supply`).all();
    return transaction(db, () => {
      const insert = insertEpoch(db);
      return rows.reduce((copied, row) => copied + Number(insert.run(...Object.values(row)).changes), 0);
    });
  } finally {
    snapshot.close();
  }
}

/** Complete epochs, newest first, back to the one holding EPOCH_HISTORY_START: each epoch's last block is the parent of the next
    epoch's first, its first is searched one epoch length lower, and stored epochs are passed by their previous-epoch hash. An
    empty table starts from the snapshot's epochs. A run stops at EPOCHS_RUN_BUDGET_MS; epochs read before then are saved. */
export const epochsJob: Job = {
  name: JOBS.epochs,
  everyMs: INGEST_SCHEDULE_MS.epochs,
  backlog(db) {
    const oldest = db.prepare("SELECT MIN(start_time) AS start_time FROM epoch_supply").get()?.start_time;
    if (oldest == null || String(oldest) > EPOCH_HISTORY_START_TIME) return true;
    /** A stored epoch after the history start whose previous epoch is not stored: a gap the next run fills. */
    const gap = db
      .prepare("SELECT 1 FROM epoch_supply e WHERE e.start_time > ? AND NOT EXISTS (SELECT 1 FROM epoch_supply p WHERE p.end_hash = e.prev_end_hash) LIMIT 1")
      .get(EPOCH_HISTORY_START_TIME);
    return gap !== undefined;
  },
  async run(db) {
    const copied = copySnapshotEpochs(db);
    const stored = db.prepare("SELECT start_height, start_time, prev_end_hash FROM epoch_supply WHERE end_hash = ?");
    /** Oldest stored epoch reached from the one ending in `hash` through stored predecessors, or undefined if that one is not stored. */
    const oldestStoredFrom = (hash: string) => {
      let row = stored.get(hash);
      for (let previous = row && stored.get(String(row.prev_end_hash)); previous; previous = stored.get(String(previous.prev_end_hash))) row = previous;
      return row;
    };
    const epochs: EpochSupply[] = [];
    const deadline = Date.now() + EPOCHS_RUN_BUDGET_MS;
    let failure: unknown = null;
    try {
      let nextStart = await fetchEpochStartHeight();
      let end: EpochBlock | null = null;
      let reachedHistoryStart = false;
      while (!reachedHistoryStart && Date.now() < deadline) {
        end ??= await fetchLastBlockBefore(nextStart);
        const oldest = oldestStoredFrom(end.hash);
        if (oldest) {
          if (String(oldest.start_time) <= EPOCH_HISTORY_START_TIME) break;
          nextStart = Number(oldest.start_height);
          end = await fetchLastBlockBefore(nextStart);
          if (end.hash !== String(oldest.prev_end_hash)) throw new Error(`block ${end.height} is not the last block before stored height ${nextStart}`);
        }
        for (const { first, previousLast } of await fetchEpochsBelow(end, nextStart)) {
          const epoch = epochSupply(first, end, previousLast);
          epochs.push(epoch);
          nextStart = first.height;
          end = previousLast;
          reachedHistoryStart = epoch.startTime <= EPOCH_HISTORY_START_TIME;
          /** Epochs read ahead past a stored one are skipped; the next pass jumps over the stored chain. */
          if (reachedHistoryStart || stored.get(end.hash)) break;
        }
      }
    } catch (error) {
      failure = error;
    }
    const rows = transaction(db, () => {
      const insert = insertEpoch(db);
      for (const e of epochs) {
        insert.run(e.epochId, e.startHeight, e.startTime, e.endHeight, e.endTime, e.endHash, e.previousEndHash, e.supplyStartNear,
          e.supplyEndNear, e.mintedNear, e.burntNear);
      }
      const added = copied + epochs.length;
      return added + (added > 0 ? writeEpochSeries(db) : 0);
    });
    if (failure) throw new Error(`stopped after ${epochs.length} new epochs (${rows} rows saved): ${errorMessage(failure)}`);
    return rows;
  },
};

export const governanceJob: Job = {
  name: JOBS.governance,
  everyMs: INGEST_SCHEDULE_MS.governance,
  async run(db) {
    const p = await fetchProposal(HOUSE_OF_STAKE_CONTRACT, HSP029.proposalId);
    return transaction(db, () => {
      db.prepare(
        `INSERT INTO governance_proposals (contract, proposal_id, title, status, venear_for, venear_against, venear_abstain, venear_snapshot,
           voters, quorum_threshold_bps, approval_threshold_bps, voting_ends_at, timelock_ends_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (contract, proposal_id) DO UPDATE SET title = excluded.title, status = excluded.status, venear_for = excluded.venear_for,
           venear_against = excluded.venear_against, venear_abstain = excluded.venear_abstain, venear_snapshot = excluded.venear_snapshot,
           voters = excluded.voters, quorum_threshold_bps = excluded.quorum_threshold_bps, approval_threshold_bps = excluded.approval_threshold_bps,
           voting_ends_at = excluded.voting_ends_at, timelock_ends_at = excluded.timelock_ends_at, fetched_at = excluded.fetched_at`,
      ).run(p.contract, p.proposalId, p.title, p.status, p.venearFor, p.venearAgainst, p.venearAbstain, p.venearSnapshot, p.voters,
        p.quorumThresholdBps, p.approvalThresholdBps, p.votingEndsAt, p.timelockEndsAt, now());
      return 1;
    });
  },
};

export const liveBlockJob: Job = {
  name: JOBS.liveBlock,
  everyMs: INGEST_SCHEDULE_MS.liveBlock,
  async run(db) {
    const block = await fetchLiveBlock();
    return transaction(db, () => {
      const rows = insertLive(db, block.time, [
        [LIVE.blockHeight, block.height],
        [LIVE.chunkGasUsed, block.chunkGasUsed],
        [LIVE.chunkGasLimit, block.chunkGasLimit],
      ]);
      pruneLive(db);
      return rows;
    });
  },
};
