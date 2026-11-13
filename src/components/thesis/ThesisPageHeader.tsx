import { io } from "next/cache";
import { Suspense } from "react";
import { HideOnError } from "@/components/ui/HideOnError";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { SourceInfo } from "@/components/ui/SourceInfo";
import { SECTIONS, type SectionId } from "@/content/thesis";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { sectionSources } from "@/lib/thesis/stats";

/** The source button of a section's numbers, which names the day its data runs through. */
async function SectionSourceInfo({ id }: { id: SectionId }) {
  await io();
  const metrics = await getThesisMetrics();
  return <SourceInfo {...sectionSources(id, metrics)} />;
}

/** The sticky header of a thesis page with the section's title and claim, which are fixed text and render without data. */
export function ThesisPageHeader({ id }: { id: SectionId }) {
  const section = SECTIONS[id];
  return (
    <PageHeader
      title={section.title}
      href={section.href}
      info={
        <HideOnError>
          <Suspense fallback={<span aria-hidden="true" className="skeleton size-4 shrink-0 rounded-full" />}>
            <SectionSourceInfo id={id} />
          </Suspense>
        </HideOnError>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink">
        <NoBreakTokens text={section.claim} />
      </p>
    </PageHeader>
  );
}
