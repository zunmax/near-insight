import type { IncomingMessage } from "node:http";
import { isIPv6 } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { WebSocketServer, type WebSocket } from "ws";
import { NEWS_EVENTS } from "../config/news-events.ts";
import { SITE } from "../config/site.ts";
import { NEWS_COLUMNS, toNewsItem, type NewsEvent } from "../db/news.ts";
import type { NewsItem } from "../db/schema.ts";

export type NewsEventServer = { broadcast: (items: NewsItem[]) => void; refresh: () => void; close: () => void };

const encode = (items: NewsItem[]) => JSON.stringify({ type: "news", items } satisfies NewsEvent);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isLoopback = (origin: string) => {
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
};

/** Whether a page from `origin` (the browser's Origin header) may connect: the site's own origin, or, while the site
    itself runs on this machine, any local origin, since a dev server may take another port. */
const allowedOrigin = (origin: string) => origin === SITE.url || (isLoopback(SITE.url) && isLoopback(origin));

/** The key one client's connections are counted under: an IPv4 address as it is, also when written IPv4-mapped, and an IPv6
    address by its /64 network, which one client usually holds whole. */
function addressKey(address: string): string {
  const plain = address.split("%")[0]!;
  const mapped = plain.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1]!;
  if (!isIPv6(plain)) return plain;
  const [head = "", tail = ""] = plain.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = plain.includes("::") ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((group) => group.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** Behind Caddy every connection comes from Caddy, so the client is the last X-Forwarded-For entry, the one Caddy writes. */
const clientAddress = (request: IncomingMessage) => {
  const forwarded = request.headers["x-forwarded-for"];
  return addressKey((typeof forwarded === "string" ? forwarded.split(",").at(-1)?.trim() : undefined) || request.socket.remoteAddress || "unknown");
};

/** Starts the WebSocket server that pushes the latest stories on connect, then every story the worker stores, to pages from
    the site's origin only, up to maxClients at a time and maxClientsPerAddress from one address (NEWS_EVENTS). Rejects if
    the port cannot be bound, e.g. when another worker is running. */
export async function startNewsEvents(db: DatabaseSync): Promise<NewsEventServer> {
  /** Open connections by client address, so one client cannot take every slot of maxClients. */
  const perAddress = new Map<string, number>();
  /** Limits are checked before the upgrade, so a refused client never holds a socket or counts as connected. */
  const server = new WebSocketServer({
    host: NEWS_EVENTS.host,
    port: NEWS_EVENTS.port,
    path: NEWS_EVENTS.path,
    maxPayload: NEWS_EVENTS.maxPayloadBytes,
    verifyClient: ({ origin, req }: { origin: string; req: IncomingMessage }, done: (accept: boolean, code?: number, message?: string) => void) => {
      if (!allowedOrigin(origin)) return done(false, 403);
      const full = server.clients.size >= NEWS_EVENTS.maxClients || (perAddress.get(clientAddress(req)) ?? 0) >= NEWS_EVENTS.maxClientsPerAddress;
      done(!full, 503, "Too many connections");
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  /** Errors after start (e.g. too many open files) are logged, not thrown, so they cannot stop the ingest jobs. */
  server.on("error", (error) => console.error(`[news-events] ${error.message}`));

  const latest = db.prepare(`SELECT ${NEWS_COLUMNS} FROM news_items ORDER BY published_at DESC LIMIT ?`);
  /** The connect snapshot is encoded once and again only after new stories are stored, not once per connection. */
  let snapshot: string | null = null;
  const alive = new WeakMap<WebSocket, boolean>();
  server.on("connection", (socket, request) => {
    const address = clientAddress(request);
    perAddress.set(address, (perAddress.get(address) ?? 0) + 1);
    socket.on("close", () => {
      const left = (perAddress.get(address) ?? 1) - 1;
      if (left > 0) perAddress.set(address, left);
      else perAddress.delete(address);
    });
    alive.set(socket, true);
    socket.on("pong", () => alive.set(socket, true));
    /** A failed socket is closed by ws; the error only needs handling so it does not stop the worker. */
    socket.on("error", () => socket.terminate());
    snapshot ??= encode(latest.all(NEWS_EVENTS.snapshotSize).map(toNewsItem));
    socket.send(snapshot);
  });

  const heartbeat = setInterval(() => {
    for (const socket of server.clients) {
      if (!alive.get(socket)) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, NEWS_EVENTS.heartbeatMs);

  return {
    broadcast(items) {
      if (items.length === 0) return;
      snapshot = null;
      const message = encode(items);
      for (const socket of server.clients) if (socket.readyState === socket.OPEN) socket.send(message);
    },
    /** Re-reads the connect snapshot on the next connection, after stored stories were edited or deleted. */
    refresh() {
      snapshot = null;
    },
    close() {
      clearInterval(heartbeat);
      for (const socket of server.clients) socket.terminate();
      server.close();
    },
  };
}
