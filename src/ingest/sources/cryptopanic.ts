import { createDecipheriv } from "node:crypto";
import { inflateSync } from "node:zlib";
import { BROWSER_USER_AGENT, SOURCES } from "../../config/sources.ts";
import { NEWS_SOURCES, type NewsItem } from "../../db/schema.ts";
import { asArray, asRecord, isRecord, readString, ShapeError, toHttpUrl } from "../../lib/validate.ts";
import { fetchJson, fetchWithLimits, UpstreamError } from "../http.ts";
import { mentionsNear, toPlainText, toPublisherName } from "./news-text.ts";

const CP = SOURCES.cryptopanic;

/** Post kinds that are news; "sponsored" posts are paid ads. */
const NEWS_KINDS = new Set(["link", "media"]);

/** Opens an anonymous session: the csrftoken cookie that every web API POST must echo back. */
async function createSession(): Promise<string> {
  const res = await fetchWithLimits(`${CP.baseUrl}/`, { headers: { "user-agent": BROWSER_USER_AGENT } });
  await res.body?.cancel();
  const token = res.headers.getSetCookie().join(";").match(/csrftoken=([^;]+)/)?.[1];
  if (!token) throw new UpstreamError("CryptoPanic sent no csrftoken cookie");
  return token;
}

/** Decrypts the `s` field of a posts response: AES-128-CBC with zero padding, IV = first 16 characters of
    "news" + csrftoken, then zlib-inflated JSON in columns `{ k: names, l: rows }`. */
function decryptPosts(s: string, csrf: string): Array<Record<string, unknown>> {
  const decipher = createDecipheriv("aes-128-cbc", Buffer.from(CP.aesKey, "utf8"), Buffer.from(`news${csrf}`.slice(0, 16), "utf8"));
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(Buffer.from(s, "base64")), decipher.final()]);
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end--;
  const table = asRecord(JSON.parse(inflateSync(padded.subarray(0, end)).toString("utf8")), "posts.s");
  const columns = asArray(table.k, "posts.s.k").map(String);
  return asArray(table.l, "posts.s.l").map((row, i) => {
    const values = asArray(row, `posts.s.l[${i}]`);
    return Object.fromEntries(columns.map((column, c) => [column, values[c]]));
  });
}

/** One CryptoPanic post as a story, or null for an ad or another kind of post. */
function postToNewsItem(post: Record<string, unknown>, i: number): NewsItem | null {
  const path = `posts[${i}]`;
  if (!NEWS_KINDS.has(String(post.kind)) || post.ad) return null;
  /** The id keys the stored story, so a missing or renamed one fails the run instead of merging every story into one row. */
  if (!(typeof post.pk === "number" && Number.isSafeInteger(post.pk)) && !(typeof post.pk === "string" && /^\d+$/.test(post.pk))) {
    throw new ShapeError(`${path}.pk`, "a post id");
  }
  const url = toHttpUrl(post.url);
  const published = Date.parse(readString(post, "published_at", path));
  if (!url || !Number.isFinite(published)) return null;
  const source = isRecord(post.source) ? post.source : {};
  const domain = String(post.domain ?? "");
  const publisher = toPublisherName(typeof source.title === "string" && source.title.trim() ? source.title : domain, domain);
  const title = toPlainText(readString(post, "title", path));
  const summary = (typeof post.body === "string" ? toPlainText(post.body) : "") || null;
  if (!mentionsNear(title, summary)) return null;
  const author = typeof post.author === "string" && post.author.trim() ? post.author.trim() : null;
  const tags = Array.isArray(post.currencies_codes) ? post.currencies_codes.filter((c): c is string => typeof c === "string") : [];
  return {
    id: `${NEWS_SOURCES.cryptopanic}-${String(post.pk)}`,
    source: "cryptopanic",
    title,
    summary,
    url,
    publisher,
    author,
    tags,
    publishedAt: new Date(published).toISOString(),
  };
}

/** NEAR news from CryptoPanic, newest first, in pages of about 50 posts, until a page reaches `since` (an ISO time), `maxPages`
    or `deadline` (unix ms); ads and passing mentions are dropped. `seenThrough`, the next run's `since`, is the first page's
    newest post once the run reached `since` or `maxPages`, or null when `deadline` or an empty page stopped it first. */
export async function fetchCryptoPanicNews(
  currency: string,
  since: string | null,
  maxPages: number,
  deadline: number,
): Promise<{ items: NewsItem[]; seenThrough: string | null }> {
  const csrf = await createSession();
  const sinceMs = since ? Date.parse(since) : -Infinity;
  const items: NewsItem[] = [];
  let newestMs = -Infinity;
  let complete = false;
  let page = 0;
  for (; page < maxPages && (page === 0 || Date.now() < deadline); page++) {
    const reply = await fetchJson(`${CP.baseUrl}/web-api/posts/`, {
      method: "POST",
      headers: {
        "user-agent": BROWSER_USER_AGENT,
        referer: `${CP.baseUrl}/`,
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "x-csrftoken": csrf,
        cookie: `csrftoken=${csrf}`,
      },
      body: `filters=${encodeURIComponent(JSON.stringify({ module: "news", currency, page }))}`,
    });
    const body = asRecord(reply, "posts");
    /** A reply without the encrypted posts string is a changed or refused API, not the end of the history, so the run
        fails before anything is stored. */
    if (typeof body.s !== "string") throw new ShapeError(`posts.s (page ${page + 1})`, "an encrypted posts string");
    const posts = decryptPosts(body.s, csrf);
    if (posts.length === 0) break;
    /** Without a post kind nothing counts as news, and the run would read every page without ever reaching `since`. */
    if (!posts.some((post) => typeof post.kind === "string")) throw new ShapeError(`posts.s (page ${page + 1})`, "posts with a kind");
    posts.forEach((post, i) => {
      const item = postToNewsItem(post, i);
      if (item) items.push(item);
    });
    /** Passing mentions count too, ads do not (a pinned ad can carry an old date). */
    const published = posts.flatMap((post) => (NEWS_KINDS.has(String(post.kind)) && !post.ad ? [Date.parse(String(post.published_at))] : [])).filter(Number.isFinite);
    if (page === 0) newestMs = Math.max(-Infinity, ...published);
    if (published.some((time) => time <= sinceMs)) {
      complete = true;
      break;
    }
  }
  return { items, seenThrough: (complete || page === maxPages) && Number.isFinite(newestMs) ? new Date(newestMs).toISOString() : null };
}
