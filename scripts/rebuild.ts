/** One command from the public APIs to the committed results: runs every ingest job until its history is stored, writes snapshot/,
    and regenerates THESIS.md, THESIS.pdf and snapshot/model-inputs.json from that snapshot, after which `npm run verify` passes. A failed
    ingest job is reported and the rest continues with what was stored; the exit code is then 1. */
import { spawnSync } from "node:child_process";

const steps: Array<{ name: string; args: string[] }> = [
  { name: "Ingest every source once", args: ["src/ingest/run.ts", "--once"] },
  { name: "Write the snapshot", args: ["scripts/snapshot.ts"] },
  { name: "Regenerate THESIS.md, THESIS.pdf and the model inputs from the snapshot", args: ["scripts/verify.ts", "--write"] },
];

let failed = false;
for (const [i, step] of steps.entries()) {
  console.log(`\n[rebuild ${i + 1}/${steps.length}] ${step.name}`);
  const { status } = spawnSync(process.execPath, step.args, { stdio: "inherit" });
  if (status === 0) continue;
  failed = true;
  if (i === 0) {
    console.error("[rebuild] the ingest step did not finish cleanly (see above); continuing with the data that was stored");
    continue;
  }
  console.error(`[rebuild] ${step.name} failed`);
  break;
}
process.exitCode = failed ? 1 : 0;
