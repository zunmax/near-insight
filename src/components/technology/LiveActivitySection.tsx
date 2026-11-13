import { connection } from "next/server";
import { LiveActivity } from "@/components/technology/LiveActivity";
import { SourceInfo } from "@/components/ui/SourceInfo";
import { LIVE_STALE_MS } from "@/config/ingest";
import { getLiveSnapshot, latestLiveSampleAt } from "@/data/live";
import { namedQuery } from "@/db/named-queries";

const LIVE_QUERY = namedQuery("live-activity")!;

/** Server entry for the live panel: reads the latest samples per request, then the client keeps polling. */
export async function LiveActivitySection() {
  await connection();
  return (
    <LiveActivity
      initial={getLiveSnapshot()}
      lastSampleAt={latestLiveSampleAt()}
      checkedAt={new Date().toISOString()}
      staleAfterMs={LIVE_STALE_MS}
      query={{ id: LIVE_QUERY.id, sentence: LIVE_QUERY.sentence, sql: LIVE_QUERY.sql }}
      info={<SourceInfo sources={["nearRpc", "nearblocks"]} />}
    />
  );
}
