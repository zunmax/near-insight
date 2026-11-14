import { SourceBadge, sourceName } from "@/components/ui/SourceBadge";
import { SourceInfoNote } from "@/components/ui/SourceInfoNote";
import { SOURCES, type SourceRef } from "@/config/sources";

/** A source's site as people read it: the docs link's host without "www.", e.g. "docs.coingecko.com"; the link opens the full page. */
const siteLabel = (url: string) => new URL(url).host.replace(/^www\./, "");

/** An "i" button that shows, on hover, keyboard focus or tap, where the data comes from: each source with a link to its site
    (the same link as on the Methodology page), then `through`, the day the data runs through. */
export function SourceInfo({ sources, through }: { sources: SourceRef[]; through?: string }) {
  return (
    <SourceInfoNote>
      <span className="mb-2 block text-[10.5px] font-bold tracking-[0.06em] text-muted uppercase">Data sources</span>
      <span className="flex flex-col gap-2">
        {sources.map((source) => (
          <span key={sourceName(source)} className="flex items-center gap-2.5">
            <SourceBadge source={source} className="size-[22px] rounded-md text-[11px]" />
            <span className="min-w-0">
              <span className="block font-semibold">{sourceName(source)}</span>
              {typeof source === "string" ? (
                <a href={SOURCES[source].docsUrl} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-accent-text hover:underline">
                  {siteLabel(SOURCES[source].docsUrl)} ↗
                </a>
              ) : null}
            </span>
          </span>
        ))}
      </span>
      {through ? <span className="mt-2.5 block border-t border-line pt-2 text-muted">{through}</span> : null}
    </SourceInfoNote>
  );
}
