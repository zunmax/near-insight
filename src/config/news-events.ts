const port = Number(process.env.NEWS_EVENTS_PORT ?? 8081);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("NEWS_EVENTS_PORT must be a port number");
const path = "/news-events";

/** WebSocket server in the ingest worker that pushes newly stored news to open pages. */
export const NEWS_EVENTS = {
  host: process.env.NEWS_EVENTS_HOST ?? "127.0.0.1",
  port,
  path,
  /** Address browsers connect to; behind a proxy in production, e.g. wss://example.com/news-events. */
  publicUrl: process.env.NEWS_EVENTS_URL || `ws://localhost:${port}${path}`,
  /** Latest stories sent to each page when it connects, so it catches up on anything stored while it was away. */
  snapshotSize: 25,
  /** Pings each connection this often and drops ones that did not answer the previous ping. */
  heartbeatMs: 30_000,
  /** Largest message accepted from a browser; pages never send any. */
  maxPayloadBytes: 1024,
  /** Most open connections; more are refused, so a flood of sockets cannot slow the worker that also runs every ingest job. */
  maxClients: 500,
  /** Most open connections from one address: a reader's open tabs, while one client cannot fill maxClients. */
  maxClientsPerAddress: 10,
} as const;
