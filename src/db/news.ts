import type { SQLOutputValue } from "node:sqlite";
import type { NewsItem, NewsSource } from "./schema.ts";

/** Columns read for a NewsItem, in `toNewsItem` order. */
export const NEWS_COLUMNS = "id, source, title, summary, url, publisher, author, tags, published_at";

/** Maps a news_items row (selected with NEWS_COLUMNS) to a NewsItem. */
export function toNewsItem(row: Record<string, SQLOutputValue>): NewsItem {
  const tags: unknown = JSON.parse(String(row.tags));
  return {
    id: String(row.id),
    source: String(row.source) as NewsSource,
    title: String(row.title),
    summary: row.summary === null ? null : String(row.summary),
    url: String(row.url),
    publisher: String(row.publisher),
    author: row.author === null ? null : String(row.author),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    publishedAt: String(row.published_at),
  };
}

/** Message the worker sends over the news WebSocket: stories just stored, or the latest ones on connect. */
export type NewsEvent = { type: "news"; items: NewsItem[] };
