import "server-only";
import { cacheLife } from "next/cache";
import { getReader } from "@/data/reader";
import type { Release } from "@/db/schema";

export type NetworkState = {
  protocolVersion: number;
  nodeVersion: string;
  totalSupplyNear: number;
  /** Gas price in yoctoNEAR per gas unit. */
  gasPriceYocto: number;
  shardCount: number;
  maxInflationRate: number;
  burntGasShareToContracts: number;
  minimumStakeRatio: number;
  fetchedAt: string;
};

type Validator = { accountId: string; stakeNear: number; producesBlocks: boolean };

/** Latest stored network state, or null before the first ingest. */
export async function getNetworkState(): Promise<NetworkState | null> {
  "use cache";
  cacheLife("db");
  const r = getReader()?.prepare("SELECT * FROM network_latest WHERE id = 1").get();
  if (!r) return null;
  return {
    protocolVersion: Number(r.protocol_version),
    nodeVersion: String(r.node_version),
    totalSupplyNear: Number(r.total_supply_near),
    gasPriceYocto: Number(r.gas_price_yocto),
    shardCount: Number(r.shard_count),
    maxInflationRate: Number(r.max_inflation_rate),
    burntGasShareToContracts: Number(r.burnt_gas_share_to_contracts),
    minimumStakeRatio: Number(r.minimum_stake_ratio),
    fetchedAt: String(r.fetched_at),
  };
}

/** `fetchedAt` is when the older of the two readings was taken (ISO 8601). */
type ProtocolVersions = { mainnet: number; mainnetNode: string; testnet: number; testnetNode: string; fetchedAt: string };

/** Protocol version running on mainnet and testnet, or null before the first ingest. */
export async function getProtocolVersions(): Promise<ProtocolVersions | null> {
  "use cache";
  cacheLife("db");
  const rows = getReader()?.prepare("SELECT * FROM protocol_versions").all() ?? [];
  const mainnet = rows.find((r) => r.network === "mainnet");
  const testnet = rows.find((r) => r.network === "testnet");
  if (!mainnet || !testnet) return null;
  return {
    mainnet: Number(mainnet.protocol_version),
    mainnetNode: String(mainnet.node_version),
    testnet: Number(testnet.protocol_version),
    testnetNode: String(testnet.node_version),
    fetchedAt: [String(mainnet.fetched_at), String(testnet.fetched_at)].sort()[0]!,
  };
}

/** Most recent nearcore releases, newest first. */
export async function getReleases(limit: number): Promise<Release[]> {
  "use cache";
  cacheLife("db");
  return (getReader()?.prepare("SELECT * FROM releases ORDER BY published_at DESC LIMIT ?").all(limit) ?? []).map((r) => ({
    tag: String(r.tag),
    name: String(r.name),
    publishedAt: String(r.published_at),
    prerelease: Number(r.prerelease) === 1,
    url: String(r.url),
  }));
}

/** Validators of the latest stored epoch, largest stake first, or null before the first ingest. */
export async function getLatestValidators(): Promise<{ epochHeight: number; validators: Validator[] } | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  const latest = db?.prepare("SELECT MAX(epoch_height) AS epoch FROM validator_epochs").get();
  if (!db || latest?.epoch === null || latest?.epoch === undefined) return null;
  const epochHeight = Number(latest.epoch);
  const validators = db
    .prepare("SELECT account_id, stake_near, produces_blocks FROM validator_epochs WHERE epoch_height = ? ORDER BY stake_near DESC")
    .all(epochHeight)
    .map((r) => ({ accountId: String(r.account_id), stakeNear: Number(r.stake_near), producesBlocks: Number(r.produces_blocks) === 1 }));
  return { epochHeight, validators };
}
