/** Public identity of the site. SITE_URL is the deployed origin, used for canonical links, the sitemap and share images;
    it is reduced to its origin, so a trailing slash never doubles one in a link, and an empty value counts as unset. */
export const SITE = {
  name: "NEAR Insights",
  url: new URL(process.env.SITE_URL || "http://localhost:3000").origin,
  description: "A long-term investment thesis for NEAR, tested against on-chain, market and NEAR Intents revenue data. Every query can be re-run.",
} as const;

/** The production deployment THESIS.md links to; fixed rather than SITE_URL, so the generated document is the same on every machine. */
export const LIVE_DASHBOARD_URL = "https://nearinsight.xyz";
