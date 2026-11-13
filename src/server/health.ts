/** Health check of the web container (`node src/server/health.ts`): exits 0 while the server answers /api/health (200, or 503
    while its checks fail), 1 otherwise. After three failures in a row it stops the server, so Docker's restart policy starts a
    new one; Docker restarts a container that exits, never one that hangs. */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const HEALTH_URL = "http://127.0.0.1:3000/api/health";

/** Under the container's health check timeout, so a hung server counts as a failure instead of timing out the check. */
const TIMEOUT_MS = 8_000;

const FAILURES_BEFORE_RESTART = 3;

/** Failures in a row, kept between checks for the life of one container start (`start`). */
const STATE_PATH = "/tmp/web-health.json";

type State = { start: string; answered: boolean; failures: number };

/** A process's parent and start time (clock ticks since boot) from /proc/<pid>/stat, read after the command name. */
function processStat(pid: string): { parent: string; start: string } | null {
  try {
    const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]!.split(" ");
    return { parent: fields[1]!, start: fields[19]! };
  } catch {
    return null;
  }
}

/** The counts from earlier checks of this container start; a container started again (PID 1 started later) counts afresh. */
function readState(start: string): State {
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as State;
    if (state.start === start) return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[health] state not read: ${String(error)}`);
  }
  return { start, answered: false, failures: 0 };
}

/** Kills the children of the container's init (the server) with SIGKILL, since a hung server cannot run its SIGTERM handler;
    the init then exits with them. */
function stopServer() {
  for (const pid of readdirSync("/proc").filter((entry) => /^\d+$/.test(entry))) {
    if (processStat(pid)?.parent === "1") process.kill(Number(pid), "SIGKILL");
  }
}

const start = processStat("1")?.start ?? "unknown";
const state = readState(start);
const answered = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then(
  (res) => res.status === 200 || res.status === 503,
  () => false,
);
/** Failures count only once the server has answered, so a slow start is never taken for a hang. */
if (answered) Object.assign(state, { answered: true, failures: 0 });
else if (state.answered) state.failures += 1;
writeFileSync(STATE_PATH, JSON.stringify(state));
if (state.failures >= FAILURES_BEFORE_RESTART) {
  console.error(`[health] no answer from the server ${state.failures} times in a row, stopping it so Docker restarts the container`);
  stopServer();
}
process.exitCode = answered ? 0 : 1;
