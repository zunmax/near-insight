/** Daily copies of the live database, made by the worker: dashboard-<UTC day>.db in BACKUP_DIR, kept BACKUP_RETENTION_DAYS days. */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BACKUP_DIR } from "../config/database.ts";
import { BACKUP_RETENTION_DAYS } from "../config/ingest.ts";
import { DAY_SECONDS, isoDay } from "../lib/metrics.ts";

const BACKUP_FILE = /^dashboard-(\d{4}-\d{2}-\d{2})\.db$/;

/** Writes today's copy unless it exists, so a database lost and started again empty never replaces the copy made before
    the loss. VACUUM INTO takes a consistent copy while the worker keeps writing; the copy is checked before it is kept.
    Deletes copies older than BACKUP_RETENTION_DAYS. Returns the new copy's path, or null when today's was already made. */
export function backupDatabase(db: DatabaseSync): string | null {
  const now = Date.now() / 1000;
  const path = join(BACKUP_DIR, `dashboard-${isoDay(now)}.db`);
  if (existsSync(path)) return null;
  mkdirSync(BACKUP_DIR, { recursive: true });
  const partial = `${path}.partial`;
  rmSync(partial, { force: true });
  try {
    db.prepare("VACUUM INTO ?").run(partial);
    const copy = new DatabaseSync(partial);
    try {
      copy.exec("PRAGMA journal_mode = DELETE");
      const check = String(Object.values(copy.prepare("PRAGMA quick_check").get() ?? {})[0]);
      if (check !== "ok") throw new Error(`the copy failed its integrity check: ${check}`);
    } finally {
      copy.close();
    }
    renameSync(partial, path);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  const expired = isoDay(now - BACKUP_RETENTION_DAYS * DAY_SECONDS);
  for (const name of readdirSync(BACKUP_DIR)) {
    const day = BACKUP_FILE.exec(name)?.[1];
    /** A copy interrupted on an earlier day (a restart during VACUUM INTO) leaves a .partial file that no later run names. */
    if ((day && day <= expired) || name.endsWith(".db.partial")) rmSync(join(BACKUP_DIR, name));
  }
  return path;
}
