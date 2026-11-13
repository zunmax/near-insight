/** Writes THESIS.md from GET /api/thesis on a running dashboard (SITE_URL). `node scripts/thesis.ts` rewrites it from the
    server's database; with `--check` it writes nothing and exits with code 1 when it differs from what the server renders. */
import { readFile, writeFile } from "node:fs/promises";
import { SITE } from "../src/config/site.ts";
import { HTTP_LIMITS } from "../src/config/sources.ts";
import { errorMessage } from "../src/lib/validate.ts";

const THESIS_FILE = new URL("../THESIS.md", import.meta.url);

/** The document as the server renders it. */
async function render(): Promise<string> {
  const url = new URL("/api/thesis", SITE.url);
  const res = await fetch(url, { signal: AbortSignal.timeout(HTTP_LIMITS.timeoutMs) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.text();
}

async function main() {
  const check = process.argv.includes("--check");
  const [thesis, currentThesis] = await Promise.all([render(), readFile(THESIS_FILE, "utf8").catch(() => "")]);

  if (check) {
    if (thesis !== currentThesis) {
      console.error(`THESIS.md is out of date against ${SITE.url}. Run npm run thesis to regenerate it from the live database, or npm run verify -- --write from the snapshot.`);
      process.exitCode = 1;
      return;
    }
    console.log(`THESIS.md matches ${SITE.url}.`);
    return;
  }

  await writeFile(THESIS_FILE, thesis);
  console.log(`Wrote THESIS.md from ${SITE.url}.`);
}

try {
  await main();
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
}
