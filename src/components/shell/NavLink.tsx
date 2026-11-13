"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/shell/NavIcon";
import type { NavIconName } from "@/config/navigation";

/** Where the link sits: the left navigation ("nav"), the phone menu's main and secondary lists ("menu", "sub") or the
    phone header's section tabs (label alone, "top"). */
type NavLinkVariant = "nav" | "menu" | "sub" | "top";

type NavLinkProps = { href: string; label: string; icon: NavIconName; variant?: NavLinkVariant };

const ROW_CLASS: Record<"nav" | "menu" | "sub", { link: string; icon: string }> = {
  nav: {
    link: "w-fit gap-4 rounded-full py-2.5 pr-5 pl-3 text-[17px] hover:bg-[var(--hover)] max-xl:pr-3 aria-[current=page]:font-bold",
    icon: "size-[22px]",
  },
  menu: { link: "gap-6 py-3.5 text-[20px] font-bold", icon: "size-6" },
  sub: { link: "gap-4 py-3 text-[16px] font-medium", icon: "size-5" },
};

export function NavLink({ href, label, icon, variant = "nav" }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  const current = active ? "page" : undefined;

  if (variant === "top") {
    return (
      <Link href={href} aria-current={current}>
        {label}
      </Link>
    );
  }
  const row = ROW_CLASS[variant];
  return (
    <Link
      href={href}
      aria-current={current}
      className={`flex items-center text-ink transition-colors aria-[current=page]:[&_svg]:text-accent ${row.link}`}
    >
      <NavIcon name={icon} className={`shrink-0 ${row.icon}`} />
      <span className="nav-label">{label}</span>
    </Link>
  );
}
