"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { NAV_ITEMS } from "@/config/navigation";

/** Widths that show the section tabs (below Tailwind's md breakpoint). */
const PHONE_QUERY = "(max-width: 767px)";

/** Distance a finger moves before the gesture counts as sideways (switch section) or up and down (scroll). */
const AXIS_SLOP_PX = 10;

/** A release past this share of the screen width, or a flick at least FLICK_MIN_PX long and faster than FLICK_PX_PER_MS,
    switches section; anything less springs back. */
const SWITCH_SHARE = 0.25;
const FLICK_MIN_PX = 40;
const FLICK_PX_PER_MS = 0.5;

/** Touches starting this close to a screen edge are left to the browser's own back and forward swipes. */
const EDGE_PX = 16;

/** How far the content follows the finger past the first or last section, as a share of the finger's travel. */
const END_RESISTANCE = 0.25;

const SLIDE_MS = 180;

/** If the next section has not replaced this one by then (a failed navigation), the content springs back. */
const RECOVER_MS = 5000;

/** True when a touch on `target` belongs to something that uses sideways drags itself: a form control, an element marked
    data-swipe="off" (the charts' readout), or a container that scrolls sideways. */
function handlesSideways(target: Element, area: Element): boolean {
  if (target.closest('input, select, textarea, [data-swipe="off"]')) return true;
  for (let element: Element | null = target; element && element !== area; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth && /auto|scroll/.test(getComputedStyle(element).overflowX)) return true;
  }
  return false;
}

/** On phones, a sideways swipe on the feed moves to the next or previous section in tab order, like X's tabs: the content
    follows the finger, slides out when the swipe is far or fast enough, and springs back otherwise. */
export function SectionSwipe({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const area = useRef<HTMLDivElement>(null);
  const index = NAV_ITEMS.findIndex((item) => pathname.startsWith(item.href));

  /** The new section starts in place; the old one may have been left slid out. */
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.transition = "";
    element.style.transform = "";
  }, [pathname]);

  useEffect(() => {
    const element = area.current;
    if (!element || index < 0) return;
    for (const neighbour of [NAV_ITEMS[index - 1], NAV_ITEMS[index + 1]]) if (neighbour) router.prefetch(neighbour.href);

    const phone = window.matchMedia(PHONE_QUERY);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let start: { x: number; y: number; time: number } | null = null;
    let axis: "x" | "y" | null = null;
    let offset = 0;
    let leaving: ReturnType<typeof setTimeout> | undefined;

    const place = (x: number, animate: boolean) => {
      element.style.transition = animate && !reducedMotion.matches ? `transform ${SLIDE_MS}ms ease-out` : "";
      element.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
    };
    /** The section a swipe of `x` pixels leads to: left goes to the next tab, right to the previous one. */
    const targetOf = (x: number) => NAV_ITEMS[index - Math.sign(x)];

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = null;
      axis = null;
      offset = 0;
      if (leaving || !phone.matches || event.touches.length !== 1 || !touch) return;
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return;
      if (handlesSideways(event.target as Element, element)) return;
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (axis === null) {
        if (Math.hypot(dx, dy) < AXIS_SLOP_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return;
      if (event.cancelable) event.preventDefault();
      offset = targetOf(dx) ? dx : dx * END_RESISTANCE;
      place(offset, false);
    };

    const onEnd = (event: TouchEvent) => {
      if (!start || axis !== "x") {
        start = null;
        return;
      }
      const speed = Math.abs(offset) / Math.max(1, event.timeStamp - start.time);
      const target = targetOf(offset);
      start = null;
      const far = Math.abs(offset) > window.innerWidth * SWITCH_SHARE;
      const flick = Math.abs(offset) > FLICK_MIN_PX && speed > FLICK_PX_PER_MS;
      if (!target || !(far || flick)) {
        place(0, true);
        return;
      }
      place(Math.sign(offset) * window.innerWidth, true);
      leaving = setTimeout(() => {
        router.push(target.href);
        leaving = setTimeout(() => {
          leaving = undefined;
          place(0, true);
        }, RECOVER_MS);
      }, reducedMotion.matches ? 0 : SLIDE_MS);
    };

    const onCancel = () => {
      if (start && axis === "x") place(0, true);
      start = null;
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onCancel);
    return () => {
      clearTimeout(leaving);
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onCancel);
    };
  }, [index, router]);

  return (
    <div ref={area} className="flex min-w-0 flex-1 flex-col max-md:touch-pan-y max-md:touch-pinch-zoom">
      {children}
    </div>
  );
}
