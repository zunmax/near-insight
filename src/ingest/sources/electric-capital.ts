import { asyncBufferFromUrl, parquetMetadataAsync, parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { DEVELOPER_ECOSYSTEMS, SOURCES } from "../../config/sources.ts";
import { asArray, asRecord, readNumber, readString, ShapeError } from "../../lib/validate.ts";
import type { DayValue } from "../days.ts";
import { fetchJson, fetchWithLimits } from "../http.ts";

type EcosystemKey = keyof typeof DEVELOPER_ECOSYSTEMS;

type DeveloperSnapshot = {
  version: string;
  series: Record<EcosystemKey, { all: DayValue[]; fullTime: DayValue[] }>;
};

/** Monthly active developers per ecosystem from Electric Capital's eco_mads.parquet, first day of every month only.
    Reads four columns, one row group at a time, over HTTP range requests (about 26 MB of the 77 MB file).
    Returns null if `knownVersion` is current. */
export async function fetchDeveloperSnapshot(knownVersion: string | null): Promise<DeveloperSnapshot | null> {
  const base = SOURCES.electricCapital.baseUrl;
  const dataset = asRecord(asRecord(await fetchJson(`${base}/manifest.json`), "manifest").dataset, "manifest.dataset");
  const version = readString(dataset, "version", "manifest.dataset");
  if (version === knownVersion) return null;

  const resource = asArray(dataset.resources, "manifest.dataset.resources")
    .map((r, i) => asRecord(r, `manifest.dataset.resources[${i}]`))
    .find((r) => typeof r.path === "string" && r.path.endsWith("/eco_mads.parquet"));
  if (!resource) throw new Error("eco_mads.parquet is missing from the Electric Capital manifest");

  const file = await asyncBufferFromUrl({
    url: `${base}${readString(resource, "path", "eco_mads resource")}`,
    byteLength: readNumber(resource, "size_bytes", "eco_mads resource"),
    fetch: fetchWithLimits as typeof fetch,
  });
  const metadata = await parquetMetadataAsync(file);
  const keyById = new Map<number, EcosystemKey>(
    (Object.entries(DEVELOPER_ECOSYSTEMS) as Array<[EcosystemKey, number]>).map(([key, id]) => [id, key]),
  );
  const rowsByKey = new Map<EcosystemKey, Map<string, { all: number; fullTime: number }>>();

  let rowStart = 0;
  for (const group of metadata.row_groups) {
    const rowEnd = rowStart + Number(group.num_rows);
    await parquetRead({
      file,
      metadata,
      compressors,
      rowStart,
      rowEnd,
      columns: ["ecosystem_id", "day", "all_devs", "full_time_devs"],
      onComplete: (rows: unknown[][]) => {
        for (const [ecosystemId, day, all, fullTime] of rows) {
          const key = keyById.get(Number(ecosystemId));
          /** A month with a count missing is left out rather than stored as 0 developers. */
          if (!key || !(day instanceof Date) || all == null || fullTime == null) continue;
          const days = rowsByKey.get(key) ?? new Map();
          days.set(day.toISOString().slice(0, 10), { all: Number(all), fullTime: Number(fullTime) });
          rowsByKey.set(key, days);
        }
      },
    });
    rowStart = rowEnd;
  }

  const series = {} as DeveloperSnapshot["series"];
  for (const [id, key] of keyById) {
    const days = [...(rowsByKey.get(key) ?? new Map<string, { all: number; fullTime: number }>()).entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const kept = days.filter(([day]) => day.endsWith("-01"));
    /** An ecosystem without monthly rows is a misread file, so the job fails and does not mark this version as stored. */
    if (kept.length === 0) throw new ShapeError(`eco_mads.parquet ecosystem ${id}`, "monthly rows");
    series[key] = {
      all: kept.map(([day, v]) => ({ day, value: v.all })),
      fullTime: kept.map(([day, v]) => ({ day, value: v.fullTime })),
    };
  }
  return { version, series };
}
