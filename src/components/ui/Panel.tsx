import type { ReactNode } from "react";
import { QueryTabs } from "@/components/queries/QueryTabs";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { SourceInfo } from "@/components/ui/SourceInfo";
import type { SourceRef } from "@/config/sources";
import { namedQuery } from "@/db/named-queries";

type PanelProps = {
  title: string;
  description?: string;
  /** Where the panel's data comes from, listed in the header's info button. */
  sources?: SourceRef[];
  /** The line under the sources, e.g. "Data through 2026-11-09". */
  through?: string;
  /** Id of the panel's SQL in the query catalog (src/db/named-queries/); adds the Query and Result tabs. */
  sqlId?: string;
  /** Name of the first tab when the panel has a query: what the panel shows, e.g. "Table". */
  viewLabel?: string;
  /** Small element at the right of the title row, before the source button, e.g. a live indicator. */
  action?: ReactNode;
  /** The body flows under the post text without the media box the feed draws around charts and tables. */
  textBody?: boolean;
  id?: string;
  children: ReactNode;
};

/** A card, which the feed shows as a post: the title row (title, action, source), the description as the post text, and
    the content in the body, with Query and Result tabs when the panel has SQL. */
export function Panel({ title, description, sources, through, sqlId, viewLabel = "Chart", action, textBody = false, id, children }: PanelProps) {
  const sql = sqlId ? namedQuery(sqlId) : undefined;
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`panel h-full${id ? " scroll-mt-16" : ""}`}>
      <header className="panel-head">
        <h2 id={id ? `${id}-title` : undefined} className="panel-title">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {sources ? <SourceInfo sources={sources} through={through} /> : null}
        </div>
      </header>
      {description ? (
        <p className="post-text px-4 pt-1 text-[14px] leading-relaxed text-ink">
          <NoBreakTokens text={description} />
        </p>
      ) : null}
      <div className={`panel-body flex flex-col${textBody ? " post-text" : ""}`}>
        {sql ? (
          <QueryTabs query={{ id: sql.id, sentence: sql.sentence, sql: sql.sql }} viewLabel={viewLabel}>
            {children}
          </QueryTabs>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
