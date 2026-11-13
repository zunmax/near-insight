"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useNewsStories } from "@/components/news/NewsEventsProvider";
import { TickerText } from "@/components/ui/TickerText";
import type { NewsItem } from "@/db/schema";
import { formatUtcTime } from "@/lib/format";
import { DAY_SECONDS } from "@/lib/metrics";
import { addNewStories, groupNewsByDay, storyHref } from "@/lib/news";

type Props = { initial: NewsItem[]; readAt: number; count: number };

/** Rows rise in one after another, 45ms apart. */
const rowDelay = (i: number) => ({ animationDelay: `${i * 45}ms` }) as CSSProperties;

/** The newest `count` stories, newest first: publisher and time (the day's label before today), then the headline. Stories the
    worker pushes through the surrounding NewsEventsProvider are added in place. */
export function LatestNewsFeed({ initial, readAt, count }: Props) {
  const [feed, setFeed] = useState({ items: initial, at: readAt });
  useNewsStories((incoming) =>
    setFeed((current) => {
      const next = addNewStories(current.items, incoming, count);
      return next.added > 0 ? { items: next.items, at: Date.now() } : current;
    }),
  );
  /** Re-dates the labels at the first UTC midnight after `feed.at`, so "Today" and "Yesterday" stay true without a new story. */
  useEffect(() => {
    const dayMs = DAY_SECONDS * 1000;
    const nextMidnight = feed.at - (feed.at % dayMs) + dayMs;
    const timer = setTimeout(() => setFeed((current) => ({ ...current, at: Date.now() })), Math.max(0, nextMidnight - Date.now()));
    return () => clearTimeout(timer);
  }, [feed.at]);
  const rows = groupNewsByDay(feed.items, feed.at).flatMap((day) => day.items.map((item) => ({ item, day: day.label })));

  return (
    <ul className="-mx-4 my-0 flex list-none flex-col p-0">
      {rows.map(({ item, day }, i) => (
        <li key={item.id} className="feed-in" style={rowDelay(i)}>
          <Link href={storyHref(item.id)} className="block px-4 py-2.5 transition-colors hover:bg-[var(--hover)]">
            <span className="block text-[13px] text-muted">
              {item.publisher} · <time dateTime={item.publishedAt}>{day === "Today" ? formatUtcTime(item.publishedAt) : day}</time>
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug font-bold text-ink">
              <TickerText text={item.title} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
