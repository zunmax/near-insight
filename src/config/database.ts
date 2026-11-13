import { dirname, join, resolve } from "node:path";

/** SQLite file shared by the web server (read-only) and the ingest worker (writer). The ignore marker stops the bundler
    tracing the whole project from this runtime path. */
export const DATABASE_PATH = resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "data/dashboard.db");

/** Folder where the worker keeps its daily copies of the database (dashboard-<UTC day>.db): BACKUP_DIR, else beside the database.
    In Docker it is a volume only the worker mounts, so the website cannot reach the copies. */
export const BACKUP_DIR = process.env.BACKUP_DIR ? resolve(/*turbopackIgnore: true*/ process.env.BACKUP_DIR) : join(dirname(DATABASE_PATH), "backups");

/** Committed copy of the database that `npm run verify` rebuilds THESIS.md from, offline. */
export const SNAPSHOT_PATH = resolve(/*turbopackIgnore: true*/ "snapshot/dashboard.db");

/** The snapshot's SHA-256, size, row counts and data-through day, beside it. */
export const MANIFEST_PATH = join(dirname(SNAPSHOT_PATH), "MANIFEST.json");

/** Tables left out of the snapshot: third-party news, and this machine's run log. */
export const SNAPSHOT_EXCLUDED_TABLES = ["news_items", "ingest_runs"] as const;
