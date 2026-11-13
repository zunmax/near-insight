import { Panel } from "@/components/ui/Panel";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { SOURCES, type SourceKey } from "@/config/sources";

/** Every data source as a row: its initial on its kind's color, its name, what it supplies and a link to its docs. */
export function DataSourcesPanel() {
  return (
    <Panel id="sources" title="Data sources">
      <ul className="m-0 list-none p-0">
        {(Object.keys(SOURCES) as SourceKey[]).map((key) => {
          const source = SOURCES[key];
          return (
            <li key={key} className="flex gap-3 border-b border-line py-3 first:pt-1 last:border-0 last:pb-1">
              <SourceBadge source={key} className="size-8 rounded-[8px] text-[13px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-bold">{source.name}</p>
                  <a
                    href={source.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${source.name} docs`}
                    className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-[var(--hover)] hover:text-ink"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[15px]">
                      <path d="M9.5 2.5h4v4M13.5 2.5 8 8M12 9.5V12a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 3 12V5.5A1.5 1.5 0 0 1 4.5 4H7" />
                    </svg>
                  </a>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{source.usedFor}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
