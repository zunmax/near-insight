"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QueryTabs, type PanelQuery } from "@/components/queries/QueryTabs";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { LIVE_TXNS_TREND_DAYS } from "@/config/ingest";
import type { LiveSnapshot } from "@/data/live";
import { formatInteger, formatPercent } from "@/lib/format";

const POLL_MS = 20_000;

/** Longest wait between polls while /api/live keeps failing; the wait doubles from POLL_MS after each failure. */
const POLL_MAX_MS = 5 * 60_000;

const utcMinute = (at: string) => new Date(at).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });

/** The latest snapshot, polled while the tab is visible, when it was last checked, and the newest sample seen so far: a
    failing poll still moves the check time, so the panel can show that its data has aged. */
function useLiveSnapshot(initial: LiveSnapshot | null, initialCheckedAt: string, initialLastSampleAt: string | null) {
  const [state, setState] = useState({ snapshot: initial, checkedAt: initialCheckedAt, lastSampleAt: initialLastSampleAt });
  /** When the last check ended (unix ms); a page shown again after navigation checks at once if that is over a poll ago. */
  const lastCheck = useRef(Date.parse(initialCheckedAt));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let stopped = false;
    let failures = 0;
    const schedule = () => {
      if (!stopped && !document.hidden) timer = setTimeout(poll, Math.min(POLL_MS * 2 ** failures, POLL_MAX_MS));
    };
    const poll = async () => {
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const res = await fetch("/api/live", { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const snapshot = (await res.json()) as LiveSnapshot | null;
        failures = 0;
        lastCheck.current = Date.now();
        setState((s) => ({ snapshot, checkedAt: new Date(lastCheck.current).toISOString(), lastSampleAt: snapshot?.at ?? s.lastSampleAt }));
      } catch {
        /** An abort from unmounting or hiding the tab is not a failure; otherwise keep the last snapshot and back off. */
        if (signal.aborted) return;
        failures++;
        lastCheck.current = Date.now();
        setState((s) => ({ ...s, checkedAt: new Date(lastCheck.current).toISOString() }));
      }
      schedule();
    };
    const onVisibility = () => {
      clearTimeout(timer);
      controller?.abort();
      if (!document.hidden) void poll();
    };
    if (!document.hidden && Date.now() - lastCheck.current > POLL_MS) void poll();
    else schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return state;
}

/** The live numbers' tiles: one column in a narrow box, then from 560px the block height across two side by side, where
    each fits its one-line detail. */
const METRICS_CLASS = "m-0 grid gap-2 @min-[560px]:grid-cols-2 @min-[560px]:[&>:first-child]:col-span-2";

/** Minute-level NEAR activity, refreshed every 20 seconds while the tab is visible, with the query behind it. It shows as
    live only while its newest sample is younger than `staleAfterMs` at the last check; older data shows its date instead. */
export function LiveActivity({
  initial,
  lastSampleAt: initialLastSampleAt,
  checkedAt: initialCheckedAt,
  staleAfterMs,
  query,
  info,
}: {
  initial: LiveSnapshot | null;
  /** Newest stored sample, also when it is older than the snapshot window; null before the first reading. */
  lastSampleAt: string | null;
  checkedAt: string;
  staleAfterMs: number;
  query: PanelQuery;
  /** The "i" note, rendered on the server so the source config stays out of the browser bundle. */
  info: ReactNode;
}) {
  const { snapshot: live, checkedAt, lastSampleAt } = useLiveSnapshot(initial, initialCheckedAt, initialLastSampleAt);

  if (!live) {
    return (
      <section className="panel h-full">
        <h2 className="panel-head panel-title">Live on NEAR mainnet</h2>
        <p className="panel-body panel-empty text-[13px] text-ink-2">
          <span>
            <NoBreakTokens
              text={
                lastSampleAt
                  ? `Live readings have paused. The last one was taken on ${lastSampleAt.slice(0, 10)} at ${utcMinute(lastSampleAt)} UTC.`
                  : "Live NEAR activity appears here once the first block readings arrive."
              }
            />
          </span>
        </p>
      </section>
    );
  }

  const trend = live.txnsTrend;
  const peak = Math.max(...trend.map((t) => t.perMinute), 1);
  const time = new Date(live.at).toLocaleTimeString("en-GB", { timeZone: "UTC" });
  const stale = Date.parse(checkedAt) - Date.parse(live.at) > staleAfterMs;

  return (
    <section aria-labelledby="live-title" className="panel h-full">
      <div className="panel-head flex-wrap">
        <h2 id="live-title" className="panel-title">
          Live on NEAR mainnet
        </h2>
        <div className="flex items-center gap-3">
          {stale ? (
            <span className="text-[12px] font-semibold text-muted tabular-nums">
              Last reading {live.at.slice(0, 10)}, {time} UTC
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-up tabular-nums">
              <span aria-hidden="true" className="live-dot" />
              Block at {time} UTC
            </span>
          )}
          {info}
        </div>
      </div>

      <div className="panel-body flex flex-col p-4">
        <QueryTabs query={query} viewLabel="Live">
          <div className="@container">
            <dl className={METRICS_CLASS}>
              <KpiCard icon="cube" label="Block height" value={formatInteger(live.blockHeight)} detail="Latest final block" />
              <KpiCard
                icon="clock"
                label="Transactions / minute (daily average)"
                value={live.txnsPerMinute === null ? "—" : formatInteger(live.txnsPerMinute)}
                detail={live.txnsDay ? `Average on ${live.txnsDay}` : "Needs a finished day"}
              />
              <KpiCard icon="layers" label="Chunk gas used" value={formatPercent(live.gasUtilization, 1)} detail="Gas used ÷ gas limit, latest final block" />
            </dl>
          </div>

          {trend.length > 1 ? (
            <div className="pt-5">
              <div aria-hidden="true" className="flex h-12 items-end gap-[3px]">
                {trend.map((t) => (
                  <span
                    key={t.day}
                    className="min-w-[3px] flex-1 rounded-t-[4px] bg-s1 transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    style={{ height: `${Math.max(4, (t.perMinute / peak) * 100)}%` }}
                    title={`${t.day} · ${formatInteger(t.perMinute)} tx/min`}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted">
                <NoBreakTokens text={`Average transactions per minute each day, ${trend[0]!.day} to ${trend.at(-1)!.day}`} />
              </p>
            </div>
          ) : null}
        </QueryTabs>
      </div>
    </section>
  );
}

/** Lengths of the live numbers' labels and details, for the loading placeholder. */
const SKELETON_METRICS = [
  { label: "Block height".length, detail: "Latest final block".length },
  { label: "Transactions / minute (daily average)".length, detail: "Average on YYYY-MM-DD".length },
  { label: "Chunk gas used".length, detail: "Gas used ÷ gas limit, latest final block".length },
];

/** Loading placeholder of LiveActivity with a reading: the three numbers, then a bar for each day of the trend. */
export function LiveActivitySkeleton() {
  return (
    <PanelSkeleton
      title={"Live on NEAR mainnet".length}
      tabs="Live"
      source={false}
      action={
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold">
            <span className="skeleton size-[7px] rounded-full" />
            <span>
              <SkeletonWords chars={"Block at 00:00:00 UTC".length} />
            </span>
          </span>
          <span className="size-4" />
        </span>
      }
    >
      <div className="@container">
        <dl className={METRICS_CLASS}>
          {SKELETON_METRICS.map((metric, i) => (
            <KpiCardSkeleton key={i} label={metric.label} detail={metric.detail} />
          ))}
        </dl>
      </div>
      <div className="pt-5">
        <div className="flex h-12 items-end gap-[3px]">
          {Array.from({ length: LIVE_TXNS_TREND_DAYS }, (_, i) => (
            <span key={i} className="skeleton min-w-[3px] flex-1 rounded-t-[4px] rounded-b-none" style={{ height: `${40 + ((i * 37) % 55)}%` }} />
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px]">
          <SkeletonWords chars={68} />
        </p>
      </div>
    </PanelSkeleton>
  );
}
