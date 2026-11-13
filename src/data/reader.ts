import "server-only";
import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { DATABASE_PATH } from "@/config/database";
import { openReader } from "@/db/connection";
import { SCHEMA_VERSION } from "@/db/schema";

let reader: DatabaseSync | null = null;

/** Shared read-only connection, or null until the ingest worker has created the database and its whole schema. A file that
    is not a readable SQLite database also counts as none, so every page and route shows its empty state, not an error. */
export function getReader(): DatabaseSync | null {
  if (reader) return reader;
  if (!existsSync(DATABASE_PATH)) return null;
  let db: DatabaseSync | null = null;
  try {
    db = openReader(DATABASE_PATH);
    if (Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0) < SCHEMA_VERSION) {
      db.close();
      return null;
    }
  } catch {
    db?.close();
    return null;
  }
  reader = db;
  return reader;
}
