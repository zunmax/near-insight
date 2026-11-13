/** Writes snapshot/dashboard.db, a consistent copy of the dashboard's database without third-party news or the run log,
    and snapshot/MANIFEST.json with its SHA-256, size, row counts and data-through day.
    Usage: `node scripts/snapshot.ts [source.db]`, reading DATABASE_PATH by default. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATABASE_PATH, MANIFEST_PATH, SNAPSHOT_EXCLUDED_TABLES, SNAPSHOT_PATH } from "../src/config/database.ts";
import { SCHEMA_VERSION } from "../src/db/schema.ts";
import { coreLastDay } from "../src/db/series.ts";

const source = process.argv[2] ?? DATABASE_PATH;
const temporary = `${SNAPSHOT_PATH}.tmp`;
mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
rmSync(temporary, { force: true });

const reader = new DatabaseSync(source, { readOnly: true });
reader.prepare("VACUUM INTO ?").run(temporary);
reader.close();

const copy = new DatabaseSync(temporary);
if (Number(copy.prepare("PRAGMA user_version").get()?.user_version) !== SCHEMA_VERSION) {
  copy.close();
  rmSync(temporary, { force: true });
  throw new Error(`${source} is not at schema version ${SCHEMA_VERSION}; let the worker create it first`);
}
for (const table of SNAPSHOT_EXCLUDED_TABLES) copy.exec(`DELETE FROM ${table}`);
copy.exec("PRAGMA journal_mode = DELETE; VACUUM;");
const tables = copy
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => String(row.name));
const rows = Object.fromEntries(tables.map((table) => [table, Number(copy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0)]));
const dataThrough = coreLastDay(copy);
copy.close();

renameSync(temporary, SNAPSHOT_PATH);
const bytes = readFileSync(SNAPSHOT_PATH);
const manifest = {
  file: "dashboard.db",
  createdAt: new Date().toISOString(),
  dataThrough,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.length,
  excludedTables: SNAPSHOT_EXCLUDED_TABLES,
  rows,
};
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${SNAPSHOT_PATH} (${(bytes.length / 1e6).toFixed(1)} MB, data through ${dataThrough ?? "—"}) and MANIFEST.json.`);
