/** Staking and validator figures, live protocol versions and the cost of a transfer. */
import { HALTING_STAKE_SHARE, PROTOCOL_TREASURY_SHARE, TRANSFER_TGAS } from "@/config/protocol";
import { gasCostNear, grossStakingYield, nakamotoCoefficient, realYield, seatPrices } from "@/lib/metrics";
import type { FlowContext } from "./flow-context";
import type { ThesisInputs } from "./inputs";
import type { ThesisMetrics } from "./types";

/** `issuanceRate30d`: NEAR minted over the last 30 days as a yearly rate of supply, null until minted NEAR covers them. The
    yields need only NEAR minted and burned over those days, so a missing day of buybacks leaves them shown. */
export function stakingMetrics({ network, validatorSet, minted, burnt }: ThesisInputs, { covered, sum }: FlowContext, issuanceRate30d: number | null): ThesisMetrics["staking"] {
  const staked = validatorSet?.validators.reduce((total, v) => total + v.stakeNear, 0) ?? 0;
  const seats = validatorSet && network ? seatPrices(validatorSet.validators, network.minimumStakeRatio) : null;
  const mintedNear = covered(minted, 30) && covered(burnt, 30) ? sum(minted, 30) : 0;
  /** Measured rewards: the NEAR minted over 30 days, a year's worth, less the treasury's share, spread over the NEAR staked. */
  const grossYield = mintedNear > 0 ? grossStakingYield((mintedNear * 365) / 30, PROTOCOL_TREASURY_SHARE, staked) : null;
  /** Total supply growth over the same days: minted less burned (bought NEAR stays in total supply). */
  const supplyGrowth = issuanceRate30d !== null && mintedNear > 0 ? issuanceRate30d * (1 - sum(burnt, 30) / mintedNear) : null;
  return network && validatorSet && seats
    ? {
        stakedShare: staked / network.totalSupplyNear,
        grossYield,
        realYield: grossYield === null || supplyGrowth === null ? null : realYield(grossYield, supplyGrowth),
        validators: validatorSet.validators.length,
        nakamoto: nakamotoCoefficient(
          validatorSet.validators.map((v) => v.stakeNear),
          HALTING_STAKE_SHARE,
        ),
        chunkValidatorSeatNear: seats.chunkValidatorNear,
        blockProducerSeatNear: seats.blockProducerNear,
        producers: seats.producers,
        epochHeight: validatorSet.epochHeight,
      }
    : null;
}

export function protocolMetrics({ versions }: ThesisInputs): ThesisMetrics["protocol"] {
  return versions ? { mainnet: versions.mainnet, testnet: versions.testnet, fetchedAt: versions.fetchedAt } : null;
}

export function technologyMetrics({ market, network }: ThesisInputs): ThesisMetrics["technology"] {
  const near = market?.near;
  if (!near || !network) return null;
  const transferCostNear = gasCostNear(network.gasPriceYocto, TRANSFER_TGAS);
  return { transferCostNear, transferCostUsd: transferCostNear * near.priceUsd, gasPriceReadAt: network.fetchedAt };
}
