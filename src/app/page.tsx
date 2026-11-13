import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { Spotlight } from "@/components/landing/Spotlight";
import { JsonLd } from "@/components/ui/JsonLd";
import { SITE } from "@/config/site";
import { WEBSITE_JSON_LD } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} · A live investment thesis for NEAR` },
  alternates: { canonical: "/", types: { "text/markdown": "/thesis.md" } },
};

/** Landing page: one screen with the live figures rolling and the calls to action. No footer. */
export default function LandingPage() {
  return (
    <div className="landing">
      <JsonLd data={WEBSITE_JSON_LD} />
      <div aria-hidden="true" className="landing-grid" />
      <Spotlight />
      <LandingHeader />
      <main className="landing-main">
        <LandingHero />
      </main>
    </div>
  );
}
