import "server-only";
import { cacheLife } from "next/cache";
import { getReader } from "@/data/reader";

/** One epoch's start and end (ISO 8601) and the total supply in NEAR at its first and last block, from block headers. */
type EpochSupply = { startTime: string; endTime: string; supplyStartNear: number; supplyEndNear: number };

/** Every stored epoch, oldest first; empty before the epochs job has run. */
export async function getEpochSupply(): Promise<EpochSupply[]> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return [];
  return db
    .prepare("SELECT start_time, end_time, supply_start_near, supply_end_near FROM epoch_supply ORDER BY start_height")
    .all()
    .map((r) => ({
      startTime: String(r.start_time),
      endTime: String(r.end_time),
      supplyStartNear: Number(r.supply_start_near),
      supplyEndNear: Number(r.supply_end_near),
    }));
}
