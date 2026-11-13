import { connection } from "next/server";
import { getLandingFigures } from "@/data/landing";

/** The landing page's live figures, so an open landing tab picks up new data without a reload. Never stored by the browser. */
export async function GET() {
  await connection();
  return Response.json(await getLandingFigures(), { headers: { "cache-control": "no-store" } });
}
