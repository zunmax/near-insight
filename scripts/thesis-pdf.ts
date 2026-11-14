/** Prints THESIS.md as THESIS.pdf, a dark paper with a cover (scripts/thesis-pdf.css), with a local Chrome or Edge. The page is one HTML
    file with its fonts embedded, and its content policy blocks scripts and every request, so the PDF needs no network and looks
    the same on every machine; CHROME_PATH names the browser when it is not installed in a usual place. */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";

const PDF_FILE = new URL("../THESIS.pdf", import.meta.url);
const STYLE_FILE = new URL("./thesis-pdf.css", import.meta.url);
const FONT_PACKAGES = new URL("../node_modules/@fontsource-variable/", import.meta.url);

/** The embedded fonts: each package's stylesheet and the Latin faces taken from it, named by the comment before each rule. */
const FONTS = [
  { family: "plus-jakarta-sans", css: "wght.css", faces: ["plus-jakarta-sans-latin-wght-normal", "plus-jakarta-sans-latin-ext-wght-normal"] },
  { family: "jetbrains-mono", css: "wght.css", faces: ["jetbrains-mono-latin-wght-normal", "jetbrains-mono-latin-ext-wght-normal"] },
];

/** Longest the browser may take to print, and the time it gives the page to load its fonts and lay out first. */
const PRINT_TIMEOUT_MS = 120_000;
const LAYOUT_BUDGET_MS = 10_000;

/** The class of a section's labelled paragraph, by its bold label. */
const LABEL_CLASS: Record<string, string> = { "Bull case": "bull", "Bear case": "bear", "Breaking point": "breaking", "Re-run": "rerun" };

/** The class of each breaking-point status, as the summary table prints it. */
const STATUS_CLASS: Record<string, string> = { Holding: "", Broken: "broken", "Too close to call": "close", "Not measured yet": "unmeasured" };

/** The dashboard's dark-theme section colors, in the order the thesis sections appear (demand, capture, supply, valuation,
    technology, network, peers); each section's number, rules and badge take its color. */
const SECTION_TONES = ["#1d9bf0", "#1ed39b", "#8f75ff", "#d97706", "#0d9488", "#f91880", "#ea580c"];

/** The dashboard's logo mark in its dark-theme colors. */
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="#000" stroke="#e7e9ea" stroke-width="2.4"/><path d="M10 22V10M22 22V10" fill="none" stroke="#e7e9ea" stroke-width="3" stroke-linecap="round"/><path d="M10 10l12 12" stroke="#1ed39b" stroke-width="3" stroke-linecap="round"/></svg>`;

/** Running heads and the page number on every page after the cover, which fills its page edge to edge. */
const PAGE_RULES = `@page { size: A4; margin: 20mm 0 17mm; background: #000;
  @top-left { content: "NEAR Insights"; margin-left: 22mm; font: 400 7.5pt "JetBrains Mono Variable", monospace; color: #868b91; }
  @top-right { content: "NEAR Long-Term Investment Thesis"; margin-right: 22mm; font: 400 7.5pt "JetBrains Mono Variable", monospace; color: #868b91; }
  @bottom-center { content: counter(page); font: 500 8pt "Plus Jakarta Sans Variable", sans-serif; color: #9aa0a6; }
}
@page :first { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }`;

/** The first browser found: CHROME_PATH, then Chrome, Edge and Chromium where each platform installs them. */
function findBrowser(): string {
  const env = process.env;
  const candidates =
    process.platform === "win32"
      ? [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA]
          .filter((dir): dir is string => Boolean(dir))
          .flatMap((dir) => [join(dir, "Google", "Chrome", "Application", "chrome.exe"), join(dir, "Microsoft", "Edge", "Application", "msedge.exe")])
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium"]
        : (env.PATH ?? "").split(delimiter).flatMap((dir) => ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"].map((name) => join(dir, name)));
  const found = [env.CHROME_PATH, ...candidates].find((path): path is string => typeof path === "string" && path !== "" && existsSync(path));
  if (!found) throw new Error("THESIS.pdf needs Chrome, Edge or Chromium; install one or set CHROME_PATH to its executable.");
  return found;
}

/** The @font-face rules of FONTS from each package's own stylesheet, each font file embedded as a data URL. */
function fontFaces(): string {
  return FONTS.flatMap(({ family, css: sheet, faces }) => {
    const dir = new URL(`${family}/`, FONT_PACKAGES);
    const css = readFileSync(new URL(sheet, dir), "utf8");
    return faces.map((name) => {
      const at = css.indexOf(`/* ${name} */`);
      const start = at < 0 ? -1 : css.indexOf("{", at);
      const end = start < 0 ? -1 : css.indexOf("}", start);
      if (end < 0) throw new Error(`@fontsource-variable/${family}/${sheet} has no ${name} face`);
      const rule = css.slice(start, end + 1);
      return `@font-face ${rule.replace(/url\(\.\/(files\/[^)]+)\)/, (_, file: string) => `url(data:font/woff2;base64,${readFileSync(new URL(file, dir)).toString("base64")})`)}`;
    });
  }).join("\n");
}

/** A breaking-point status as an outlined badge. */
const statusBadge = (status: string) => `<span class="status ${STATUS_CLASS[status]}">${status}</span>`;

/** The cover: the logo mark, the title block, and the key-figures table under the title set as figure tiles. */
function cover(front: string): string {
  const figures = front.replace(/<table>([\s\S]*?)<\/table>/, (_, table: string) => {
    const labels = [...table.matchAll(/<th>(.*?)<\/th>/g)].map((m) => m[1]);
    const values = [...table.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]);
    return `<div class="figures">${labels.map((label, i) => `<div class="figure"><div class="value">${values[i] ?? ""}</div><div class="label">${label}</div></div>`).join("")}</div>`;
  });
  return `<header class="front">${LOGO}<p class="kicker">NEAR Insights · Investment thesis</p>${figures}</header>`;
}

/** THESIS.md as the paper's HTML. The centred header becomes the cover. Each heading opens a section: headings lose their
    emoji and show their number apart, and a thesis section takes its color and its status from the breaking-point table.
    Images and the comment are left out, links to repository files stay as text, dates are kept whole, and labelled paragraphs are classed. */
function paperHtml(markdown: string): string {
  const body = markdown.replace(/<!--[\s\S]*?-->/g, "").replace(/<img [^>]*>/g, "");
  const html = (marked.parse(body, { async: false }) as string)
    .replace(/<a href="(?!https?:\/\/)[^"]*">(.*?)<\/a>/g, "$1")
    .replace(/(?<![\w-])(\d{4}-\d{2}(?:-\d{2})?)(?![\w-])/g, '<span class="date">$1</span>');
  /** Each thesis section's status, by its number, from the breaking-point table's rows ("3. …" … "<strong>Holding</strong>"). */
  const statuses = new Map(
    [...html.matchAll(/<tr>\s*<td>(\d+)\.[^<]*<\/td>(?:(?!<\/tr>)[\s\S])*?<td><strong>(Holding|Broken|Too close to call|Not measured yet)<\/strong><\/td>\s*<\/tr>/g)].map((m) => [m[1]!, m[2]!]),
  );
  const tones = new Map([...statuses.keys()].map((num, i) => [num, SECTION_TONES[i % SECTION_TONES.length]!]));
  const open = '<div align="center">';
  const frontEnd = html.indexOf("</div>");
  const front = html.slice(html.indexOf(open) + open.length, frontEnd);
  const sections = html
    .slice(frontEnd + "</div>".length)
    .split(/(?=<h2 align="center">)/)
    .filter((part) => part.trim() !== "")
    .map((part) =>
      part.replace(/^<h2 align="center">(.+?)<\/h2>/, (_, framed: string) => {
        /** Headings are written "<emoji> <title> <emoji>" (sectionHeading), so the title sits between the first and last space. */
        const title = framed.slice(framed.indexOf(" ") + 1, framed.lastIndexOf(" "));
        const numbered = title.match(/^(\d+|Appendix [A-Z])\.\s+(.*)$/);
        if (!numbered) return title === "Abstract" ? '<section class="abstract"><h2>Abstract</h2>' : `<section class="closing"><h2>${title}</h2>`;
        const num = numbered[1]!;
        const status = statuses.get(num);
        const tone = tones.get(num);
        return `<section class="numbered"${tone ? ` style="--tone: ${tone}"` : ""}><h2><span class="num">${num.replace("Appendix ", "")}</span><span class="title">${numbered[2]}</span>${status ? statusBadge(status) : ""}</h2>`;
      }) + "</section>",
    )
    .join("\n")
    .replace(/<td><strong>(Holding|Broken|Too close to call|Not measured yet)<\/strong><\/td>/g, (_, status: string) => `<td>${statusBadge(status)}</td>`)
    .replace(/<p><strong>(Bull case|Bear case|Breaking point|Re-run):<\/strong>/g, (_, label: string) => `<p class="${LABEL_CLASS[label]}"><strong>${label}:</strong>`)
    .replace(/(<p class="breaking">[\s\S]*?<\/p>\s*<p><strong>Status:<\/strong>[\s\S]*?<\/p>)/g, '<div class="verdict">$1</div>');
  return `${cover(front)}\n<main>\n${sections}\n</main>`;
}

function pageHtml(markdown: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:">
<title>NEAR Long-Term Investment Thesis</title>
<style>
${fontFaces()}
${PAGE_RULES}
${readFileSync(STYLE_FILE, "utf8")}
</style>
</head>
<body>
${paperHtml(markdown)}
</body>
</html>
`;
}

/** Writes THESIS.pdf from `markdown`, the text of THESIS.md as the server rendered it. */
export function writeThesisPdf(markdown: string): void {
  const browser = findBrowser();
  const folder = mkdtempSync(join(tmpdir(), "near-insights-pdf-"));
  try {
    const page = join(folder, "thesis.html");
    const pdf = join(folder, "thesis.pdf");
    writeFileSync(page, pageHtml(markdown));
    const run = spawnSync(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-agent=NEAR Insights",
        `--user-data-dir=${join(folder, "profile")}`,
        "--no-pdf-header-footer",
        `--virtual-time-budget=${LAYOUT_BUDGET_MS}`,
        `--print-to-pdf=${pdf}`,
        pathToFileURL(page).href,
      ],
      { stdio: ["ignore", "ignore", "pipe"], timeout: PRINT_TIMEOUT_MS },
    );
    if (!existsSync(pdf) || statSync(pdf).size === 0) {
      const reason = run.error?.message ?? String(run.stderr).trim().split("\n").at(-1);
      throw new Error(`${browser} did not print THESIS.pdf${reason ? `: ${reason}` : ""}`);
    }
    copyFileSync(pdf, PDF_FILE);
  } finally {
    /** The browser can hold its profile a moment after it exits (EPERM, EBUSY on Windows), so removal retries a few times. */
    rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
