import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { errorMessage } from "../lib/validate.ts";
import { MIGRATIONS } from "./schema.ts";

/** Runs `write` in one transaction: committed when it returns, rolled back when it throws. */
export function transaction<T>(db: DatabaseSync, write: () => T): T {
  db.exec("BEGIN");
  try {
    const result = write();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    /** SQLite has already rolled back after some errors (a full disk), and a second ROLLBACK would hide the real error. */
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

/** Applies migrations newer than the database's user_version, each in its own transaction. */
function migrate(db: DatabaseSync) {
  const row = db.prepare("PRAGMA user_version").get();
  const current = Number(row?.user_version ?? 0);
  /** A schema from newer code (e.g. after a rollback) would take writes this code does not know, so it is refused. */
  if (current > MIGRATIONS.length) throw new Error(`The database is at schema version ${current}, newer than this code's ${MIGRATIONS.length}; run the newer code or restore a backup`);
  MIGRATIONS.slice(current).forEach((sql, i) => {
    const version = current + i + 1;
    try {
      transaction(db, () => {
        db.exec(sql);
        db.exec(`PRAGMA user_version = ${version}`);
      });
    } catch (error) {
      throw new Error(`Migration ${version} failed: ${errorMessage(error)}`);
    }
  });
}

/** Opens the writer connection, creating the file and applying migrations. */
export function openWriter(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

/** Opens a read-only connection; WAL lets it read while the worker writes. */
export function openReader(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { readOnly: true });
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}
