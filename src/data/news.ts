import "server-only";
import { cacheLife } from "next/cache";
import { getReader } from "@/data/reader";
import { NEWS_COLUMNS as COLUMNS, toNewsItem } from "@/db/news";
import type { NewsItem } from "@/db/schema";
import { NEWS_PAGE_SIZE, STORY_ID } from "@/lib/news";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The `id` query parameter when it is a well-formed story id, otherwise null. */
export function readStoryId(params: Awaited<SearchParams>): string | null {
  return typeof params.id === "string" && STORY_ID.test(params.id) ? params.id : null;
}

/** Escapes LIKE wildcards so a search for "100%" matches the text literally. */
const likePattern = (query: string) => `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

type NewsPage = { items: NewsItem[]; total: number };

/** One page of NEAR news, newest first. `query` matches title, summary, publisher and tags, case-insensitively. Only the
    unfiltered list is cached: a search's key comes from the visitor, and caching each one would push shared entries out. */
export async function getNews(query: string, page: number): Promise<NewsPage> {
  return query ? readNews(query, page) : getNewsPage(page);
}

async function getNewsPage(page: number): Promise<NewsPage> {
  "use cache";
  cacheLife("db");
  return readNews("", page);
}

/** One page of stories and the count of all matches, read uncached; empty before the database exists. */
function readNews(query: string, page: number): NewsPage {
  const db = getReader();
  if (!db) return { items: [], total: 0 };
  /** Tags are a JSON array, so each tag is matched on its own (as matchesNewsQuery does), never the array's brackets or quotes. */
  const where = query
    ? "WHERE title LIKE ?1 ESCAPE '\\' OR summary LIKE ?1 ESCAPE '\\' OR publisher LIKE ?1 ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_each(news_items.tags) WHERE value LIKE ?1 ESCAPE '\\')"
    : "";
  const params = query ? [likePattern(query)] : [];
  const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM news_items ${where}`).get(...params)?.n ?? 0);
  const items = db
    .prepare(`SELECT ${COLUMNS} FROM news_items ${where} ORDER BY published_at DESC LIMIT ${NEWS_PAGE_SIZE} OFFSET ${Math.max(0, page - 1) * NEWS_PAGE_SIZE}`)
    .all(...params)
    .map(toNewsItem);
  return { items, total };
}

/** One story by id, or null when it does not exist (or has aged out). */
export async function getNewsItem(id: string): Promise<NewsItem | null> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return null;
  const row = db.prepare(`SELECT ${COLUMNS} FROM news_items WHERE id = ?`).get(id);
  return row ? toNewsItem(row) : null;
}

/** Whether a story is stored now, read uncached: the proxy checks a story link with it before the page renders. */
export function isStoryStored(id: string): boolean {
  return getReader()?.prepare("SELECT 1 FROM news_items WHERE id = ?").get(id) !== undefined;
}

/** The latest stories and when they were read (ms), which dates the "Today" and "Yesterday" labels. */
export async function getLatestNewsSnapshot(limit: number): Promise<{ items: NewsItem[]; readAt: number }> {
  "use cache";
  cacheLife("db");
  return { items: await getLatestNews(limit), readAt: Date.now() };
}

/** The latest stories, leaving out `excludeId`. */
export async function getLatestNews(limit: number, excludeId = ""): Promise<NewsItem[]> {
  "use cache";
  cacheLife("db");
  const db = getReader();
  if (!db) return [];
  return db.prepare(`SELECT ${COLUMNS} FROM news_items WHERE id <> ? ORDER BY published_at DESC LIMIT ?`).all(excludeId, limit).map(toNewsItem);
}
