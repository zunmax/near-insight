/** The query behind every chart: read-only SQL on the SQLite database, the requests that filled its tables and the code that
    calculates further. Shown on /dashboard/queries, run by GET /api/query/<id> and `npm run query -- <id>`; only these
    statements ever run, and nothing a visitor sends is executed. */
import { HOME_QUERIES } from "./home.ts";
import type { NamedQuery } from "./named-query.ts";
import { NETWORK_QUERIES } from "./network.ts";
import { PEER_QUERIES } from "./peers.ts";
import { REVENUE_QUERIES } from "./revenue.ts";
import { SUPPLY_QUERIES } from "./supply.ts";
import { TECHNOLOGY_QUERIES } from "./technology.ts";
import { USAGE_QUERIES } from "./usage.ts";
import { VALUATION_QUERIES } from "./valuation.ts";

/** Every query, grouped by the page that shows it in sidebar order; /dashboard/queries and `npm run query` list them in this order. */
export const NAMED_QUERIES: NamedQuery[] = [
  ...HOME_QUERIES,
  ...USAGE_QUERIES,
  ...REVENUE_QUERIES,
  ...SUPPLY_QUERIES,
  ...VALUATION_QUERIES,
  ...NETWORK_QUERIES,
  ...TECHNOLOGY_QUERIES,
  ...PEER_QUERIES,
];

export const namedQuery = (id: string) => NAMED_QUERIES.find((query) => query.id === id);
