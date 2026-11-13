import type { MetadataRoute } from "next";
import { NAV_ITEMS } from "@/config/navigation";
import { SITE } from "@/config/site";

/** The landing page, every dashboard section and the Markdown thesis; data on each refreshes within hours. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "hourly", priority: 1 },
    ...NAV_ITEMS.map((item) => ({ url: `${SITE.url}${item.href}`, changeFrequency: "hourly" as const, priority: 0.7 })),
    { url: `${SITE.url}/thesis.md`, changeFrequency: "hourly", priority: 0.8 },
  ];
}
