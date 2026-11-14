/** The ingest worker: job schedules, retries, run budgets, history starts, retention, and when its data counts as stale. */

const MINUTE = 60_000;

/** How often the worker runs each ingest job. The NearBlocks job stays inside its free tier (333 credits a day): 1 credit
    an hour, plus about 10 once a day when a new day is finished (about 34 a day), and about 115 on its first run. */
export const INGEST_SCHEDULE_MS = {
  liveBlock: MINUTE,
  nearblocks: 60 * MINUTE,
  /** The NEAR team's Dune dashboard refreshes about once a day at no fixed hour; a run that finds no new result makes one
      call for the dashboard and one per query. */
  dune: 120 * MINUTE,
  /** A run with no unread day makes no call; one with unread days starts them until PAGED_RUN_BUDGET_MS and finishes the one it is reading. */
  intentsExplorer: 10 * MINUTE,
  markets: 10 * MINUTE,
  network: 10 * MINUTE,
  validators: 30 * MINUTE,
  /** Often, so a database started without the snapshot's epochs fills its history soon; a run with nothing new makes three calls. */
  epochs: 5 * MINUTE,
  governance: 6 * 60 * MINUTE,
  defillama: 60 * MINUTE,
  coinPrices: 6 * 60 * MINUTE,
  peerSupply: 24 * 60 * MINUTE,
  /** Hourly, so yesterday's row swaps the markets job's last live price for its 00:00 UTC price within an hour of midnight. */
  nearPrice: 60 * MINUTE,
  releases: 6 * 60 * MINUTE,
  developers: 24 * 60 * MINUTE,
  cryptopanicNews: 5 * MINUTE,
  chaincatcherNews: 5 * MINUTE,
} as const;

/** Jobs health reports but that never fail it: no thesis number depends on their data (news, developer counts, releases), the thesis
    shows "—" for it without them (swaps by referral), or the job keeps its last data and DefiLlama fills Intents volume and fees (Dune). */
export const OPTIONAL_JOBS = ["cryptopanicNews", "chaincatcherNews", "developers", "releases", "dune", "intentsExplorer"] as const satisfies ReadonlyArray<
  keyof typeof INGEST_SCHEDULE_MS
>;

/** Flow data is stale when its shared last day is more days before today (UTC) than this; DefiLlama's normal lag is two days. */
export const FLOW_STALE_DAYS = 3;

/** Days a missing day can move a 30-day window earlier: one window, so a window never trails its data by more than that. */
export const MAX_PULL_BACK_DAYS = 30;

/** Live block data is stale when its newest sample is older than this; the block job samples every minute. */
export const LIVE_STALE_MS = 5 * MINUTE;

/** After a failed run a job is retried sooner than its schedule: this delay, doubled on each further failure, capped at
    the job's own interval, so a failing NearBlocks job costs at most three extra runs before it is back to hourly. */
export const FAILED_JOB_RETRY_MS = 10 * MINUTE;

/** The worker exits when no job has finished for this long (a hang), so Docker restarts it; health (src/ingest/health.ts)
    fails when no job has succeeded for this long. Every run stops well before it: the Dune helper at SOURCES.dune.runTimeoutMs,
    epochs at EPOCHS_RUN_BUDGET_MS, paged jobs at PAGED_RUN_BUDGET_MS (the Explorer API job after the day it is reading). */
export const WORKER_STALL_MS = 15 * MINUTE;

/** How often an ingest process touches its lock file; a lock untouched for three of these belongs to a process that is gone. */
export const INGEST_LOCK_HEARTBEAT_MS = MINUTE;

/** First UTC day of the per-epoch supply history: a month before max issuance was halved on 2025-10-29, so the measured rate shows it. */
export const EPOCH_HISTORY_START = "2025-10-01";

/** First UTC day of the BTC, ETH and NEAR price history the lead-lag test reads: before NEAR Intents volume began (2024-12-10). */
export const COIN_PRICE_HISTORY_START = "2024-11-01";

/** Explorer API days: the job reads a UTC day once `lagDays` have passed since it began, so swaps created late in it have
    settled, and its history starts with the `days` days ending on the newest such day: one 30-day window, and 5 days more so
    the fee check's window, which ends on the last day of Intents fees (a day or two earlier), is covered too. */
export const INTENTS_EXPLORER_DAYS = { days: 35, lagDays: 2 } as const;

/** Days a run of the coin price job reads back from the newest stored day, to pick up corrected points. */
export const COIN_PRICE_REFRESH_DAYS = 7;

/** Longest one run of the epochs job keeps reading before it saves what it has; later runs continue. Kept well under
    WORKER_STALL_MS, because the epochs a run reads are saved only when it ends. */
export const EPOCHS_RUN_BUDGET_MS = 8 * MINUTE;

/** About how long `npm run ingest` takes on an empty database (measured 2026-11-12): with the committed snapshot's epochs copied
    in, and without them at the default archival rate (26 epochs a minute). With an Explorer API key, its first 35 days come on
    top. The README's `npm run rebuild` times add its later steps. */
export const FRESH_INGEST_MINUTES = { withSnapshot: 5, withoutSnapshot: 55 } as const;

/** Longest a job that makes one paced call per coin or page keeps calling before it saves what it has (peer supply, news
    catch-up). Kept well under WORKER_STALL_MS, so one run, and a one-off `npm run ingest`, ends within minutes. */
export const PAGED_RUN_BUDGET_MS = 5 * MINUTE;

/** News older than this is deleted. */
export const NEWS_RETENTION_DAYS = 365;

/** A story is one already stored when a story with the same title was published within this many days of it. */
export const NEWS_DUPLICATE_WINDOW_DAYS = 3;

/** Ingest run log entries older than this are deleted, and how often the worker deletes them. */
export const RUN_LOG_RETENTION_DAYS = 30;
export const RUN_LOG_PRUNE_MS = 24 * 60 * MINUTE;

/** Daily copies of the database the worker keeps (src/db/backup.ts), and how often it checks whether today's is made yet. */
export const BACKUP_RETENTION_DAYS = 14;
export const BACKUP_CHECK_MS = 60 * MINUTE;

/** Live samples (block readings each minute) older than this are deleted. */
export const LIVE_RETENTION_DAYS = 7;

/** Window of the live block time and gas use, read from the block samples taken each minute. */
export const LIVE_BLOCKS_WINDOW_MINUTES = 120;

/** Finished days of transactions a minute shown under the live panel. */
export const LIVE_TXNS_TREND_DAYS = 14;
