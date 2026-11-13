import { HSP029 } from "@/config/protocol";
import { formatDateTimeUtc, formatPercent } from "@/lib/format";
import type { ProjectionSeed } from "@/lib/projection";

/** How the projections burn gas fees: all of them once mainnet pays none to contracts, otherwise the measured share. */
export function burnNote(seed: ProjectionSeed): string {
  return seed.fullBurn
    ? "all gas fees burned, because mainnet no longer pays part of the gas to contracts"
    : `the measured share of gas fees burned over those days (${formatPercent(seed.burnShareOfFees, 0)})`;
}

/** "All NEAR is burned or bought by month 29" once a projection has taken every NEAR there is, otherwise null. */
export function usedUpNote(rows: Array<{ month: number; availableNear: number }>): string | null {
  const month = rows.find((row) => row.availableNear === 0)?.month;
  return month === undefined ? null : `All NEAR is burned or bought by month ${month}`;
}

/** When HSP-029's ramp starts in the projections; a vote that can no longer take effect dates no ramp, so it is a what-if. */
export function rampNote(seed: ProjectionSeed, voteFailed: boolean): string {
  const ramp = `a ${HSP029.rampMonths}-month ramp to ${formatPercent(HSP029.targetRate, 1)}`;
  if (voteFailed) return `${ramp} starting ${HSP029.graceDays} days after ${seed.through}, as a what-if, since the vote ended without taking effect`;
  return seed.hsp029Ramp.startsAt === null
    ? `${ramp} starting ${HSP029.graceDays} days after the vote's timelock ends (counted from ${seed.through} until it is known)`
    : `${ramp} that starts ${formatDateTimeUtc(seed.hsp029Ramp.startsAt)}, ${HSP029.graceDays} days after the vote's timelock ends`;
}
