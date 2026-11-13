"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { TICKER_ICONS } from "@/components/ui/TickerText";

/** One NEAR logo centered in a square tile; .landing-spot repeats it inside the glow. */
const LOGO_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 48 48"><path d="${TICKER_ICONS.NEAR}"/></svg>`,
)}")`;

/** A soft accent glow filled with faint NEAR logos: it rests in the center of the screen and eases toward the pointer. */
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spot = ref.current;
    const host = spot?.parentElement;
    if (!spot || !host) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ease = reduce ? 1 : 0.08;
    const center = () => ({ x: host.clientWidth / 2, y: Math.min(host.clientHeight, innerHeight) / 2 });

    let { x, y } = center();
    let target: { x: number; y: number } | null = null;
    let frame = 0;
    /** Eases toward the pointer, or the center when there is none, and stops once it arrives. */
    const tick = () => {
      const goal = target ?? center();
      x += (goal.x - x) * ease;
      y += (goal.y - y) * ease;
      const settled = Math.abs(goal.x - x) < 0.5 && Math.abs(goal.y - y) < 0.5;
      if (settled) ({ x, y } = goal);
      spot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      target = { x: event.clientX - box.left, y: event.clientY - box.top };
      wake();
    };
    const onLeave = () => {
      target = null;
      wake();
    };

    wake();
    addEventListener("resize", wake);
    if (!reduce) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", wake);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="landing-spot" style={{ "--logo-tile": LOGO_TILE } as CSSProperties} />;
}
