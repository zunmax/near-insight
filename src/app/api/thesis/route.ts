import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { thesisDocument } from "@/app/api/thesis/markdown/document";
import { getLiveSnapshot } from "@/data/live";
import { getNearAndPeers } from "@/data/market";
import { getNetworkState, getReleases } from "@/data/network";
import { getThesisMetrics } from "@/data/thesis-metrics";

/** Stored nearcore releases read, newest first: more than a year of releases and release candidates. */
const RELEASE_LIMIT = 100;

/** THESIS.md as the database renders it, or null before the database holds a data-through day. Cached as long as the reads
    behind it, so repeated requests share one render instead of each rebuilding the whole document. */
async function renderThesis(): Promise<string | null> {
  "use cache";
  cacheLife("db");
  const [metrics, network, market, releases] = await Promise.all([getThesisMetrics(), getNetworkState(), getNearAndPeers(), getReleases(RELEASE_LIMIT)]);
  if (!metrics.dataThrough) return null;

  /** The document is dated by the newest live sample as of the read behind its numbers (not a later, uncached read), so the
      same database always renders the same text and a cached read never carries a newer date than its numbers. */
  const asOf = metrics.readAt ?? new Date().toISOString();
  return thesisDocument({
    metrics,
    network,
    live: getLiveSnapshot(asOf),
    releases,
    marketAsOf: market?.fetchedAt.slice(0, 10) ?? null,
    snapshot: asOf.slice(0, 10),
  });
}

/** THESIS.md rendered from the database. */
export async function GET() {
  await connection();
  const thesis = await renderThesis();
  if (thesis === null) return Response.json({ error: "No data yet" }, { status: 503 });
  return new Response(thesis, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
  });
}
