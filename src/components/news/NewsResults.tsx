import { io } from "next/cache";
import { NewsFeed } from "@/components/news/NewsFeed";
import { NewsListItemSkeleton } from "@/components/news/NewsListItem";
import { Icon } from "@/components/ui/Icon";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { getNews, type SearchParams } from "@/data/news";
import { NEWS_PAGE_SIZE, NEWS_QUERY_MAX_LENGTH } from "@/lib/news";

/** Highest page number read from the URL. */
const MAX_PAGE = 1000;

/** Reads `q` and `page` from the URL, bounded so any value is safe to query with. */
function readParams(params: Awaited<SearchParams>): { query: string; page: number } {
  /** Control characters are dropped (a NUL ends SQLite's LIKE early), and the cut counts characters, so it never splits an emoji. */
  const text = typeof params.q === "string" ? params.q.replace(/\p{Cc}/gu, "").trim() : "";
  const query = Array.from(text).slice(0, NEWS_QUERY_MAX_LENGTH).join("");
  const page = Number(typeof params.page === "string" ? params.page : 1);
  /** A page past the last is shown as the last page below, so a huge page number is capped rather than reset to the first. */
  return { query, page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1 };
}

/** The searchable, paged list of NEAR news, each story a post in the feed. */
export async function NewsResults({ searchParams }: { searchParams: SearchParams }) {
  await io();
  const { query, page: requested } = readParams(await searchParams);
  let { items, total } = await getNews(query, requested);
  /** A page past the last one shows the last page, not an empty list that reads as no news at all. */
  const page = Math.min(requested, Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE)));
  if (page !== requested) ({ items, total } = await getNews(query, page));

  return (
    <section aria-label="Latest NEAR news" className="flex flex-1 flex-col">
      <form action="/dashboard/news" role="search" className="flex gap-2 border-b border-line px-4 py-3">
        <label htmlFor="news-search" className="sr-only">
          Search NEAR news
        </label>
        <div className="relative flex h-10 min-w-0 flex-1 items-center gap-3 rounded-[8px] border border-transparent bg-surface-3 px-4 text-muted transition-colors focus-within:border-accent focus-within:bg-bg focus-within:text-accent">
          <Icon name="search" strokeWidth={1.6} className="size-[18px] shrink-0" />
          <input
            id="news-search"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={NEWS_QUERY_MAX_LENGTH}
            placeholder="Search NEAR news, e.g. Intents, ETF, HSP-029"
            className="peer min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted max-md:placeholder:text-transparent"
          />
          {/** Phones: a short hint in place of the full placeholder, which does not fit. */}
          <span aria-hidden="true" className="pointer-events-none absolute left-[46px] hidden text-[15px] text-muted max-md:peer-placeholder-shown:block">
            Search NEAR news
          </span>
        </div>
        <button type="submit" className="btn btn-primary h-10">
          Search
        </button>
      </form>

      {/** Keyed by the stories too, so a page kept alive and shown again starts from the newer list it is given. */}
      <NewsFeed key={`${query}|${page}|${total}|${items[0]?.id ?? ""}`} initial={items} total={total} query={query} page={page} />
    </section>
  );
}

/** Loading placeholder of NewsResults: the search row, the story count, a page of stories and the page links. */
export function NewsResultsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col">
      <div className="flex gap-2 border-b border-line px-4 py-3">
        <span className="skeleton h-10 min-w-0 flex-1 rounded-[8px]" />
        <span className="skeleton h-10 w-[84px] shrink-0 rounded-full" />
      </div>
      <p className="border-b border-line px-4 py-2.5 text-[13px]">
        <SkeletonWords chars={13} />
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 px-4 py-3">
        {Array.from({ length: NEWS_PAGE_SIZE }, (_, i) => (
          <NewsListItemSkeleton key={i} />
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 px-4 py-4 text-[13px]">
        <span />
        <SkeletonWords chars={"Page 1 of 10".length} />
        <span className="skeleton h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}
