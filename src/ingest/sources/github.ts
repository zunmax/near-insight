import { SOURCES } from "../../config/sources.ts";
import type { Release } from "../../db/schema.ts";
import { asArray, asRecord, readString, toHttpUrl } from "../../lib/validate.ts";
import { fetchJson, fetchWithLimits, UpstreamError } from "../http.ts";

const HEADERS = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };

/** The 50 most recently created nearcore releases, including release candidates; a release without an http(s) link is left
    out. GitHub orders them by creation, so a release published late can be missing while older ones are listed. */
export async function fetchNearcoreReleases(): Promise<Release[]> {
  const path = "/repos/near/nearcore/releases?per_page=50";
  const rows = asArray(await fetchJson(`${SOURCES.github.baseUrl}${path}`, { headers: HEADERS }), path);
  return rows.flatMap((row, i) => {
    const at = `${path}[${i}]`;
    const r = asRecord(row, at);
    const url = toHttpUrl(r.html_url);
    if (r.draft === true || typeof r.published_at !== "string" || !url) return [];
    return [
      {
        tag: readString(r, "tag_name", at),
        name: typeof r.name === "string" && r.name ? r.name : readString(r, "tag_name", at),
        publishedAt: r.published_at,
        prerelease: r.prerelease === true,
        url,
      },
    ];
  });
}

/** Whether the nearcore release `tag` still exists; false only when GitHub answers 404 for it. */
export async function nearcoreReleaseExists(tag: string): Promise<boolean> {
  try {
    const res = await fetchWithLimits(`${SOURCES.github.baseUrl}/repos/near/nearcore/releases/tags/${encodeURIComponent(tag)}`, { headers: HEADERS });
    await res.body?.cancel();
    return true;
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return false;
    throw error;
  }
}
