/** Queries behind the charts on /dashboard/technology. */
import { LIVE_BLOCKS_WINDOW_MINUTES } from "../../config/ingest.ts";
import { SOURCE_REQUESTS } from "../../content/source-requests.ts";
import type { NamedQuery } from "./named-query.ts";

export const TECHNOLOGY_QUERIES: NamedQuery[] = [
  {
    id: "protocol-releases",
    title: "Protocol upgrades",
    page: "/dashboard/technology",
    sentence: "The protocol and nearcore versions mainnet and testnet run, beside every stored nearcore release, newest first.",
    sql: `SELECT r.tag, r.name, r.published_at, r.prerelease,
  (SELECT protocol_version FROM protocol_versions WHERE network = 'mainnet') AS mainnet_protocol,
  (SELECT node_version FROM protocol_versions WHERE network = 'mainnet') AS mainnet_node,
  (SELECT protocol_version FROM protocol_versions WHERE network = 'testnet') AS testnet_protocol,
  (SELECT node_version FROM protocol_versions WHERE network = 'testnet') AS testnet_node
FROM releases r
ORDER BY r.published_at DESC`,
    requests: [SOURCE_REQUESTS.releases],
  },
  {
    id: "live-activity",
    title: "Live on NEAR mainnet",
    page: "/dashboard/technology",
    sentence: `The samples behind the live panel: block height and chunk gas each minute over the ${LIVE_BLOCKS_WINDOW_MINUTES / 60} hours to the newest sample. Transactions a minute come from the daily transaction counts (chain-activity).`,
    sql: `SELECT at, metric, value
FROM live_samples
WHERE at >= strftime('%Y-%m-%dT%H:%M:%fZ', (SELECT MAX(at) FROM live_samples), '-${LIVE_BLOCKS_WINDOW_MINUTES} minutes')
ORDER BY at DESC, metric`,
    requests: [SOURCE_REQUESTS.block, SOURCE_REQUESTS.nearblocksDaily],
    code: "src/data/live.ts · getLiveSnapshot (block time between samples, transactions a minute from daily counts)",
  },
];
