import "server-only";
import { cacheLife } from "next/cache";
import { DATABASE_PATH } from "@/config/database";
import type { ExportTable } from "@/config/exports";
import { getReader } from "@/data/reader";
import { openReader } from "@/db/connection";
import type { NamedQuery } from "@/db/named-queries/named-query";
import { csvLines } from "@/lib/csv";

/** Most rows one query result returns; time-series queries are ordered newest first, so the cut drops their oldest days. */
const MAX_QUERY_ROWS = 5_000;

/** A catalog query's result and when it ran (ISO time). */
type QueryResult = { columns: string[]; rows: Array<Record<string, unknown>>; truncated: boolean; ranAt: string };

/** A catalog query's rows on the read-only connection, run at most once per cache period, so a stream of requests for a
    slow query does not hold up the server. Null until the database exists. */
export async function getQueryResult(query: Pick<NamedQuery, "id" | "sql">): Promise<QueryResult | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;
  const statement = db.prepare(query.sql);
  const rows: Array<Record<string, unknown>> = [];
  let truncated = false;
  for (const row of statement.iterate()) {
    if (rows.length === MAX_QUERY_ROWS) {
      truncated = true;
      break;
    }
    rows.push({ ...row });
  }
  return { columns: statement.columns().map((column) => column.name), rows, truncated, ranAt: new Date().toISOString() };
}

/** Rows per chunk of a table export; the server answers other requests between chunks. */
const EXPORT_CHUNK_ROWS = 2_000;

/** A whitelisted table as CSV, built chunk by chunk as the download reads it rather than held whole in memory. It reads on its
    own connection, so the snapshot a long download holds never holds back the pages' shared one. Null until the database exists. */
export function tableCsvStream(table: ExportTable): ReadableStream<Uint8Array> | null {
  if (!getReader()) return null;
  const db = openReader(DATABASE_PATH);
  const statement = db.prepare(`SELECT * FROM ${table}`);
  const columns = statement.columns().map((column) => column.name);
  const rows = statement.iterate();
  const encoder = new TextEncoder();
  let header = true;
  return new ReadableStream({
    pull(controller) {
      try {
        const chunk: Array<Record<string, unknown>> = [];
        while (chunk.length < EXPORT_CHUNK_ROWS) {
          const next = rows.next();
          if (next.done) break;
          chunk.push(next.value);
        }
        const lines = csvLines(columns, chunk).slice(header ? 0 : 1);
        header = false;
        if (lines.length > 0) controller.enqueue(encoder.encode(`${lines.join("\n")}\n`));
        if (chunk.length < EXPORT_CHUNK_ROWS) {
          db.close();
          controller.close();
        }
      } catch (error) {
        db.close();
        controller.error(error);
      }
    },
    cancel() {
      db.close();
    },
  });
}
