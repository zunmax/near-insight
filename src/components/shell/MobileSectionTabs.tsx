"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NavLink } from "@/components/shell/NavLink";
import { NAV_ITEMS } from "@/config/navigation";

/** Phone header tabs: every section in a row that scrolls sideways, the current one centered and underlined. */
export function MobileSectionTabs() {
  const pathname = usePathname();
  const strip = useRef<HTMLElement>(null);
  const placed = useRef(false);

  useEffect(() => {
    const nav = strip.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab) return;
    const smooth = placed.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left: tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2, behavior: smooth ? "smooth" : "instant" });
    placed.current = true;
  }, [pathname]);

  return (
    <nav ref={strip} aria-label="Sections" className="segmented x-toptabs">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="top" />
      ))}
    </nav>
  );
}
