/** The shape of one ingest job: its name, its interval and the run that stores data and returns rows written. */
import type { DatabaseSync } from "node:sqlite";
import type { JobName } from "../../db/schema.ts";

export type Job = {
  name: JobName;
  everyMs: number;
  run: (db: DatabaseSync) => Promise<number>;
  /** True while the job's history is not yet stored back to its first day; a one-off run repeats the job until it is false. */
  backlog?: (db: DatabaseSync) => boolean;
};
