import Link from "next/link";
import { publisherColor } from "@/components/ui/avatar";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { TickerText } from "@/components/ui/TickerText";
import type { NewsItem } from "@/db/schema";
import { formatDateTimeUtc } from "@/lib/format";
import { storyHref } from "@/lib/news";

/** Tags shown on a story card. */
const ROW_TAGS = 4;

/** Publisher and time, the line above a story's headline. */
function StoryMeta({ item }: { item: NewsItem }) {
  return (
    <>
      <span className="font-bold text-ink">{item.publisher}</span> · <time dateTime={item.publishedAt}>{formatDateTimeUtc(item.publishedAt)}</time>
    </>
  );
}

/** One story. In the news list it is a rounded card: the publisher's initial on its color, publisher and time,
    headline, summary and tags. `compact` is a plain row with publisher, time and headline, for side lists. */
export function NewsListItem({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  if (compact) {
    return (
      <li className="border-b border-line last:border-0">
        <Link href={storyHref(item.id)} className="group block py-3 transition-colors hover:bg-[var(--hover)]">
          <span className="block text-[14px] text-muted">
            <StoryMeta item={item} />
          </span>
          <span className="mt-0.5 block text-[14px] leading-snug font-bold text-ink group-hover:underline">
            <TickerText text={item.title} />
          </span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className="link-card group rounded-[8px] border border-line-strong px-3.5 py-3 break-words transition-colors hover:bg-[var(--hover)]">
        <span className="flex items-center gap-2 text-[14px] text-muted">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-[7px] text-[11px] font-bold text-white"
            style={{ background: publisherColor(item.publisher) }}
          >
            {item.publisher.slice(0, 1)}
          </span>
          <span className="min-w-0">
            <StoryMeta item={item} />
          </span>
        </span>
        <Link href={storyHref(item.id)} className="stretched-link mt-2 block text-[15px] leading-snug font-semibold text-ink group-hover:underline">
          <TickerText text={item.title} />
        </Link>
        {item.summary ? (
          <span className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-ink-2">
            <TickerText text={item.summary} />
          </span>
        ) : null}
        {item.tags.length > 0 ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.slice(0, ROW_TAGS).map((tag) => (
              <span key={tag} className="text-[13px] text-accent-text">
                <TickerText text={`#${tag.replace(/\s+/g, "")}`} />
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Lengths of a typical story's meta line, headline and summary, for the loading placeholder. */
const SKELETON_META = 36;
const SKELETON_TITLE = 80;
const SKELETON_SUMMARY = 220;

/** Loading placeholder of a NewsListItem, as a card or (`compact`) as a row. */
export function NewsListItemSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <li aria-hidden="true" className="border-b border-line py-3 last:border-0">
        <span className="block text-[14px]">
          <SkeletonWords chars={SKELETON_META} />
        </span>
        <span className="mt-0.5 block text-[14px] leading-snug font-bold">
          <SkeletonWords chars={SKELETON_TITLE} />
        </span>
      </li>
    );
  }
  return (
    <li aria-hidden="true" className="rounded-[8px] border border-line-strong px-3.5 py-3">
      <span className="flex items-center gap-2 text-[14px]">
        <span className="skeleton size-6 shrink-0 rounded-[7px]" />
        <span className="min-w-0">
          <SkeletonWords chars={SKELETON_META} />
        </span>
      </span>
      <span className="mt-2 block text-[15px] leading-snug font-semibold">
        <SkeletonWords chars={SKELETON_TITLE} />
      </span>
      <span className="mt-1 line-clamp-2 text-[14px] leading-relaxed">
        <SkeletonWords chars={SKELETON_SUMMARY} />
      </span>
      <span className="mt-2 flex flex-wrap gap-1.5 text-[13px]">
        {Array.from({ length: ROW_TAGS }, (_, i) => (
          <span key={i}>
            <SkeletonWords chars={9} />
          </span>
        ))}
      </span>
    </li>
  );
}
