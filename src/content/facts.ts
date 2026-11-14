/** Dated facts no free API returns; each fact names its source and the date it was published or checked. */

export type Fact = { label: string; value: string; source: string };

export const TECHNOLOGY_FACTS: Fact[] = [
  { label: "Stateless validation", value: "Live since August 2024 (protocol 69)", source: "nearcore 2.0.0 (checked 2026-10-21)" },
  { label: "Lab benchmark", value: "1M TPS on 70 shards, 140 nodes, native transfers", source: "NEAR One blog (2025-12-11)" },
  { label: "Peak recorded on mainnet", value: "4,135 TPS (100-block window)", source: "Chainspect (checked 2026-10-21)" },
  {
    label: "Post-quantum keys",
    value: "ML-DSA-65 keys live since July 2026; in-contract verification added in protocol 87",
    source: "nearcore 2.13.0; nearcore 2.14.0, released 2026-10-26",
  },
  { label: "SPICE (200 ms blocks)", value: "In development", source: "nearcore version.rs (checked 2026-10-21)" },
];

/** Fees on a NEAR Intents swap: the contract's protocol fee and the fees of the two apps whose revenue buys NEAR. */
export const INTENTS_FEES = {
  contract: { label: "intents.near contract", value: "1 pip (0.0001%) a swap", source: "NEAR Intents docs, Fees (2026-11-03)" },
  app: { label: "near-intents.org app", value: "0.2% a swap", source: "NEAR Intents docs, Fees (2026-11-03)" },
  oneClick: { label: "1Click API", value: "0.25% without an API key, 0.2% with one; 0.01% on stablecoin pairs", source: "NEAR Intents docs, Fees (2026-11-14)" },
} satisfies Record<string, Fact>;

/** NEAR account features, from docs.near.org. */
export const ACCOUNT_FACTS: Fact[] = [
  {
    label: "Chain Signatures",
    value: "A multi-party computation (MPC) network, v1.signer, lets any NEAR account, contracts included, sign native transactions for Bitcoin, EVM chains, Solana and others",
    source: "docs.near.org, Chain Signatures (2026-11-03)",
  },
  { label: "Named accounts", value: "Human-readable account names such as alice.near, beside 64-character implicit accounts", source: "docs.near.org, Access keys (2026-11-03)" },
  { label: "Function-call keys", value: "Keys limited to one contract, optionally to a list of its methods, with a gas allowance", source: "docs.near.org, Access keys (2026-11-03)" },
  { label: "Relayer-paid gas", value: "Meta transactions (NEP-366): a relayer pays the gas, so users need no NEAR to transact", source: "docs.near.org, Meta transactions (2026-11-03)" },
];

/** A published NEAR price-to-revenue multiple, checked against the same multiple from this dashboard's data: market cap on
    `marketCapDay` ÷ the `revenueDays` days of NEAR Intents revenue plus gas fees to `revenueThrough`, annualized. */
export const PUBLISHED_REVENUE_MULTIPLE = {
  multiple: 181,
  marketCapDay: "2026-10-25",
  revenueThrough: "2026-10-21",
  revenueDays: 30,
  source: "Blockworks Research, “NEAR: Priced for Intents, Built for AI” (data as of 2026-10-25)",
} as const;

/** NEAR's sectors, shown as chips under the Home page title (RootData's sector tags for NEAR Protocol, checked 2026-11-11). */
export const NEAR_SECTORS = ["Layer1", "AI", "Infra"] as const;

/** Time to finality on NEAR mainnet, in seconds. */
export const FINALITY_SECONDS = { value: 1.2, source: "Chainspect, NEAR mainnet (2026-10-21)" } as const;
