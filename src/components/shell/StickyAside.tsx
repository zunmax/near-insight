"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** The right column. It sticks at the top while it fits the window; when it is taller, its sticky offset turns
    negative so it scrolls with the page until its end is in view and then stays there. */
export function StickyAside({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const aside = ref.current;
    if (!aside) return;
    const place = () => {
      aside.style.top = `${Math.min(0, window.innerHeight - aside.offsetHeight)}px`;
    };
    const observer = new ResizeObserver(place);
    observer.observe(aside);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <aside ref={ref} className="x-aside" aria-label={label}>
      {children}
    </aside>
  );
}
