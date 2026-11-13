"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/** KPI cards in a <dl>: on phones a row that scrolls sideways one card at a time, with a dot for each card under it and the
    dot of the card nearest the middle lit; from 768px a tile grid. */
export function SwipeCards({ label, children }: { label: string; children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const row = strip.current;
    if (!row) return;
    const onScroll = () => {
      const middle = row.scrollLeft + row.clientWidth / 2;
      const cards = [...(row.firstElementChild?.children ?? [])] as HTMLElement[];
      const nearest = cards.reduce((best, card, i) => {
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
        return distance < best.distance ? { i, distance } : best;
      }, { i: 0, distance: Infinity });
      setActive(nearest.i);
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => row.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="border-line max-md:border-b">
      {/** On phones the named, focusable scroller lays the cards out, and the tile grid inside it adds no box (`.swipe-row`). */}
      <div
        ref={strip}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="swipe-row kpi-block flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pt-3 pb-2 [scrollbar-width:none] md:block md:overflow-visible md:p-0"
      >
        <dl className="tile-grid">{children}</dl>
      </div>
      <div aria-hidden="true" className="flex justify-center gap-1.5 pb-3 md:hidden">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${i === active ? "w-4 bg-accent" : "w-1.5 bg-line-strong"}`} />
        ))}
      </div>
    </div>
  );
}
