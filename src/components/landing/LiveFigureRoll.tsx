"use client";

import { useEffect, useRef, useState } from "react";
import { Odometer } from "@/components/landing/Odometer";
import type { LandingFigure } from "@/lib/thesis/landing-figures";

/** How often an open landing tab reads the figures again; the worker adds data at most every few minutes. */
const POLL_MS = 5 * 60_000;

/** Longest wait between reads while /api/landing keeps failing; the wait doubles from POLL_MS after each failure. */
const POLL_MAX_MS = 30 * 60_000;

const isFigure = (value: unknown): value is LandingFigure =>
  typeof value === "object" &&
  value !== null &&
  ["eyebrow", "value", "verb"].every((key) => typeof (value as Record<string, unknown>)[key] === "string");

/** The figures, read again while the tab is visible. A failed or empty read keeps the figures already shown,
    so a passing database or network problem never blanks the page. */
function usePolledFigures(initial: LandingFigure[]): LandingFigure[] {
  const [figures, setFigures] = useState(initial);
  /** When the last read ended (unix ms); a page shown again after navigation reads at once if that is over a poll ago. */
  const lastRead = useRef<number | null>(null);
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
        const res = await fetch("/api/landing", { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body: unknown = await res.json();
        const next = Array.isArray(body) ? body.filter(isFigure) : [];
        failures = 0;
        if (next.length > 0) setFigures(next);
      } catch {
        /** An abort from unmounting or hiding the tab is not a failure; otherwise keep the figures and back off. */
        if (signal.aborted) return;
        failures++;
      }
      lastRead.current = Date.now();
      schedule();
    };
    const onVisibility = () => {
      clearTimeout(timer);
      controller?.abort();
      if (!document.hidden) void poll();
    };
    lastRead.current ??= Date.now();
    if (!document.hidden && Date.now() - lastRead.current > POLL_MS) void poll();
    else schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return figures;
}

/** The landing figures rolling on screen, and as a plain list for screen readers, kept current while the tab is open. */
export function LiveFigureRoll({ initial }: { initial: LandingFigure[] }) {
  const figures = usePolledFigures(initial);
  return (
    <>
      <ul className="sr-only">
        {figures.map((figure) => (
          <li key={figure.eyebrow}>
            {figure.value} {figure.verb}. {figure.eyebrow}.
          </li>
        ))}
      </ul>
      {/** A new set of figures starts its roll from the first one, so the shown position always exists. */}
      <Odometer key={figures.map((figure) => figure.eyebrow).join("|")} figures={figures} />
    </>
  );
}
