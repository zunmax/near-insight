/** Runs the projection model offline from snapshot/model-inputs.json (written by `npm run verify -- --write`): every scenario, or with
    any of `--price <USD> --bought <monthly growth> --fees <monthly growth> --cap <max issuance> --burn <share>` the Valuation page
    model's numbers for those inputs. */
import { existsSync, readFileSync } from "node:fs";
import { parseArgs, styleText } from "node:util";
import { MODEL_INPUTS_PATH } from "../src/config/database.ts";
import { COVERAGE_HORIZON_MONTHS as MONTHS } from "../src/config/projections.ts";
import { formatChange, formatChangeFromZero, formatGrowthRange, formatMultiple, formatPercent, formatPercentFromFull, formatUsd } from "../src/lib/format.ts";
import { growthTerms, modelInput, modelOutcome, modelScenarios, project, scenarioOutcome, type ModelInputs } from "../src/lib/projection.ts";
import { errorMessage } from "../src/lib/validate.ts";

const OPTIONS = {
  price: { type: "string" },
  bought: { type: "string" },
  fees: { type: "string" },
  cap: { type: "string" },
  burn: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

const USAGE = `Usage: npm run model [-- --price <USD> --bought <monthly growth> --fees <monthly growth> --cap <max issuance> --burn <share>]
  With no option: every scenario, the growth needed and the break-even volume.
  --price   NEAR price in USD, above 0 (default: the snapshot's)
  --bought  monthly growth of NEAR bought, above -1, e.g. 0.05 (default: 0)
  --fees    monthly growth of gas fees, above -1, e.g. 0.02 (default: 0)
  --cap     max issuance at the end of HSP-029's ramp, from 0 to under 1, e.g. 0.016 (default: today's, no ramp)
  --burn    share of gas fees burned, from 0 to 1 (default: the snapshot's)`;

type Values = Partial<Record<Exclude<keyof typeof OPTIONS, "help">, string>>;

/** A number option, checked against its range; undefined when not given. */
function option(values: Values, name: keyof Values, valid: (value: number) => boolean, range: string): number | undefined {
  const text = values[name];
  if (text === undefined) return undefined;
  const value = Number(text);
  if (!Number.isFinite(value) || !valid(value)) throw new Error(`--${name} must be ${range} (got ${text})`);
  return value;
}

/** "Month 11", or "Not reached" within the horizon. */
const reached = (month: number | null) => (month === null ? "Not reached" : `Month ${month}`);

function scenarios(inputs: ModelInputs): void {
  const rows = modelScenarios(inputs).map((scenario) => {
    /** Without the 30 days' volume there is no run rate to compare with (scenarioOutcome then gives no multiple). */
    const outcome = scenarioOutcome(scenario, inputs.seed, inputs.volume30dUsd ?? 0);
    const volume =
      outcome.volumePerYearUsd === null
        ? "—"
        : `${formatUsd(outcome.volumePerYearUsd)}${outcome.timesRunRate === null ? "" : ` (${formatMultiple(outcome.timesRunRate, 1)} the 30-day run rate)`}`;
    return [scenario.name, reached(outcome.reachedMonth), formatPercentFromFull(outcome.finalCoverage, 0), volume];
  });
  const header = ["Scenario", "Reaches 100%", `Absorbed in month ${MONTHS}`, `Intents volume a year, month ${MONTHS}`];
  const widths = header.map((title, i) => Math.max(title.length, ...rows.map((row) => row[i]!.length)));
  const line = (cells: string[]) => `  ${cells.map((cell, i) => cell.padEnd(widths[i]!)).join("   ")}`;
  console.log(styleText("bold", line(header)));
  for (const row of rows) console.log(line(row));

  const needed = inputs.valuation?.requiredMonthlyGrowth ?? null;
  const growth = inputs.buybacks?.monthlyGrowth ?? null;
  const range = inputs.buybacks?.monthlyGrowthRange ?? null;
  const breakEven = inputs.breakEven30d;
  console.log();
  if (needed !== null)
    console.log(
      needed > 0
        ? `Growth needed: NEAR bought must grow ${formatPercent(needed, 1)} a month (${formatChangeFromZero(growthTerms(needed, 12).perYear)} a year) for burn + buybacks to match issuance in month ${MONTHS}.`
        : `Growth needed: none; burn + buybacks already match issuance in month ${MONTHS}.`,
    );
  if (growth !== null) console.log(`Measured: NEAR bought's monthly growth over the 90 days to ${inputs.seed.through}, against the 90 before: ${formatChange(growth)}${range ? ` (95% range ${formatGrowthRange(range, 1)})` : ""}.`);
  if (breakEven?.volumePerDayUsd != null) console.log(`Break-even today: NEAR Intents volume of ${formatUsd(breakEven.volumePerDayUsd)} a day would make burn + buybacks match the NEAR minted (30-day average ${formatUsd(breakEven.currentVolumePerDayUsd)}).`);
  console.log(styleText("dim", "\nYour own inputs: npm run model -- --price <USD> --bought <monthly growth> --fees <monthly growth> --cap <max issuance> --burn <share> (--help for each)"));
}

function custom(inputs: ModelInputs, price: number, bought: number, fees: number, cap: number | null, burn: number): void {
  const { seed } = inputs;
  const rows = project(modelInput(seed, MONTHS, { priceMultiple: price / seed.priceUsd, buybackGrowth: bought, feeGrowth: fees, targetInflationRate: cap, burnShareOfFees: burn }));
  const outcome = modelOutcome(rows, seed);
  console.log(
    `Your inputs: NEAR at ${formatUsd(price)}, NEAR bought ${formatChange(bought)} a month, gas fees ${formatChange(fees)} a month, max issuance ${
      cap === null ? `${formatPercent(seed.maxInflationRate, 1)} (today's)` : `to ${formatPercent(cap, 1)} over HSP-029's ramp`
    }, ${formatPercent(burn, 0)} of gas fees burned`,
  );
  console.log(
    `  Absorbed in month 1: ${formatPercentFromFull(outcome.firstCoverage, 0)} · in month ${MONTHS}: ${formatPercentFromFull(outcome.lastCoverage, 0)} · reaches 100%: ${reached(outcome.reachedMonth).toLowerCase()} · total supply growth: ${formatChange(outcome.supplyGrowthPerYear, 2)} a year`,
  );
}

function main(): void {
  const { values } = parseArgs({ options: OPTIONS });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (!existsSync(MODEL_INPUTS_PATH)) throw new Error("No snapshot/model-inputs.json. Run npm run verify -- --write to write it from the snapshot.");
  const inputs = JSON.parse(readFileSync(MODEL_INPUTS_PATH, "utf8")) as ModelInputs;
  const { seed } = inputs;
  const price = option(values, "price", (v) => v > 0, "a price in USD above 0");
  const bought = option(values, "bought", (v) => v > -1, "a monthly growth above -1, e.g. 0.05");
  const fees = option(values, "fees", (v) => v > -1, "a monthly growth above -1, e.g. 0.02");
  const cap = option(values, "cap", (v) => v >= 0 && v < 1, "a yearly rate from 0 to under 1, e.g. 0.016");
  const burn = option(values, "burn", (v) => v >= 0 && v <= 1, "a share from 0 to 1");
  console.log(
    `${styleText("bold", `NEAR burned + bought against issuance, month by month for ${MONTHS} months`)}\nFrom the 30 days to ${seed.through}: NEAR at ${formatUsd(seed.priceUsd)}, max issuance ${formatPercent(seed.maxInflationRate, 1)} a year (snapshot/model-inputs.json)\n`,
  );
  if ([price, bought, fees, cap, burn].every((value) => value === undefined)) scenarios(inputs);
  else custom(inputs, price ?? seed.priceUsd, bought ?? 0, fees ?? 0, cap ?? null, burn ?? seed.burnShareOfFees);
}

try {
  main();
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
}
