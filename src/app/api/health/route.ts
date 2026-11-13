import { connection } from "next/server";
import { getHealth } from "@/data/health";

/** For uptime monitors: 200 when the database is readable, no core ingest job is overdue and the flow and live data are
    fresh; 503 otherwise. Optional jobs (news, developers, releases, Dune) are reported but never fail it. Never cached. */
export async function GET() {
  await connection();
  const health = getHealth();
  const overdue = health.jobs.filter((job) => job.overdue && !job.optional).map((job) => job.job);
  const optionalOverdue = health.jobs.filter((job) => job.overdue && job.optional).map((job) => job.job);
  const ok = health.database && overdue.length === 0 && health.data !== null && !health.data.flowStale && !health.data.liveStale;
  return Response.json(
    { ok, database: health.database, overdue, optionalOverdue, data: health.data, jobs: health.jobs },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
