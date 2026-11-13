import Link from "next/link";
import { Fragment } from "react";
import { SqlCode } from "@/components/queries/SqlCode";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PAGE_LABEL } from "@/config/navigation";
import { NAMED_QUERIES } from "@/db/named-queries";

type CatalogQuery = (typeof NAMED_QUERIES)[number];

/** The catalog in runs of queries shown on the same page; the catalog is already ordered by page. */
function byPage(queries: CatalogQuery[]): Array<{ page: string; queries: CatalogQuery[] }> {
  const groups: Array<{ page: string; queries: CatalogQuery[] }> = [];
  for (const query of queries) {
    const last = groups.at(-1);
    if (last?.page === query.page) last.queries.push(query);
    else groups.push({ page: query.page, queries: [query] });
  }
  return groups;
}

/** One query: what it shows, its SQL, the requests behind its tables, the code that builds on it, and how to run it. */
function QueryCard({ query }: { query: CatalogQuery }) {
  return (
    <section id={query.id} aria-labelledby={`${query.id}-title`} className="panel scroll-mt-16">
      <p className="panel-head panel-title">{query.id}</p>
      <div className="panel-body p-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`${query.id}-title`} className="text-[16px] font-medium">
              {query.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{query.sentence}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={`/api/query/${query.id}`} target="_blank" rel="noreferrer" aria-label={`Run ${query.title}`} className="btn btn-primary btn-sm">
              Run
            </a>
            <a href={`/api/query/${query.id}?format=csv`} download aria-label={`${query.title} as CSV`} className="btn btn-secondary btn-sm">
              CSV
            </a>
          </div>
        </header>
        <pre role="region" aria-label={`SQL of ${query.title}`} tabIndex={0} className="mt-4 overflow-x-auto rounded-[8px] bg-surface-3 p-3.5 text-[12.5px] leading-relaxed text-ink thin-scroll">
          <SqlCode sql={query.sql} />
        </pre>
        <dl className="m-0 mt-3 grid gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted">Filled by</dt>
          <dd className="m-0 text-ink-2">{query.requests.join("; ")}</dd>
          {query.code ? (
            <>
              <dt className="text-muted">Calculated further in</dt>
              <dd className="m-0 text-ink-2">{query.code}</dd>
            </>
          ) : null}
          <dt className="text-muted">Run it yourself</dt>
          <dd className="m-0 text-ink-2">npm run query -- {query.id}</dd>
          <dt className="text-muted">Shown on</dt>
          <dd className="m-0">
            <Link href={query.page} className="font-medium text-ink hover:underline">
              {PAGE_LABEL.get(query.page) ?? query.page}
            </Link>
          </dd>
        </dl>
      </div>
    </section>
  );
}

/** Every query in the catalog, under a heading for the page that shows it, in sidebar order. */
export function QueryCatalog() {
  return (
    <div className="grid gap-3.5">
      {byPage(NAMED_QUERIES).map((group) => (
        <Fragment key={group.page}>
          <SectionHeading title={PAGE_LABEL.get(group.page) ?? group.page} id={`page-${group.page.split("/").at(-1)}`} />
          {group.queries.map((query) => (
            <QueryCard key={query.id} query={query} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
