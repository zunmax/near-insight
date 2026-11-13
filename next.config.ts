import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/** `next typegen` (npm run typecheck) loads this config in production mode but bakes nothing in, so it needs no site URLs. */
const isProduction = process.env.NODE_ENV === "production" && !process.argv.includes("typegen");

/** A production build bakes SITE_URL into metadata and the sitemap, and NEWS_EVENTS_URL into the news panels and the content
    security policy, so a missing one would ship localhost links; an https site also needs wss://, since browsers block ws:// from it. */
if (isProduction) {
  const { SITE_URL, NEWS_EVENTS_URL } = process.env;
  if (!SITE_URL) throw new Error("Set SITE_URL to the site's public origin (e.g. https://example.com) for a production build.");
  if (!NEWS_EVENTS_URL) throw new Error("Set NEWS_EVENTS_URL to the public news WebSocket (e.g. wss://example.com/news-events) for a production build.");
  if (new URL(SITE_URL).protocol === "https:" && new URL(NEWS_EVENTS_URL).protocol !== "wss:") {
    throw new Error("NEWS_EVENTS_URL must start with wss:// when SITE_URL is https.");
  }
}

/** Origin of the worker's news WebSocket (NEWS_EVENTS_URL), allowed in connect-src beside the site's own. */
const newsEventsOrigin = process.env.NEWS_EVENTS_URL ? ` ${new URL(process.env.NEWS_EVENTS_URL).origin}` : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${newsEventsOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** This machine's own IPv4 addresses on its networks, so a phone on the same Wi-Fi can open the dev server at http://<address>:3000. */
const localNetworkAddresses = Object.values(networkInterfaces())
  .flat()
  .flatMap((address) => (address && address.family === "IPv4" && !address.internal ? [address.address] : []));

/** Kept out of search indexes, links still followed: news search results and story pages (third-party headlines and summaries). */
const noindexHeaders = [{ key: "X-Robots-Tag", value: "noindex, follow" }];

const nextConfig: NextConfig = {
  /** `npm run verify` runs its dev server in its own folder (.next-verify), so it can run beside the usual dev server (one dev server per folder). */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /** The dev server blocks its dev assets for any origin but localhost; these are the same machine, reached over the network. */
  allowedDevOrigins: localNetworkAddresses,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  cacheLife: {
    /** Reads from the local SQLite database, which the ingest worker refreshes on schedules from every minute to once a day.
        Components call `await io()` before these reads, so the build (which has no database) never prerenders them as empty. */
    db: { stale: 20, revalidate: 60, expire: 3600 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/dashboard/home", permanent: true },
    ];
  },
  async rewrites() {
    /** The Markdown thesis at a crawlable path; robots.txt keeps /api/ closed. */
    return [{ source: "/thesis.md", destination: "/api/thesis" }];
  },
  async headers() {
    return [
      { source: "/dashboard/news", has: [{ type: "query", key: "q" }], headers: noindexHeaders },
      { source: "/dashboard/news/story", headers: noindexHeaders },
      ...(isProduction ? [{ source: "/:path*", headers: securityHeaders }] : []),
    ];
  },
};

export default nextConfig;
