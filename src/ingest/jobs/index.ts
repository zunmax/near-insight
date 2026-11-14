/** Every ingest job, grouped by the service it calls, with the news event emitter and the job type the runner uses. */
import { SOURCES } from "../../config/sources.ts";
import { marketsJob, nearPriceJob, peerSupplyJob } from "./coingecko.ts";
import { coinPricesJob, defillamaJob } from "./defillama.ts";
import { duneJob } from "./dune.ts";
import { developersJob } from "./electric-capital.ts";
import { releasesJob } from "./github.ts";
import { intentsExplorerJob } from "./intents-explorer.ts";
import type { Job } from "./job.ts";
import { epochsJob, governanceJob, liveBlockJob, networkJob, validatorsJob } from "./near.ts";
import { nearblocksJob } from "./nearblocks.ts";
import { chaincatcherNewsJob, cryptopanicNewsJob } from "./news.ts";

export type { Job } from "./job.ts";
export { newsEvents } from "./news.ts";

/** Jobs grouped by the service they mainly call. On start the groups run side by side and the jobs of a group run in order,
    so no rate-limited service (CoinGecko, NearBlocks, DefiLlama, Dune) gets two first runs at once;
    peer supply runs after markets has stored the ranks. The Explorer API job runs only with its partner key. */
export const JOB_GROUPS: Job[][] = [
  [liveBlockJob, networkJob, validatorsJob, governanceJob],
  [marketsJob, nearPriceJob, peerSupplyJob],
  [nearblocksJob],
  [duneJob],
  ...(SOURCES.intentsExplorer.apiKey ? [[intentsExplorerJob]] : []),
  [defillamaJob, coinPricesJob],
  [releasesJob],
  [developersJob],
  [cryptopanicNewsJob],
  [chaincatcherNewsJob],
  [epochsJob],
];
