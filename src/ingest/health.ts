/** Worker health check for the container supervisor (`node src/ingest/health.ts`): exits 0 when an ingest job succeeded
    within WORKER_STALL_MS, 1 otherwise or when the database is missing, so a worker whose every job fails shows as unhealthy. */
import { existsSync } from "node:fs";
import { DATABASE_PATH } from "../config/database.ts";
import { WORKER_STALL_MS } from "../config/ingest.ts";
import { openReader } from "../db/connection.ts";

function check(): string | null {
  if (!existsSync(DATABASE_PATH)) return `no database at ${DATABASE_PATH}`;
  const db = openReader(DATABASE_PATH);
  try {
    /** Runs are logged as they finish, so the newest id is the newest run: a walk back from the end, not a scan. */
    const row = db.prepare("SELECT finished_at FROM ingest_runs WHERE ok = 1 ORDER BY id DESC LIMIT 1").get();
    const at = row?.finished_at == null ? null : Date.parse(String(row.finished_at));
    if (at === null) return "no successful ingest run recorded yet";
    const ageMs = Date.now() - at;
    return ageMs > WORKER_STALL_MS ? `last job succeeded ${Math.round(ageMs / 60_000)} min ago` : null;
  } finally {
    db.close();
  }
}

const problem = check();
if (problem) console.error(`[health] ${problem}`);
process.exitCode = problem ? 1 : 0;
