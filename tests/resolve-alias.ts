/** Resolves the `@/` import alias (tsconfig `paths`) to src/ for `node --test`, adding the `.ts` extension Node needs, so the
    tests can load modules written for Next.js. Loaded with `--import` before the test files (package.json `test`). */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const base = new URL(specifier.slice(2), SRC);
    const file = [`${base.href}.ts`, `${base.href}/index.ts`].find((candidate) => existsSync(fileURLToPath(candidate)));
    return nextResolve(file ?? base.href, context);
  },
});
