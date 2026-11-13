"use client";

import { useEffect, useRef } from "react";
import { MobileMenu } from "@/components/shell/MobileMenu";
import { MobileSectionTabs } from "@/components/shell/MobileSectionTabs";

/** Scroll distance, in pixels, that counts as a change of direction. */
const SCROLL_SLOP = 6;

/** Phone header: the account avatar that opens the menu, and the section tabs. It slides away while the page scrolls
    down and comes back on scroll up (`data-scroll-dir` on <html>). */
export function MobileHeader() {
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < SCROLL_SLOP) return;
      const direction = y > last && y > (header.current?.offsetHeight ?? 0) ? "down" : "up";
      if (root.dataset.scrollDir !== direction) root.dataset.scrollDir = direction;
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete root.dataset.scrollDir;
    };
  }, []);

  return (
    <header ref={header} className="x-mobile-header md:hidden">
      <div className="flex h-[53px] items-center px-4">
        <MobileMenu />
      </div>
      <MobileSectionTabs />
    </header>
  );
}
