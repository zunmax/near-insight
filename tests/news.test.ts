import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { NewsItem } from "../src/db/schema.ts";
import { addNewStories, groupNewsByDay, readNewsEvent, STORY_ID, storyHref } from "../src/lib/news.ts";

/** A CryptoPanic story published at `publishedAt`, with `change` applied. */
const story = (id: string, publishedAt: string, change: Partial<NewsItem> = {}): NewsItem => ({
  id,
  source: "cryptopanic",
  title: `Story ${id}`,
  summary: null,
  url: `https://example.com/${id}`,
  publisher: "Example",
  author: null,
  tags: [],
  publishedAt,
  ...change,
});

const ids = (items: NewsItem[]) => items.map((item) => item.id);

describe("STORY_ID", () => {
  test("accepts a known source prefix and 1 to 15 digits", () => {
    for (const id of ["cp-1", "cc-123", "cp-123456789012345"]) assert.match(id, STORY_ID);
  });

  test("rejects other prefixes, other characters and more than 15 digits", () => {
    for (const id of ["xx-1", "CP-1", "cp-", "cp-12a", " cp-1", "cp-1 ", "cp-1234567890123456", "cp-1/../2"]) assert.doesNotMatch(id, STORY_ID);
  });
});

describe("storyHref", () => {
  test("links to the story page with the id encoded", () => {
    assert.equal(storyHref("cp-123"), "/dashboard/news/story?id=cp-123");
    assert.equal(storyHref("a b&c=d"), "/dashboard/news/story?id=a%20b%26c%3Dd");
  });
});

describe("addNewStories", () => {
  const shown = [story("cp-3", "2026-11-03T00:00:00Z"), story("cp-2", "2026-11-02T00:00:00Z")];

  test("adds stories not shown yet, newest first, and counts them", () => {
    const result = addNewStories(shown, [story("cp-4", "2026-11-04T00:00:00Z"), story("cp-2", "2026-11-02T00:00:00Z")], 5);
    assert.deepEqual(ids(result.items), ["cp-4", "cp-3", "cp-2"]);
    assert.equal(result.added, 1);
  });

  test("adds an older story while the list is not full", () => {
    const result = addNewStories(shown, [story("cp-1", "2026-11-01T00:00:00Z")], 5);
    assert.deepEqual(ids(result.items), ["cp-3", "cp-2", "cp-1"]);
    assert.equal(result.added, 1);
  });

  test("once the list is full, adds only stories newer than its last one", () => {
    const incoming = [story("cp-1", "2026-11-01T00:00:00Z"), story("cp-5", "2026-11-02T00:00:00Z"), story("cp-6", "2026-11-02T12:00:00Z")];
    const result = addNewStories(shown, incoming, 2);
    assert.deepEqual(ids(result.items), ["cp-3", "cp-6"]);
    assert.equal(result.added, 1);
  });

  test("keeps the newest `limit` stories while counting every story added", () => {
    const result = addNewStories(shown, [story("cp-4", "2026-11-04T00:00:00Z"), story("cp-1", "2026-11-01T00:00:00Z")], 3);
    assert.deepEqual(ids(result.items), ["cp-4", "cp-3", "cp-2"]);
    assert.equal(result.added, 2);
  });

  test("adds only stories whose title, summary, publisher or tag contains the query, ignoring case", () => {
    const incoming = [
      story("cp-10", "2026-11-05T00:00:00Z", { title: "NEAR Intents grows" }),
      story("cp-11", "2026-11-05T00:00:00Z", { summary: "about near" }),
      story("cp-12", "2026-11-05T00:00:00Z", { publisher: "Near Daily" }),
      story("cp-13", "2026-11-05T00:00:00Z", { tags: ["NEAR"] }),
      story("cp-14", "2026-11-05T00:00:00Z", { title: "Bitcoin" }),
    ];
    const result = addNewStories([], incoming, 10, "near");
    assert.deepEqual(ids(result.items).sort(), ["cp-10", "cp-11", "cp-12", "cp-13"]);
    assert.equal(result.added, 4);
  });

  test("returns the same list and 0 when nothing is added", () => {
    const result = addNewStories(shown, [story("cp-3", "2026-11-03T00:00:00Z")], 5);
    assert.equal(result.items, shown);
    assert.equal(result.added, 0);
    assert.equal(addNewStories(shown, [], 5).items, shown);
  });
});

describe("groupNewsByDay", () => {
  const now = Date.parse("2026-11-14T10:00:00Z");

  test("labels UTC days as Today, Yesterday or their date, keeping the stories' order", () => {
    const items = [
      story("cp-4", "2026-11-14T09:00:00Z"),
      story("cp-3", "2026-11-14T00:00:00Z"),
      story("cp-2", "2026-11-13T23:59:00Z"),
      story("cp-1", "2026-11-10T08:00:00Z"),
    ];
    assert.deepEqual(
      groupNewsByDay(items, now).map((day) => [day.label, ids(day.items)]),
      [
        ["Today", ["cp-4", "cp-3"]],
        ["Yesterday", ["cp-2"]],
        ["Nov 10", ["cp-1"]],
      ],
    );
  });

  test("dates the labels by `nowMs`, so a day after midnight reads Yesterday", () => {
    const labels = groupNewsByDay([story("cp-1", "2026-11-14T09:00:00Z")], Date.parse("2026-11-15T00:00:00Z")).map((day) => day.label);
    assert.deepEqual(labels, ["Yesterday"]);
  });

  test("returns no days for no stories", () => {
    assert.deepEqual(groupNewsByDay([], now), []);
  });
});

describe("readNewsEvent", () => {
  const valid = story("cc-7", "2026-11-14T09:00:00.000Z", { source: "chaincatcher", summary: "text", author: "A", tags: ["near"] });
  const message = (items: unknown[]) => JSON.stringify({ type: "news", items });

  test("returns the stories of a news message", () => {
    assert.deepEqual(readNewsEvent(message([valid])), [valid]);
    assert.deepEqual(readNewsEvent(message([])), []);
  });

  test("leaves out malformed stories and keeps the rest", () => {
    const malformed = [
      { ...valid, url: "javascript:alert(1)" },
      { ...valid, url: "/relative" },
      { ...valid, id: "xx-1" },
      { ...valid, source: "unknown" },
      { ...valid, source: "toString" },
      { ...valid, tags: ["near", 1] },
      { ...valid, publishedAt: "not a date" },
      { ...valid, author: undefined },
      { ...valid, title: 5 },
      null,
      "cc-7",
    ];
    assert.deepEqual(readNewsEvent(message([...malformed, valid])), [valid]);
  });

  test("returns null for anything that is not a news message", () => {
    assert.equal(readNewsEvent("not json"), null);
    assert.equal(readNewsEvent(JSON.stringify({ type: "ping", items: [] })), null);
    assert.equal(readNewsEvent(JSON.stringify({ type: "news", items: {} })), null);
    assert.equal(readNewsEvent(JSON.stringify([{ type: "news", items: [] }])), null);
    assert.equal(readNewsEvent("null"), null);
  });
});
