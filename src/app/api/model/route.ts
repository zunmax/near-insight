import { connection } from "next/server";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { modelInputs, modelScenarios } from "@/lib/projection";
import { proposalFailed } from "@/lib/thesis/proposal-status";

/** The Valuation page's scenarios and the stress scenarios of THESIS.md, month by month, as CSV, from the same live inputs the
    page uses; with `?format=json`, those inputs alone, as `npm run model` reads them from the snapshot. */
export async function GET(request: Request) {
  await connection();
  const metrics = await getThesisMetrics();
  const hsp029Failed = metrics.hsp029 !== null && proposalFailed(metrics.hsp029);
  const inputs = modelInputs(metrics, hsp029Failed);
  if (!inputs) return Response.json({ error: "The database does not cover the model's inputs yet" }, { status: 503 });
  if (new URL(request.url).searchParams.get("format") === "json") return Response.json(inputs, { headers: { "cache-control": "no-store" } });
  const { seed } = inputs;

  /** Objects in the seed (the HSP-029 ramp) are written as JSON rather than "[object Object]". */
  const lines = Object.entries(seed).map(([key, value]) => `# ${key}=${typeof value === "object" && value !== null ? JSON.stringify(value) : value}`);
  const header = "scenario,monthly_growth,growth_months,month,issuance_rate,issuance_near,burned_near,bought_near,absorbed_share,total_supply_near";
  const rows = modelScenarios(inputs).flatMap((scenario) =>
    scenario.rows.map((r) =>
      [scenario.id, scenario.growth, scenario.growthMonths, r.month, r.issuanceRate, r.issuanceNear, r.burnedNear, r.boughtNear, r.coverage, r.supplyNear].join(","),
    ),
  );
  return new Response([...lines, header, ...rows].join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="model-scenarios.csv"',
      "cache-control": "no-store",
    },
  });
}
