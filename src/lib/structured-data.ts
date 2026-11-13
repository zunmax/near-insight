import { SITE } from "@/config/site";

/** schema.org WebSite for the landing page: the name and address search engines show for the site. */
export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: `${SITE.url}/`,
  description: SITE.description,
  inLanguage: "en",
};
