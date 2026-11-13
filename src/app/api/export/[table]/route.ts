import { connection } from "next/server";
import { EXPORT_TABLES, type ExportTable } from "@/config/exports";
import { tableCsvStream } from "@/data/exports";

/** One whitelisted table as CSV, streamed from the database as it is downloaded (src/data/exports.ts). */
export async function GET(_request: Request, context: RouteContext<"/api/export/[table]">) {
  await connection();
  const { table } = await context.params;
  const name = table.replace(/\.csv$/, "");
  if (!Object.hasOwn(EXPORT_TABLES, name)) return Response.json({ error: "Unknown table" }, { status: 404 });

  const csv = tableCsvStream(name as ExportTable);
  if (csv === null) return Response.json({ error: "No data yet" }, { status: 503 });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
      "cache-control": "no-store",
    },
  });
}
