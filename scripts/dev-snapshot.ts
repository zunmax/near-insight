/** Starts the dashboard on a copy of the committed snapshot (snapshot/dashboard.db), port 3000 or the first argument: the offline
    way to look around the data behind THESIS.md, with no worker, API keys or network for data, the same in bash, PowerShell
    and cmd. Stop it with Ctrl+C; the copy is deleted when the server exits. */
import { spawn } from "node:child_process";
import { copySnapshot } from "./snapshot-copy.ts";

const port = process.argv[2] ?? "3000";
const snapshot = copySnapshot("near-insights-dev-");
console.log(`Serving a copy of snapshot/dashboard.db at http://localhost:${port}/dashboard/home (Ctrl+C to stop).`);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], {
  env: { ...process.env, DATABASE_PATH: snapshot.database, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});
server.on("exit", (code) => {
  snapshot.remove();
  process.exit(code ?? 0);
});
/** A failed start (no node_modules) still deletes the copy. */
server.on("error", (error) => {
  console.error(error.message);
  snapshot.remove();
  process.exit(1);
});
/** Ctrl+C, an IDE's stop button or `kill` stops the server too, so it never keeps the port or the copy after this exits. */
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => server.kill(signal));
