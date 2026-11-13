import { setTimeout as wait } from "node:timers/promises";
import { HTTP_LIMITS } from "../config/sources.ts";
import { isRecord, ShapeError } from "../lib/validate.ts";

export class UpstreamError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/** A JSON-RPC error answer; `causeName` is the node's error cause, e.g. UNKNOWN_BLOCK for a height with no block. */
export class RpcError extends UpstreamError {
  readonly causeName: string | null;

  constructor(message: string, causeName: string | null) {
    super(message);
    this.name = "RpcError";
    this.causeName = causeName;
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Statuses nearcore answers JSON-RPC request and handler errors with; their body names the error, so it is read like a success. */
const RPC_ERROR_STATUS = new Set([400, 422]);
const USER_AGENT = "near-insights/1.0.0";

/** Runs calls to one host one at a time, each starting at least `gapMs` after the previous one ended, also across jobs. Times
    are on the monotonic clock, so a change of the system clock never stalls a call. */
export function serialGate(gapMs: number): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<void> = Promise.resolve();
  let lastEnd = -Infinity;
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(async () => {
      const delay = lastEnd + gapMs - performance.now();
      if (delay > 0) await wait(delay);
      try {
        return await task();
      } finally {
        lastEnd = performance.now();
      }
    });
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/** Starts calls to one host evenly spaced, at most `perMinute` a minute, also across jobs, on the monotonic clock. Calls may
    overlap, so a host that answers slowly still gets its full rate when several calls are waiting. */
export function rateGate(perMinute: number): <T>(task: () => Promise<T>) => Promise<T> {
  const spacingMs = 60_000 / perMinute;
  let nextStart = -Infinity;
  return async <T>(task: () => Promise<T>): Promise<T> => {
    const start = Math.max(performance.now(), nextStart);
    nextStart = start + spacingMs;
    const delay = start - performance.now();
    if (delay > 0) await wait(delay);
    return task();
  };
}

/** The wait a Retry-After header asks for, given in seconds or as an HTTP date; null when it is missing, zero, past or unreadable,
    so a 429 with "Retry-After: 0" (FastNEAR's) waits HTTP_LIMITS.rateLimitDelayMs for its rate window to move on. */
function retryAfterDelayMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** One request with a per-attempt timeout, a User-Agent and bounded retries on network errors, timeouts and retryable statuses
    (Retry-After, else HTTP_LIMITS.rateLimitDelayMs on a 429, at least `minRetryDelayMs`; a spent quota is not retried). A status in
    `readStatuses` is read like a success. Throws UpstreamError, or ShapeError for a body that is not JSON. */
async function requestWithLimits<T>(
  url: string,
  init: RequestInit,
  read: (res: Response) => Promise<T>,
  minRetryDelayMs: number,
  readStatuses: ReadonlySet<number> = new Set(),
): Promise<T> {
  const host = new URL(url).host;
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
  let lastError: unknown;
  let delay: number = HTTP_LIMITS.retryBaseDelayMs;

  for (let attempt = 0; attempt <= HTTP_LIMITS.retries; attempt++) {
    if (attempt > 0) await wait(Math.max(delay, minRetryDelayMs));
    try {
      const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(HTTP_LIMITS.timeoutMs) });
      if (res.ok || readStatuses.has(res.status)) return await read(res);
      const retryAfterHeader = res.headers.get("retry-after");
      lastError = new UpstreamError(`${host} responded ${res.status}${retryAfterHeader ? ` (retry-after ${retryAfterHeader.slice(0, 40)})` : ""}`, res.status);
      await res.body?.cancel();
      if (!RETRYABLE_STATUS.has(res.status) || res.headers.get("x-ratelimit-remaining") === "0") break;
      const retryAfterMs = retryAfterDelayMs(retryAfterHeader);
      delay =
        retryAfterMs !== null
          ? Math.min(retryAfterMs, 60_000)
          : res.status === 429
            ? Math.max(delay * 2, HTTP_LIMITS.rateLimitDelayMs)
            : delay * 2;
    } catch (error) {
      if (error instanceof SyntaxError) throw new ShapeError(host, "a valid JSON body");
      lastError = error;
      delay *= 2;
    }
  }

  throw lastError instanceof UpstreamError ? lastError : new UpstreamError(`${host} did not respond`);
}

/** fetch through requestWithLimits; the caller reads the body. Signature-compatible with global fetch for string URLs.
    `minRetryDelayMs` is the source's pacing gap, so a retry keeps it. */
export function fetchWithLimits(url: string, init: RequestInit = {}, minRetryDelayMs = 0): Promise<Response> {
  return requestWithLimits(url, init, async (res) => res, minRetryDelayMs);
}

/** Fetches and parses JSON through requestWithLimits, so a body that times out is retried like the request. */
export function fetchJson(url: string, init: RequestInit = {}, minRetryDelayMs = 0): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  return requestWithLimits(url, { ...init, headers }, (res) => res.json(), minRetryDelayMs);
}

/** Sends one JSON-RPC 2.0 request and returns its `result`; an error answer throws RpcError with the node's error cause, e.g.
    UNKNOWN_BLOCK. `minRetryDelayMs` is the source's pacing gap, so a retry keeps it. */
export async function rpcCall(url: string, method: string, params: unknown, headers: Record<string, string> = {}, minRetryDelayMs = 0): Promise<unknown> {
  const body = await requestWithLimits(
    url,
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: "ingest", method, params }),
    },
    (res) => res.json(),
    minRetryDelayMs,
    RPC_ERROR_STATUS,
  );
  if (!isRecord(body) || !("result" in body)) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    const reason = error ? String(error.message ?? "error") : "no result";
    const causeName = error && isRecord(error.cause) && typeof error.cause.name === "string" ? error.cause.name : null;
    throw new RpcError(`RPC ${method}: ${reason}${causeName ? ` (${causeName})` : ""}`, causeName);
  }
  return body.result;
}
