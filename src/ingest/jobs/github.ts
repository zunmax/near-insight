/** GitHub job: nearcore releases, with the protocol and node versions running on mainnet and testnet. */
import { INGEST_SCHEDULE_MS } from "../../config/ingest.ts";
import { SOURCES } from "../../config/sources.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS } from "../../db/schema.ts";
import { now } from "../days.ts";
import { fetchNearcoreReleases, nearcoreReleaseExists } from "../sources/github.ts";
import { fetchProtocolVersion } from "../sources/near.ts";
import type { Job } from "./job.ts";

export const releasesJob: Job = {
  name: JOBS.releases,
  everyMs: INGEST_SCHEDULE_MS.releases,
  async run(db) {
    const [releases, mainnet, testnet] = await Promise.all([
      fetchNearcoreReleases(),
      fetchProtocolVersion(SOURCES.nearRpc.baseUrl),
      fetchProtocolVersion(SOURCES.nearRpc.testnetUrl),
    ]);
    const fetchedAt = now();
    /** A stored release missing from the response, published within its window, was either deleted upstream or created
        before the oldest one listed; each is asked for by tag, and only one GitHub no longer has is dropped. */
    const oldest = releases.map((r) => r.publishedAt).sort()[0];
    const listed = releases.map((r) => r.tag);
    const unlisted = oldest
      ? db
          .prepare(`SELECT tag FROM releases WHERE published_at >= ? AND tag NOT IN (${listed.map(() => "?").join(",")})`)
          .all(oldest, ...listed)
          .map((row) => String(row.tag))
      : [];
    const deleted: string[] = [];
    for (const tag of unlisted) if (!(await nearcoreReleaseExists(tag))) deleted.push(tag);
    return transaction(db, () => {
      const release = db.prepare(
        `INSERT INTO releases (tag, name, published_at, prerelease, url) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (tag) DO UPDATE SET name = excluded.name, published_at = excluded.published_at, prerelease = excluded.prerelease, url = excluded.url`,
      );
      for (const r of releases) release.run(r.tag, r.name, r.publishedAt, r.prerelease ? 1 : 0, r.url);
      const drop = db.prepare("DELETE FROM releases WHERE tag = ?");
      for (const tag of deleted) drop.run(tag);
      const version = db.prepare(
        `INSERT INTO protocol_versions (network, protocol_version, node_version, fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (network) DO UPDATE SET protocol_version = excluded.protocol_version, node_version = excluded.node_version, fetched_at = excluded.fetched_at`,
      );
      version.run("mainnet", mainnet.protocolVersion, mainnet.nodeVersion, fetchedAt);
      version.run("testnet", testnet.protocolVersion, testnet.nodeVersion, fetchedAt);
      return releases.length + 2;
    });
  },
};
