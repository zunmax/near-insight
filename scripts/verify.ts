/** Offline check: confirms snapshot/dashboard.db matches its SHA-256, starts the dashboard on a copy with no upstream call, checks THESIS.md
    and snapshot/model-inputs.json against it (exit code 1 on any mismatch) and prints the verdict, breaking points and data checks.
    `--write` rewrites THESIS.md, THESIS.pdf and the model inputs from the snapshot instead (after `npm run snapshot`). */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";
import { styleText } from "node:util";
import { MODEL_INPUTS_PATH } from "../src/config/database.ts";
import { readSnapshot } from "../src/db/snapshot.ts";
import { errorMessage } from "../src/lib/validate.ts";
import { copySnapshot } from "./snapshot-copy.ts";

/** Port and build folder of the temporary dashboard, apart from the usual dev server's 3000 and .next. */
const PORT = 3123;
const DIST_DIR = ".next-verify";
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 2_000;

function checkHash(): void {
  const snapshot = readSnapshot();
  if (!snapshot) throw new Error("snapshot/dashboard.db or snapshot/MANIFEST.json is missing");
  const { manifest, sha256 } = snapshot;
  if (sha256 !== manifest.sha256) throw new Error(`snapshot/dashboard.db does not match MANIFEST.json (sha256 ${sha256.slice(0, 12)}…, expected ${manifest.sha256.slice(0, 12)}…)`);
  console.log(`Snapshot hash matches MANIFEST.json (data through ${manifest.dataThrough ?? "—"}).`);
}

/** Stops the server and the processes it started. */
function stop(server: ChildProcess): void {
  if (server.pid === undefined || server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-server.pid, "SIGTERM");
}

async function waitUntilReady(url: string, server: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`the dashboard exited with code ${server.exitCode} before it was ready`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(POLL_MS * 10) });
      if (res.ok) return;
    } catch {
      /** Not listening yet. */
    }
    await wait(POLL_MS);
  }
  throw new Error(`the dashboard did not answer ${url} within ${READY_TIMEOUT_MS / 1000} s`);
}

/** True when something already answers on PORT, e.g. a server an interrupted run left behind. */
async function portAnswers(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return true;
  } catch {
    return false;
  }
}

/** A JSON reply of the snapshot's dashboard. */
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(READY_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** snapshot/model-inputs.json against the inputs the dashboard computes from the snapshot: rewritten with `write`, otherwise
    compared; false when it differs. */
async function modelInputsMatch(siteUrl: string, write: boolean): Promise<boolean> {
  const inputs = `${JSON.stringify(await getJson(`${siteUrl}/api/model?format=json`), null, 2)}\n`;
  if (write) {
    writeFileSync(MODEL_INPUTS_PATH, inputs);
    console.log("Wrote snapshot/model-inputs.json from the snapshot.");
    return true;
  }
  if ((existsSync(MODEL_INPUTS_PATH) ? readFileSync(MODEL_INPUTS_PATH, "utf8") : "") !== inputs) {
    console.error("snapshot/model-inputs.json is out of date against the snapshot. Run npm run verify -- --write.");
    return false;
  }
  console.log("snapshot/model-inputs.json matches the snapshot.");
  return true;
}

type Summary = {
  dataThrough: string;
  verdict: { summary: string; points: string[] } | null;
  breakingPoints: Array<{ name: string; status: string; detail: string }>;
  dataChecks: Array<{ title: string; a: string | null; b: string | null; difference: string | null; window: string | null }>;
};

/** Prints the verdict, each breaking point with its status, and each data check, as the snapshot's dashboard shows them. */
async function printSummary(siteUrl: string): Promise<void> {
  const summary = (await getJson(`${siteUrl}/api/thesis?format=json`)) as Summary;
  const width = Math.max(...summary.breakingPoints.map((point) => point.status.length));
  console.log(`\n${styleText("bold", `Verdict, data through ${summary.dataThrough}`)}\n  ${summary.verdict?.summary ?? "The snapshot does not cover the numbers the verdict needs."}`);
  for (const point of summary.verdict?.points ?? []) console.log(`  - ${point}`);
  console.log(`\n${styleText("bold", "Breaking points")}`);
  for (const point of summary.breakingPoints) console.log(`  ${point.status.padEnd(width)}  ${point.name}: ${point.detail}`);
  console.log(`\n${styleText("bold", "Data checks (A against B)")}`);
  for (const check of summary.dataChecks) {
    console.log(`  ${check.title}: ${check.a === null ? "not measured yet" : `${check.a} against ${check.b}, difference ${check.difference ?? "—"} (${check.window})`}`);
  }
}

async function main(): Promise<void> {
  checkHash();
  const siteUrl = `http://localhost:${PORT}`;
  /** Another server on the port would answer in place of the new one, from data that is not this snapshot. */
  if (await portAnswers(siteUrl)) throw new Error(`port ${PORT} is already in use; stop the process on it and run again`);
  const snapshot = copySnapshot("near-insights-verify-");
  const env = { ...process.env, DATABASE_PATH: snapshot.database, SITE_URL: siteUrl, NEXT_DIST_DIR: DIST_DIR, NEXT_TELEMETRY_DISABLED: "1" };
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
    env,
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
  /** Ctrl+C or a stop signal still stops the server and deletes the copy, as the finally block below does. */
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stop(server);
      snapshot.remove();
      process.exit(130);
    });
  }
  try {
    console.log(`Starting the dashboard on ${siteUrl} with a copy of the snapshot…`);
    await waitUntilReady(`${siteUrl}/api/thesis`, server);
    const write = process.argv.includes("--write");
    const thesis = spawnSync(process.execPath, ["scripts/thesis.ts", ...(write ? [] : ["--check"])], { env, stdio: "inherit" });
    const inputsMatch = await modelInputsMatch(siteUrl, write);
    await printSummary(siteUrl);
    process.exitCode = thesis.status === 0 && inputsMatch ? 0 : 1;
  } finally {
    stop(server);
    snapshot.remove();
  }
}

try {
  await main();
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
}
