import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { thesisDocument } from "@/app/api/thesis/markdown/document";
import { checkDifference, checkWindow, DATA_CHECKS } from "@/content/data-checks";
import { getLiveSnapshot } from "@/data/live";
import { getNearAndPeers } from "@/data/market";
import { getNetworkState, getReleases } from "@/data/network";
import { getThesisMetrics, type ThesisMetrics } from "@/data/thesis-metrics";
import { breakingPoints } from "@/lib/thesis/breaking-points";
import { thesisVerdict } from "@/lib/thesis/verdict";

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

/** The verdict, every breaking point's status and the data checks as plain text, as `npm run verify` prints them. */
function summary(metrics: ThesisMetrics) {
  const verdict = thesisVerdict(metrics);
  const plain = (text: string) => text.replaceAll("**", "");
  return {
    dataThrough: metrics.dataThrough,
    verdict: verdict ? { summary: plain(verdict.summary), points: verdict.points.map(plain) } : null,
    breakingPoints: breakingPoints(metrics).map(({ name, status, detail }) => ({ name, status, detail })),
    dataChecks: DATA_CHECKS.map(({ key, title, format }) => {
      const check = metrics.dataChecks[key];
      return {
        title,
        a: check ? format(check.a) : null,
        b: check ? format(check.b) : null,
        difference: check?.difference == null ? null : checkDifference(check.difference),
        window: check ? `${checkWindow(check.days)}, as of ${check.through}` : null,
      };
    }),
  };
}

/** THESIS.md rendered from the database; with `?format=json`, its verdict, breaking points and data checks alone. */
export async function GET(request: Request) {
  await connection();
  if (new URL(request.url).searchParams.get("format") === "json") {
    const metrics = await getThesisMetrics();
    if (!metrics.dataThrough) return Response.json({ error: "No data yet" }, { status: 503 });
    return Response.json(summary(metrics), { headers: { "cache-control": "no-store" } });
  }
  const thesis = await renderThesis();
  if (thesis === null) return Response.json({ error: "No data yet" }, { status: 503 });
  return new Response(thesis, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
  });
}
