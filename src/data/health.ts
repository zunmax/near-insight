import "server-only";
import { EPOCHS_RUN_BUDGET_MS, FLOW_STALE_DAYS, INGEST_SCHEDULE_MS, LIVE_STALE_MS, OPTIONAL_JOBS, PAGED_RUN_BUDGET_MS } from "@/config/ingest";
import { SOURCES } from "@/config/sources";
import { latestLiveSampleAt } from "@/data/live";
import { getReader } from "@/data/reader";
import { JOBS, type JobName } from "@/db/schema";
import { coreLastDay } from "@/db/series";
import { DAY_SECONDS, isoDay } from "@/lib/metrics";

/** A job is overdue when it has not succeeded for this many of its own intervals plus LONGEST_RUN_MS. */
const OVERDUE_INTERVALS = 2;

/** Longest a single run can last (the Dune helper's timeout, an epochs batch, a paged run), since the next run starts after it ends. */
const LONGEST_RUN_MS = Math.max(SOURCES.dune.runTimeoutMs, EPOCHS_RUN_BUDGET_MS, PAGED_RUN_BUDGET_MS);

type JobHealth = { job: JobName; lastSuccessAt: string | null; overdue: boolean; optional: boolean };

/** Whether a job is overdue; `at` is its last success, `now` the time in ms. */
const isOverdue = (key: keyof typeof JOBS, at: string | null, now: number) =>
  at === null || now - Date.parse(at) > OVERDUE_INTERVALS * INGEST_SCHEDULE_MS[key] + LONGEST_RUN_MS;

/** How old the data behind the pages is: the flow windows' shared last day and the newest live block sample. */
type DataHealth = { dataThrough: string | null; flowStale: boolean; liveAt: string | null; liveStale: boolean };

/** Database reachability, per ingest job its last success and whether it is overdue, and the age of the data itself, so
    a job that keeps succeeding without new data still shows as stale. Read per call, not cached. */
export function getHealth(): { database: boolean; jobs: JobHealth[]; data: DataHealth | null } {
  const db = getReader();
  if (!db) return { database: false, jobs: [], data: null };
  /** Walks each job's (job, finished_at) index from its newest run, instead of grouping the whole run log. */
  const lastSuccess = db.prepare("SELECT finished_at FROM ingest_runs WHERE job = ? AND ok = 1 ORDER BY finished_at DESC LIMIT 1");
  const now = Date.now();
  const optional = new Set<string>(OPTIONAL_JOBS);
  const jobs = (Object.keys(JOBS) as Array<keyof typeof JOBS>).map((key): JobHealth => {
    const job = JOBS[key];
    const finished = lastSuccess.get(job)?.finished_at;
    const at = finished == null ? null : String(finished);
    return { job, lastSuccessAt: at, overdue: isOverdue(key, at, now), optional: optional.has(key) };
  });

  /** The core series' shared last day dates staleness; flow windows end there, or before a missing day. */
  const dataThrough = coreLastDay(db);
  const liveAt = latestLiveSampleAt();
  const data: DataHealth = {
    dataThrough,
    flowStale: dataThrough === null || dataThrough < isoDay(now / 1000 - FLOW_STALE_DAYS * DAY_SECONDS),
    liveAt,
    liveStale: liveAt === null || now - Date.parse(liveAt) > LIVE_STALE_MS,
  };
  return { database: true, jobs, data };
}
