/** Offline check of the committed results: confirms snapshot/dashboard.db matches its SHA-256 in MANIFEST.json, starts the dashboard
    on a copy and runs `scripts/thesis.ts --check` against it, so THESIS.md is rebuilt from the snapshot alone, with no upstream
    call; exit code 1 on any mismatch. `--write` rewrites it from the snapshot (after `npm run snapshot`). */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
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

async function main(): Promise<void> {
  checkHash();
  const siteUrl = `http://localhost:${PORT}`;
  /** Another server on the port would answer in place of the new one, from data that is not this snapshot. */
  if (await portAnswers(siteUrl)) throw new Error(`port ${PORT} is already in use; stop the process on it and run again`);
  const snapshot = copySnapshot("near-insights-verify-");
  const env = { ...process.env, DATABASE_PATH: snapshot.database, SITE_URL: siteUrl, NEXT_DIST_DIR: DIST_DIR };
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
    process.exitCode = thesis.status ?? 1;
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
