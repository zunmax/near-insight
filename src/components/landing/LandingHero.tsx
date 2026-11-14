import { Suspense } from "react";
import { LandingActions } from "@/components/landing/LandingActions";
import { LiveFigures } from "@/components/landing/LiveFigures";
import { HideOnError } from "@/components/ui/HideOnError";

/** Landing hero, centered: the live figures rolling one after another, what the site does, and the two calls to action. */
export function LandingHero() {
  return (
    <section aria-labelledby="landing-title" className="landing-hero">
      <h1 id="landing-title" className="sr-only">
        NEAR Insights, a live investment thesis for NEAR
      </h1>
      <HideOnError>
        <Suspense fallback={<div className="odometer-placeholder" />}>
          <LiveFigures />
        </Suspense>
      </HideOnError>
      <p className="landing-sub">A live investment thesis for NEAR, with every claim backed by data.</p>
      <LandingActions className="landing-actions" />
    </section>
  );
}
