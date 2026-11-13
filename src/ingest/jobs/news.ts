/** News jobs for CryptoPanic and ChainCatcher, the shared news storage, and the event announcing newly stored stories. */
import { EventEmitter } from "node:events";
import type { DatabaseSync } from "node:sqlite";
import { INGEST_SCHEDULE_MS, NEWS_DUPLICATE_WINDOW_DAYS, NEWS_RETENTION_DAYS, PAGED_RUN_BUDGET_MS } from "../../config/ingest.ts";
import { NEAR_IDS } from "../../config/sources.ts";
import { transaction } from "../../db/connection.ts";
import { JOBS, type NewsItem, type NewsSource } from "../../db/schema.ts";
import { DAY_SECONDS } from "../../lib/metrics.ts";
import { daysAgo, now } from "../days.ts";
import { fetchChainCatcherNews } from "../sources/chaincatcher.ts";
import { fetchCryptoPanicNews } from "../sources/cryptopanic.ts";
import type { Job } from "./job.ts";
import { datasetVersion, markDatasetVersion } from "./storage.ts";

/** dataset_versions rows holding the newest search result or post (about NEAR or not) a finished run has read back from. */
const CHAINCATCHER_SEEN_DATASET = "chaincatcher_seen_through";
const CRYPTOPANIC_SEEN_DATASET = "cryptopanic_seen_through";

/** Lower-case alphanumeric title, used to keep one copy of a story that several sources report. */
const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** After a transaction commits: `changed` when any story was written or deleted, `stored` with the stories stored for the first time. */
export const newsEvents = new EventEmitter<{ changed: []; stored: [NewsItem[]] }>();

const DUPLICATE_WINDOW_MS = NEWS_DUPLICATE_WINDOW_DAYS * DAY_SECONDS * 1000;

/** Inserts or refreshes news items, skipping a story already stored under another id. Returns rows written and deleted, and
    the new stories. */
function upsertNews(db: DatabaseSync, items: NewsItem[]): { rows: number; pruned: number; inserted: NewsItem[] } {
  /** The same title counts as the same story only near its publish time, so a headline that recurs months later is kept. */
  const duplicate = db.prepare("SELECT 1 FROM news_items WHERE title_key = ? AND id <> ? AND published_at BETWEEN ? AND ? LIMIT 1");
  const exists = db.prepare("SELECT 1 FROM news_items WHERE id = ?");
  const upsert = db.prepare(
    `INSERT INTO news_items (id, source, title, title_key, summary, url, publisher, author, tags, published_at, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET title = excluded.title, title_key = excluded.title_key, summary = excluded.summary,
       url = excluded.url, publisher = excluded.publisher, author = excluded.author, tags = excluded.tags,
       published_at = excluded.published_at, fetched_at = excluded.fetched_at`,
  );
  const fetchedAt = now();
  const cutoff = daysAgo(NEWS_RETENTION_DAYS);
  const inserted: NewsItem[] = [];
  let rows = 0;
  for (const item of items) {
    const key = titleKey(item.title);
    const published = Date.parse(item.publishedAt);
    const from = new Date(published - DUPLICATE_WINDOW_MS).toISOString();
    const to = new Date(published + DUPLICATE_WINDOW_MS).toISOString();
    if (!key || duplicate.get(key, item.id, from, to)) continue;
    if (!exists.get(item.id) && item.publishedAt >= cutoff) inserted.push(item);
    upsert.run(item.id, item.source, item.title, key, item.summary, item.url, item.publisher, item.author, JSON.stringify(item.tags), item.publishedAt, fetchedAt);
    rows++;
  }
  const pruned = Number(db.prepare("DELETE FROM news_items WHERE published_at < ?").run(cutoff).changes);
  return { rows, pruned, inserted };
}

/** Stores news in one transaction, then announces the change and the new stories. Returns rows written. */
function storeNews(db: DatabaseSync, items: NewsItem[]): number {
  const { rows, pruned, inserted } = transaction(db, () => upsertNews(db, items));
  if (rows > 0 || pruned > 0) newsEvents.emit("changed");
  if (inserted.length > 0) newsEvents.emit("stored", inserted);
  return rows;
}

/** Publish time of the newest stored story from `source`, where its next run reads back to; null before its first run. */
function latestNewsAt(db: DatabaseSync, source: NewsSource): string | null {
  const row = db.prepare("SELECT MAX(published_at) AS at FROM news_items WHERE source = ?").get(source);
  return row?.at == null ? null : String(row.at);
}

/** Most news pages a run reads: `firstRun` before a source has any stories, otherwise `catchUp`, which bounds how far a run
    reads back to cover the time the worker was stopped. A CryptoPanic page holds about a week of NEAR news.
    A run also stops reading at PAGED_RUN_BUDGET_MS and stores the pages it has. */
const NEWS_PAGES = {
  cryptopanic: { firstRun: 3, catchUp: 50 },
  chaincatcher: { firstRun: 10, catchUp: 10 },
} as const;

/** Reads a source's NEAR news back to `since`, at most `maxPages` pages, until `deadline` (unix ms). */
type NewsFetcher = (nearId: string, since: string | null, maxPages: number, deadline: number) => Promise<{ items: NewsItem[]; seenThrough: string | null }>;

/** The news job of `source`. A run reads back to the newest post or search result a finished run saw (`seenDataset`), not to the
    newest stored NEAR story: a run stopped early re-reads that stretch, and rare NEAR stories never make every run page deep. */
function newsJob(source: NewsSource, job: "cryptopanicNews" | "chaincatcherNews", seenDataset: string, fetchNews: NewsFetcher): Job {
  return {
    name: JOBS[job],
    everyMs: INGEST_SCHEDULE_MS[job],
    async run(db) {
      const since = datasetVersion(db, seenDataset) ?? latestNewsAt(db, source);
      const pages = since ? NEWS_PAGES[source].catchUp : NEWS_PAGES[source].firstRun;
      const { items, seenThrough } = await fetchNews(NEAR_IDS[source], since, pages, Date.now() + PAGED_RUN_BUDGET_MS);
      const rows = storeNews(db, items);
      if (seenThrough) transaction(db, () => markDatasetVersion(db, seenDataset, seenThrough));
      return rows;
    },
  };
}

export const cryptopanicNewsJob = newsJob("cryptopanic", "cryptopanicNews", CRYPTOPANIC_SEEN_DATASET, fetchCryptoPanicNews);
export const chaincatcherNewsJob = newsJob("chaincatcher", "chaincatcherNews", CHAINCATCHER_SEEN_DATASET, fetchChainCatcherNews);
