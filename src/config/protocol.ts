/** Share of NEAR issuance paid to the protocol treasury. nearcore hard-codes 1/10 for mainnet
    (chain/epoch-manager/src/reward_calculator.rs); the RPC field `protocol_reward_rate` reads [0, 1] and must not be used. */
export const PROTOCOL_TREASURY_SHARE = 0.1;

/** Stake threshold that can halt BFT finality; used for the Nakamoto coefficient. */
export const HALTING_STAKE_SHARE = 1 / 3;

/** Mainnet epoch length in block heights (protocol config `epoch_length`); skipped heights can shift a boundary by a few. */
export const EPOCH_LENGTH = 43_200;

/** Gas used by a simple NEAR transfer to an existing account (Tgas). */
export const TRANSFER_TGAS = 0.446;

/** Shard cap of mainnet dynamic resharding (nearcore core/primitives/res/epoch_configs/mainnet/85.json). */
export const SHARD_CAP = 10;

/** Protocol version that removes the contract gas rebate, so 100% of gas is burned (HSP-027, `RemoveGasRewards`). */
export const FULL_BURN_PROTOCOL = 87;

/** Max issuance before nearcore 2.9.0 (protocol 81) halved it to 2.5% on MAX_ISSUANCE_HALVED_DAY. */
export const PREVIOUS_MAX_INFLATION = 0.05;

/** UTC day protocol 81 went live on mainnet and max issuance fell from 5% to 2.5% a year (the epoch from 18:56 UTC minted half). */
export const MAX_ISSUANCE_HALVED_DAY = "2025-10-29";

/** HSP-029 proposal: ramp max issuance to 1.6% over 24 months, starting 90 days after its vote's timelock ends
    (gov.near.org, 2026-10-07). `proposalId` is its id on the House of Stake voting contract. */
export const HSP029 = { targetRate: 0.016, graceDays: 90, rampMonths: 24, proposalId: 29 } as const;

/** UTC day NEAR's token vesting schedule ended, after which no locked NEAR remained to unlock. */
export const VESTING_END_DAY = "2025-10-13";

/** UTC day NEAR Intents fees started buying NEAR. */
export const BUYBACKS_START_DAY = "2026-02-23";
