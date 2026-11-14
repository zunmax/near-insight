"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { NavLink } from "@/components/shell/NavLink";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { NAV_GROUPS, type NavItem } from "@/config/navigation";
import { SITE } from "@/config/site";

const MAIN_ITEMS = NAV_GROUPS.filter((group) => !("secondary" in group)).flatMap((group): readonly NavItem[] => group.items);
const SECONDARY_ITEMS = NAV_GROUPS.filter((group) => "secondary" in group).flatMap((group): readonly NavItem[] => group.items);

/** The brand mark and the menu it opens: a modal <dialog> sliding in from the left with the site name, the
    sections in large type, the reference pages under a divider and the theme switch. A link, Escape or the backdrop closes it. */
export function MobileMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  /** A route hidden by navigation stays mounted, so an open menu is closed rather than left in the top layer. */
  useLayoutEffect(() => {
    const element = dialog.current;
    return () => element?.close();
  }, []);

  const showMenu = () => {
    dialog.current?.showModal();
    setOpen(true);
  };

  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    const target = event.target as HTMLElement;
    if (target === dialog.current || target.closest("a")) dialog.current?.close();
  };

  return (
    <>
      <button type="button" onClick={showMenu} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} className="rounded-full">
        <BrandMark />
      </button>
      <dialog
        ref={dialog}
        aria-label="Menu"
        onClick={onDialogClick}
        onClose={() => setOpen(false)}
        className="drawer m-0 h-dvh max-h-none w-[min(300px,85vw)] max-w-none overflow-y-auto bg-bg p-0 text-ink [scrollbar-width:none] backdrop:bg-[var(--backdrop)]"
      >
        <div className="flex min-h-full flex-col px-6 pt-4 pb-5">
          <Link href="/" aria-label={`${SITE.name} home`} className="w-fit rounded-full">
            <BrandMark />
          </Link>
          <p className="mt-3 text-[18px] leading-tight font-extrabold">{SITE.name}</p>
          <p className="mt-1 text-[14px] leading-snug text-muted">{SITE.description}</p>
          <nav aria-label="Dashboard sections" className="mt-4 flex flex-col border-y border-line py-2">
            {MAIN_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="menu" />
            ))}
          </nav>
          <nav aria-label="About the data" className="flex flex-col py-2">
            {SECONDARY_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="sub" />
            ))}
          </nav>
          <div className="mt-auto pt-4">
            <ThemeSwitch />
          </div>
        </div>
      </dialog>
    </>
  );
}
