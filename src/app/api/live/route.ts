import { connection } from "next/server";
import { getLiveSnapshot } from "@/data/live";

/** Latest minute-level activity from the database. Rendered per request, never cached. */
export async function GET() {
  await connection();
  return Response.json(getLiveSnapshot(), { headers: { "cache-control": "no-store" } });
}
