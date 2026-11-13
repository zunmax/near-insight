/** A throwaway copy of snapshot/dashboard.db in the system temp folder, so a dashboard started on it can never change the
    committed snapshot or its SHA-256. */
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SNAPSHOT_PATH } from "../src/config/database.ts";

export function copySnapshot(prefix: string): { database: string; remove: () => void } {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  const database = join(folder, "dashboard.db");
  copyFileSync(SNAPSHOT_PATH, database);
  return { database, remove: () => rmSync(folder, { recursive: true, force: true }) };
}
