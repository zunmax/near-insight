"use client";

import Link from "next/link";
import { useState } from "react";
import { useNewsStories } from "@/components/news/NewsEventsProvider";
import { NewsListItem } from "@/components/news/NewsListItem";
import { Icon } from "@/components/ui/Icon";
import type { NewsItem } from "@/db/schema";
import { formatInteger } from "@/lib/format";
import { addNewStories, NEWS_PAGE_SIZE } from "@/lib/news";

const pageHref = (query: string, page: number) => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/dashboard/news?${search}` : "/dashboard/news";
};

type Props = { initial: NewsItem[]; total: number; query: string; page: number };

/** One page of the news list with its count and paging. On the first page, stories the worker pushes are added in place. */
export function NewsFeed({ initial, total: initialTotal, query, page }: Props) {
  const [feed, setFeed] = useState({ items: initial, total: initialTotal });
  useNewsStories((incoming) => {
    if (page !== 1) return;
    setFeed((current) => {
      const next = addNewStories(current.items, incoming, NEWS_PAGE_SIZE, query);
      return next.added > 0 ? { items: next.items, total: current.total + next.added } : current;
    });
  });
  const { items, total } = feed;
  const pages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  const count = `${formatInteger(total)} ${total === 1 ? "story" : "stories"}`;

  return (
    <>
      <p className="border-b border-line px-4 py-2.5 text-[13px] text-muted" aria-live="polite">
        {query ? (
          <>
            {count} for “{query}” ·{" "}
            <Link href="/dashboard/news" className="font-semibold text-ink hover:underline">
              Show all news
            </Link>
          </>
        ) : (
          count
        )}
      </p>

      {items.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-2.5 px-4 py-3">
          {items.map((item) => (
            <NewsListItem key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="grid flex-1 place-items-center px-4 py-10 text-center text-[15px] text-ink-2">
          {query
            ? "No stories match this search. Try a shorter word, such as Intents or ETF."
            : "NEAR news is still being collected from its public sources. The latest stories appear here once the first ones are stored."}
        </p>
      )}

      {pages > 1 ? (
        <nav aria-label="News pages" className="flex items-center justify-between gap-3 px-4 py-4 text-[13px]">
          {page > 1 ? (
            <Link href={pageHref(query, page - 1)} className="btn btn-secondary btn-sm">
              <Icon name="chevron-left" className="size-3.5 shrink-0" />
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(query, page + 1)} className="btn btn-secondary btn-sm">
              Older
              <Icon name="chevron-right" className="size-3.5 shrink-0" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
