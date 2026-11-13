import { connection } from "next/server";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { valuationScenarios } from "@/lib/projection";

/** The Valuation page's scenarios, month by month, as CSV, from the same live inputs the page uses. */
export async function GET() {
  await connection();
  const metrics = await getThesisMetrics();
  const { seed } = metrics;
  if (!seed) return Response.json({ error: "The database does not cover the model's inputs yet" }, { status: 503 });

  /** Objects in the seed (the HSP-029 ramp) are written as JSON rather than "[object Object]". */
  const inputs = Object.entries(seed).map(([key, value]) => `# ${key}=${typeof value === "object" && value !== null ? JSON.stringify(value) : value}`);
  const header = "scenario,monthly_growth,month,issuance_rate,issuance_near,burned_near,bought_near,absorbed_share,total_supply_near";
  const rows = valuationScenarios(seed, metrics).flatMap((scenario) =>
    scenario.rows.map((r) =>
      [scenario.id, scenario.growth, r.month, r.issuanceRate, r.issuanceNear, r.burnedNear, r.boughtNear, r.coverage, r.supplyNear].join(","),
    ),
  );
  return new Response([...inputs, header, ...rows].join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="model-scenarios.csv"',
      "cache-control": "no-store",
    },
  });
}
