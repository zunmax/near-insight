/** Ingest worker: stores every public source in SQLite; a lock file beside the database keeps it to one process (a second exits 1).
    `node src/ingest/run.ts` runs all jobs now, then each on its schedule, pushes new news over WebSocket and copies the database daily;
    `node src/ingest/run.ts --once` runs all jobs once, repeating a job until its history is complete, and exits (code 1 if any job failed). */
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { setTimeout as wait } from "node:timers/promises";
import { DATABASE_PATH } from "../config/database.ts";
import { BACKUP_CHECK_MS, FAILED_JOB_RETRY_MS, INGEST_LOCK_HEARTBEAT_MS, RUN_LOG_PRUNE_MS, RUN_LOG_RETENTION_DAYS, WORKER_STALL_MS } from "../config/ingest.ts";
import { NEWS_EVENTS } from "../config/news-events.ts";
import { backupDatabase } from "../db/backup.ts";
import { openWriter } from "../db/connection.ts";
import { errorMessage } from "../lib/validate.ts";
import { daysAgo } from "./days.ts";
import { JOB_GROUPS, newsEvents, type Job } from "./jobs/index.ts";
import { startNewsEvents, type NewsEventServer } from "./news-events.ts";

const log = (message: string) => console.log(`[ingest] ${new Date().toISOString()} ${message}`);

/** When the last job run finished, on the monotonic clock (performance.now, ms), so a change of the system clock moves nothing. */
let lastFinishedAt = performance.now();

/** How often the stall watchdog checks. */
const WATCHDOG_TICK_MS = 60_000;

/** Lock file beside the database, so two ingest processes (the worker and a one-off run) never call the APIs at once. */
const LOCK_PATH = `${DATABASE_PATH}.ingest-lock`;

/** True when the lock file was last touched more than three heartbeats ago, or is gone. */
function lockSilent(): boolean {
  try {
    return Date.now() - statSync(LOCK_PATH).mtimeMs > 3 * INGEST_LOCK_HEARTBEAT_MS;
  } catch {
    return true;
  }
}

/** True when the holder of the lock with this text is gone. Another host's holder is gone when its heartbeat stopped; this host's
    when its process no longer exists, or exists but sends no heartbeat within one more interval (a process that woke from sleep
    sends one; another program that got its process id does not). */
async function lockIsStale(text: string): Promise<boolean> {
  let holder: { pid?: unknown; host?: unknown } = {};
  try {
    holder = JSON.parse(text) as { pid?: unknown; host?: unknown };
  } catch {
    return lockSilent();
  }
  if (holder.host !== hostname() || typeof holder.pid !== "number") return lockSilent();
  if (holder.pid === process.pid) return true;
  try {
    process.kill(holder.pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
  if (!lockSilent()) return false;
  await wait(INGEST_LOCK_HEARTBEAT_MS + 5_000);
  return lockSilent();
}

/** Creates the lock file, replacing one whose holder is gone; false while another ingest process holds it. */
async function acquireLock(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, host: hostname(), since: new Date().toISOString() }), { flag: "wx" });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") return false;
      let text: string;
      try {
        text = readFileSync(LOCK_PATH, "utf8");
      } catch {
        continue;
      }
      if (!(await lockIsStale(text))) return false;
      /** Moved aside, then checked to be the lock judged stale: when another process replaced it meanwhile, it is put back. */
      const stale = `${LOCK_PATH}.${process.pid}.stale`;
      try {
        renameSync(LOCK_PATH, stale);
      } catch {
        return false;
      }
      if (readFileSync(stale, "utf8") !== text) {
        renameSync(stale, LOCK_PATH);
        return false;
      }
      rmSync(stale, { force: true });
    }
  }
  return false;
}

/** Runs one job and logs the run; returns the rows it wrote, or null when it failed. */
async function runJob(db: DatabaseSync, job: Job): Promise<number | null> {
  const startedAt = new Date();
  let rows = 0;
  let error: string | null = null;
  try {
    rows = await job.run(db);
  } catch (err) {
    error = errorMessage(err).slice(0, 500);
  }
  const finishedAt = new Date();
  lastFinishedAt = performance.now();
  /** A run log that cannot be written (disk full, database locked) is logged, so the job still gets its next run. */
  try {
    db.prepare("INSERT INTO ingest_runs (job, started_at, finished_at, ok, rows_written, error) VALUES (?, ?, ?, ?, ?, ?)").run(
      job.name,
      startedAt.toISOString(),
      finishedAt.toISOString(),
      error ? 0 : 1,
      rows,
      error,
    );
  } catch (logError) {
    log(`${job.name}: run log not written: ${errorMessage(logError)}`);
  }
  const ms = finishedAt.getTime() - startedAt.getTime();
  log(error ? `${job.name} failed after ${ms}ms: ${error}` : `${job.name} ok, ${rows} rows in ${ms}ms`);
  return error ? null : rows;
}

/** The job's own interval after a success; after failures, FAILED_JOB_RETRY_MS doubled per further failure, capped at the interval. */
function nextRunDelay(job: Job, failures: number): number {
  return failures === 0 ? job.everyMs : Math.min(job.everyMs, FAILED_JOB_RETRY_MS * 2 ** (failures - 1));
}

function pruneRunLog(db: DatabaseSync) {
  try {
    db.prepare("DELETE FROM ingest_runs WHERE finished_at < ?").run(daysAgo(RUN_LOG_RETENTION_DAYS));
  } catch (error) {
    log(`run log not pruned: ${errorMessage(error)}`);
  }
}

/** Makes today's database copy if it is not made yet; a failure is logged and tried again at the next check. */
function backUp(db: DatabaseSync) {
  try {
    const path = backupDatabase(db);
    if (path) log(`database backed up to ${path}`);
  } catch (error) {
    log(`database not backed up: ${errorMessage(error)}`);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  /** The lock comes before the database is opened, so a second process never migrates the database under a running worker. */
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  if (!(await acquireLock())) {
    log(`another ingest process holds ${LOCK_PATH}, exiting`);
    process.exitCode = 1;
    return;
  }
  setInterval(() => {
    const now = new Date();
    try {
      utimesSync(LOCK_PATH, now, now);
    } catch {
      /** The lock file was removed from outside: write it again, so no second ingest process starts beside this one. */
      try {
        writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, host: hostname(), since: now.toISOString() }));
      } catch (error) {
        log(`lock file not renewed: ${errorMessage(error)}`);
      }
    }
  }, INGEST_LOCK_HEARTBEAT_MS).unref();
  const db = openWriter(DATABASE_PATH);
  log(`database ${DATABASE_PATH}`);

  const timers = new Map<Job, NodeJS.Timeout>();
  const pruneTimer = once ? undefined : setInterval(() => pruneRunLog(db), RUN_LOG_PRUNE_MS);
  const backupTimer = once ? undefined : setInterval(() => backUp(db), BACKUP_CHECK_MS);
  let events: NewsEventServer | null = null;
  /** Registered before the first pass, so a stop during it still releases the lock. */
  const stop = (signal: string) => {
    log(`${signal} received, stopping`);
    for (const timer of timers.values()) clearTimeout(timer);
    clearInterval(pruneTimer);
    clearInterval(backupTimer);
    events?.close();
    db.close();
    rmSync(LOCK_PATH, { force: true });
    process.exit(once ? 1 : 0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  /** Only a hung worker exits; one whose jobs fail keeps retrying them, so it recovers when the network returns.
      Measured on the monotonic clock; a tick far later than scheduled means the machine slept, not that a job hung,
      so the stall clock restarts then. */
  if (!once) {
    let lastTick = performance.now();
    setInterval(() => {
      const now = performance.now();
      const sinceTick = now - lastTick;
      lastTick = now;
      if (sinceTick > 2 * WATCHDOG_TICK_MS) {
        lastFinishedAt = now;
        return;
      }
      if (now - lastFinishedAt < WORKER_STALL_MS) return;
      log(`no job finished for ${Math.round((now - lastFinishedAt) / 60_000)} min, exiting so the supervisor restarts the worker`);
      rmSync(LOCK_PATH, { force: true });
      process.exit(1);
    }, WATCHDOG_TICK_MS).unref();
  }

  /** Live news is optional: a port that cannot be opened is logged, and the ingest jobs run without it. */
  events = once
    ? null
    : await startNewsEvents(db).catch((error: unknown) => {
        log(`news events not started: ${errorMessage(error)}`);
        return null;
      });
  if (events) {
    newsEvents.on("changed", events.refresh);
    newsEvents.on("stored", events.broadcast);
    log(`news events on ws://${NEWS_EVENTS.host}:${NEWS_EVENTS.port}${NEWS_EVENTS.path}`);
  }

  const schedule = (job: Job, failures: number) => {
    timers.set(
      job,
      setTimeout(async () => schedule(job, (await runJob(db, job)) === null ? failures + 1 : 0), nextRunDelay(job, failures)),
    );
  };

  /** All groups start now; each job joins its own schedule as soon as its first run ends, not after the whole pass. */
  const firstPass = await Promise.all(
    JOB_GROUPS.map(async (group) => {
      let groupOk = true;
      for (const job of group) {
        let rows = await runJob(db, job);
        /** A one-off run repeats a job while its history is incomplete and the last run stored more of it. */
        while (once && rows && job.backlog?.(db)) rows = await runJob(db, job);
        const ok = rows !== null;
        if (!once) schedule(job, ok ? 0 : 1);
        groupOk &&= ok;
      }
      return groupOk;
    }),
  );
  pruneRunLog(db);
  if (!once) backUp(db);

  if (once) {
    db.close();
    rmSync(LOCK_PATH, { force: true });
    process.exitCode = firstPass.every(Boolean) ? 0 : 1;
    return;
  }

  log("worker running");
}

await main();
