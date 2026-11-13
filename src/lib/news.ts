import { NEWS_SOURCES, type NewsItem } from "@/db/schema";
import { formatShortDate } from "@/lib/format";
import { DAY_SECONDS, dayTime, isoDay } from "@/lib/metrics";
import { isRecord } from "@/lib/validate";

/** Stories per page on the news list. */
export const NEWS_PAGE_SIZE = 25;

/** Longest news search text accepted. */
export const NEWS_QUERY_MAX_LENGTH = 100;

/** Story ids are '<source prefix>-<upstream id>'. */
export const STORY_ID = new RegExp(`^(${Object.values(NEWS_SOURCES).join("|")})-\\d{1,15}$`);

/** Link to one story's page. */
export const storyHref = (id: string) => `/dashboard/news/story?id=${encodeURIComponent(id)}`;

type NewsDay = { label: string; items: NewsItem[] };

/** Groups stories by UTC day, labelled "Today", "Yesterday" or a date such as "Oct 20" as seen at `nowMs`. */
export function groupNewsByDay(items: NewsItem[], nowMs: number): NewsDay[] {
  const today = isoDay(nowMs / 1000);
  const yesterday = isoDay(nowMs / 1000 - DAY_SECONDS);
  const days = new Map<string, NewsItem[]>();
  for (const item of items) {
    const day = item.publishedAt.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days].map(([day, dayItems]) => ({
    label: day === today ? "Today" : day === yesterday ? "Yesterday" : formatShortDate(dayTime(day)),
    items: dayItems,
  }));
}

/** True when `query` occurs in the title, summary, publisher or a tag, ignoring case (as the news search does). */
function matchesNewsQuery(item: NewsItem, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [item.title, item.summary ?? "", item.publisher, ...item.tags].some((text) => text.toLowerCase().includes(needle));
}

/** Adds pushed stories to `items`, the newest `limit` stories matching `query`, newest first. A story is added when it is
    not shown yet and belongs in the list: newer than its last story, or any story while the list is not full. */
export function addNewStories(items: NewsItem[], incoming: NewsItem[], limit: number, query = ""): { items: NewsItem[]; added: number } {
  const shown = new Set(items.map((item) => item.id));
  const oldest = items.length < limit ? "" : (items.at(-1)?.publishedAt ?? "");
  const added = incoming.filter((item) => !shown.has(item.id) && item.publishedAt > oldest && matchesNewsQuery(item, query));
  if (added.length === 0) return { items, added: 0 };
  const merged = [...items, ...added].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  return { items: merged.slice(0, limit), added: added.length };
}

const isNullableString = (value: unknown) => value === null || typeof value === "string";

function readNewsItem(value: unknown): NewsItem | null {
  if (!isRecord(value)) return null;
  const { id, source, title, summary, url, publisher, author, tags, publishedAt } = value;
  const valid =
    typeof id === "string" && STORY_ID.test(id) &&
    typeof source === "string" && Object.hasOwn(NEWS_SOURCES, source) &&
    typeof title === "string" && typeof url === "string" && /^https?:\/\//.test(url) &&
    typeof publisher === "string" && isNullableString(summary) && isNullableString(author) &&
    Array.isArray(tags) && tags.every((tag) => typeof tag === "string") &&
    typeof publishedAt === "string" && Number.isFinite(Date.parse(publishedAt));
  return valid ? (value as NewsItem) : null;
}

/** The stories in a news WebSocket message, leaving out malformed ones; null when it is not a news message. */
export function readNewsEvent(data: string): NewsItem[] | null {
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(message) || message.type !== "news" || !Array.isArray(message.items)) return null;
  return message.items.flatMap((item) => readNewsItem(item) ?? []);
}
