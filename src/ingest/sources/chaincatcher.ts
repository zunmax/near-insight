import { SOURCES } from "../../config/sources.ts";
import { NEWS_SOURCES, type NewsItem } from "../../db/schema.ts";
import { asArray, asRecord, readNumber, readString } from "../../lib/validate.ts";
import { fetchJson } from "../http.ts";
import { mentionsNear, toPlainText } from "./news-text.ts";

const CC = SOURCES.chaincatcher;

/** Items a page; ChainCatcher accepts up to 20. */
const PAGE_SIZE = 20;

/** A tag that names NEAR itself, e.g. "NEAR" or "NEAR Protocol". */
const NEAR_TAG = /^near(\s|$)/i;

/** ChainCatcher times are China Standard Time, "YYYY-MM-DD HH:mm:ss". */
const chinaTimeToIso = (value: string) => new Date(`${value.replace(" ", "T")}+08:00`).toISOString();

/** `newestAt` is the newest ISO time on the page, including items the NEAR filter drops ("" for an empty page). */
type Page = { items: NewsItem[]; total: number; newestAt: string };

async function fetchPage(keywords: string, pageNumber: number): Promise<Page> {
  const path = "pc/search/list";
  const body = asRecord(
    await fetchJson(`${CC.baseUrl}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: CC.siteUrl, language: "en" },
      body: JSON.stringify({ mateType: 1, keywords, pageNumber, pageSize: PAGE_SIZE }),
    }),
    path,
  );
  const data = asRecord(body.data, `${path}.data`);
  const raws = asArray(data.items, `${path}.data.items`).map((raw, i) => asRecord(raw, `${path}.data.items[${i}]`));
  const times = raws.map((item, i) => chinaTimeToIso(readString(item, "lastTime", `${path}.data.items[${i}]`)));
  const items = raws.flatMap((item, i): NewsItem[] => {
    const at = `${path}.data.items[${i}]`;
    const title = toPlainText(readString(item, "title", at));
    const tags = Array.isArray(item.tagNames) ? item.tagNames.filter((t): t is string => typeof t === "string") : [];
    if (!tags.some((tag) => NEAR_TAG.test(tag)) && !mentionsNear(title)) return [];
    const id = readNumber(item, "id", at);
    const summary = typeof item.description === "string" ? toPlainText(item.description) : "";
    return [
      {
        id: `${NEWS_SOURCES.chaincatcher}-${id}`,
        source: "chaincatcher",
        title,
        summary: summary || null,
        url: `${CC.siteUrl}/en/article/${id}`,
        publisher: CC.name,
        author: null,
        tags,
        publishedAt: times[i]!,
      },
    ];
  });
  const newestAt = times.reduce((newest, time) => (time > newest ? time : newest), "");
  return { items, total: readNumber(data, "total", `${path}.data`), newestAt };
}

/** English ChainCatcher news about NEAR, 20 a page (mostly newest first), until a page is older than `since` (the newest result
    a previous run saw), `maxPages` or `deadline` (unix ms). `seenThrough`, the next run's `since`, is the first page's newest
    result once the run reached `since` or `maxPages`, or null when `deadline` stopped it first. */
export async function fetchChainCatcherNews(
  keywords: string,
  since: string | null,
  maxPages: number,
  deadline: number,
): Promise<{ items: NewsItem[]; seenThrough: string | null }> {
  const first = await fetchPage(keywords, 1);
  const items = [...first.items];
  const pages = Math.min(maxPages, Math.ceil(first.total / PAGE_SIZE));
  let newestAt = first.newestAt;
  let page = 2;
  for (; page <= pages && !(since && newestAt < since) && Date.now() < deadline; page++) {
    const next = await fetchPage(keywords, page);
    items.push(...next.items);
    newestAt = next.newestAt;
  }
  const complete = page > pages || (since !== null && newestAt < since);
  return { items, seenThrough: complete && first.newestAt ? first.newestAt : null };
}
