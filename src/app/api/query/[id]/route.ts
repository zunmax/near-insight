import { connection } from "next/server";
import { getQueryResult } from "@/data/exports";
import { namedQuery } from "@/db/named-queries";
import { csvLines } from "@/lib/csv";

/** Runs one catalog query (src/db/named-queries/) on the read-only connection; rows as JSON, or CSV with ?format=csv. Only
    catalog statements run: the id selects one, and nothing else from the request reaches SQL. Results are cached under
    the "db" cache profile, so `ranAt` says when the SQL last ran. */
export async function GET(request: Request, context: RouteContext<"/api/query/[id]">) {
  await connection();
  const { id } = await context.params;
  const query = namedQuery(id);
  if (!query) return Response.json({ error: "Unknown query" }, { status: 404 });
  const result = await getQueryResult({ id: query.id, sql: query.sql });
  if (!result) return Response.json({ error: "No data yet" }, { status: 503 });
  const { columns, rows, truncated, ranAt } = result;

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const body = csvLines(columns, rows).join("\n");
    return new Response(`${body}\n`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${query.id}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return Response.json(
    { id: query.id, title: query.title, sql: query.sql, ranAt, rowCount: rows.length, truncated, columns, rows },
    { headers: { "cache-control": "no-store" } },
  );
}
