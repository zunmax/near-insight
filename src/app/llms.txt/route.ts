import { NAV_ITEMS } from "@/config/navigation";
import { SITE } from "@/config/site";
import { SECTIONS, THESIS_STATEMENT } from "@/content/thesis";

/** Each thesis section by the path of its page. */
const SECTION_BY_HREF = new Map(Object.values(SECTIONS).map((section) => [section.href, section]));

const link = (label: string, path: string, note?: string) => `- [${label}](${SITE.url}${path})${note ? `: ${note}` : ""}`;

/** /llms.txt (llmstxt.org): what the site is, the Markdown thesis and every dashboard page, from fixed content and config only. */
export function GET() {
  const pages = NAV_ITEMS.map((item) => {
    const section = SECTION_BY_HREF.get(item.href);
    return link(item.label, item.href, section ? `${section.title}. ${section.claim}` : undefined);
  });
  const text = [
    `# ${SITE.name}`,
    `> ${SITE.description}`,
    THESIS_STATEMENT,
    "## Thesis",
    link("NEAR investment thesis (Markdown)", "/thesis.md", "the verdict on the latest data, each claim with its bull case, bear case and breaking point, the data sources, the formulas and how to re-run them"),
    "## Dashboard",
    pages.join("\n"),
  ].join("\n\n");
  return new Response(`${text}\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
