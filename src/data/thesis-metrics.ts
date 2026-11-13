import "server-only";
import { cacheLife } from "next/cache";
import { activityMetrics } from "@/data/thesis-metrics/activity";
import { dataChecksMetrics } from "@/data/thesis-metrics/data-checks";
import { flowContext } from "@/data/thesis-metrics/flow-context";
import { loadThesisInputs } from "@/data/thesis-metrics/inputs";
import { getLeadLag } from "@/data/lead-lag";
import { latestLiveSampleAt } from "@/data/live";
import { dexShareMetrics, intentsMetrics, intentsTvlMetrics, intentsTxnShareMetrics } from "@/data/thesis-metrics/intents";
import { marketMetrics, peersMetrics } from "@/data/thesis-metrics/market";
import { protocolMetrics, stakingMetrics, technologyMetrics } from "@/data/thesis-metrics/network";
import { buybacksMetrics, feeChainMetrics, feeWalletsMetrics, feeWalletWindow } from "@/data/thesis-metrics/revenue";
import { absorptionMetrics, issuanceMetrics, supplyMetrics, treasuryMetrics, treasuryWindow } from "@/data/thesis-metrics/supply";
import type { ThesisMetrics } from "@/data/thesis-metrics/types";
import { breakEvenMetrics, networkRevenue, revenueMultipleMetrics, seedMetrics, valuationMetrics } from "@/data/thesis-metrics/valuation";

export type { ThesisMetrics } from "@/data/thesis-metrics/types";

/** Every number the thesis pages, the projections and the model need, computed from the database in one pass. */
export async function getThesisMetrics(): Promise<ThesisMetrics> {
  "use cache";
  cacheLife("db");

  const inputs = await loadThesisInputs();
  const flow = flowContext(inputs);
  const seed = seedMetrics(inputs, flow);
  const issuance = issuanceMetrics(inputs, flow);
  const wallets = feeWalletWindow(inputs, flow);
  const treasury = treasuryWindow(inputs, flow);
  const revenue = networkRevenue(inputs);
  const absorption = absorptionMetrics(inputs, flow);

  return {
    market: marketMetrics(inputs),
    supply: supplyMetrics(inputs),
    staking: stakingMetrics(inputs, flow, issuance?.rate30d ?? null),
    dataThrough: flow.throughDay,
    flowsCurrent: flow.current,
    readAt: latestLiveSampleAt(),
    seed,
    issuance,
    absorption,
    intents: intentsMetrics(inputs, flow),
    intentsTvl: intentsTvlMetrics(inputs),
    buybacks: buybacksMetrics(inputs, flow),
    valuation: valuationMetrics(inputs, flow, seed),
    feeChain: feeChainMetrics(inputs, flow),
    dexShare: dexShareMetrics(inputs, flow),
    intentsTxnShare: intentsTxnShareMetrics(inputs),
    intentsReach: inputs.intentsReach,
    activity: activityMetrics(inputs),
    feeWallets: feeWalletsMetrics(inputs, flow, wallets),
    breakEven: breakEvenMetrics(inputs, flow),
    dataChecks: dataChecksMetrics(inputs, flow, wallets, treasury, revenue),
    treasury: treasuryMetrics(inputs, treasury),
    revenueMultiple: revenueMultipleMetrics(inputs, revenue),
    hsp029: inputs.hsp029,
    leadLag: await getLeadLag(flow.throughDay),
    protocol: protocolMetrics(inputs),
    technology: technologyMetrics(inputs),
    peers: peersMetrics(inputs),
  };
}
