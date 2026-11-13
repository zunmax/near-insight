/** The committed snapshot's MANIFEST.json and the SHA-256 check that snapshot/dashboard.db is the file it describes. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { MANIFEST_PATH, SNAPSHOT_PATH } from "../config/database.ts";

type SnapshotManifest = { sha256: string; dataThrough: string | null };

/** The manifest and the snapshot's actual SHA-256, or null when either file is missing. */
export function readSnapshot(): { manifest: SnapshotManifest; sha256: string } | null {
  if (!existsSync(SNAPSHOT_PATH) || !existsSync(MANIFEST_PATH)) return null;
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as SnapshotManifest;
  return { manifest, sha256: createHash("sha256").update(readFileSync(SNAPSHOT_PATH)).digest("hex") };
}

/** True when snapshot/dashboard.db exists and matches the SHA-256 in MANIFEST.json. */
export const snapshotMatchesManifest = () => {
  const snapshot = readSnapshot();
  return snapshot !== null && snapshot.sha256 === snapshot.manifest.sha256;
};
