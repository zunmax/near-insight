import { io } from "next/cache";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { TickerText } from "@/components/ui/TickerText";
import { NEWS_RETENTION_DAYS } from "@/config/ingest";
import { getNewsItem, readStoryId, type SearchParams } from "@/data/news";
import { formatDateTimeUtc } from "@/lib/format";

/** The link back to the news list, at the head of a story. */
function BackToNews() {
  return (
    <div className="panel-head">
      <Link href="/dashboard/news" className="panel-title inline-flex items-center gap-1.5 hover:underline">
        <Icon name="chevron-left" className="size-4 shrink-0" />
        All NEAR news
      </Link>
    </div>
  );
}

/** In place of a story the link does not name, or one no longer stored (shared links outlive the retention window). */
export function MissingStory() {
  return (
    <article className="panel">
      <h1 className="sr-only">Story not available</h1>
      <BackToNews />
      <p className="panel-body panel-empty text-[14px] leading-relaxed text-ink-2">
        <span>This story is not available. Stories are kept for {NEWS_RETENTION_DAYS} days.</span>
      </p>
    </article>
  );
}

/** One story, chosen by `?id=`: headline, publisher and time, summary, the link to the full article, and tags. `src/proxy.ts`
    answers a link to a missing story with a 404 first; one removed after that check still shows MissingStory. */
export async function NewsStory({ searchParams }: { searchParams: SearchParams }) {
  await io();
  const id = readStoryId(await searchParams);
  const item = id ? await getNewsItem(id) : null;
  if (!item) return <MissingStory />;

  return (
    <article className="panel">
      <BackToNews />
      <div className="panel-body p-5 sm:p-7">
        <p className="text-[12.5px] text-muted">
          <span className="font-medium text-ink-2">{item.publisher}</span>
          {item.author ? ` · ${item.author}` : ""} · <time dateTime={item.publishedAt}>{formatDateTimeUtc(item.publishedAt)}</time>
        </p>
        <h1 className="mt-2 text-[24px] leading-snug font-medium sm:text-[26px]">
          <TickerText text={item.title} />
        </h1>
        {item.summary ? (
          <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">
            <TickerText text={item.summary} />
          </p>
        ) : null}
        <p className="mt-3.5">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-accent-text hover:underline">
            Read the full article on {item.publisher}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 shrink-0">
              <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
            </svg>
          </a>
        </p>
        {item.tags.length > 0 ? (
          <p className="mt-5 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <Link key={tag} href={`/dashboard/news?q=${encodeURIComponent(tag)}`} className="chip hover:text-ink hover:underline">
                {tag}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Loading placeholder of NewsStory: the back link, then a typical story's meta line, headline, summary, link and tags. */
export function NewsStorySkeleton() {
  return (
    <div aria-hidden="true" className="panel">
      <div className="panel-head">
        <span className="panel-title inline-flex items-center gap-1.5">
          <span className="skeleton size-4 shrink-0 rounded-full" />
          <SkeletonWords chars={"All NEAR news".length} />
        </span>
      </div>
      <div className="panel-body p-5 sm:p-7">
        <p className="text-[12.5px]">
          <SkeletonWords chars={45} />
        </p>
        <h1 className="mt-2 text-[24px] leading-snug font-medium sm:text-[26px]">
          <SkeletonWords chars={80} />
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed">
          <SkeletonWords chars={400} />
        </p>
        <p className="mt-3.5 text-[14px] font-bold">
          <SkeletonWords chars={35} />
        </p>
        <p className="mt-5 flex flex-wrap gap-1.5">
          {[6, 9, 5, 8].map((chars, i) => (
            <span key={i} className="chip">
              <SkeletonWords chars={chars} />
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
