import Link from "next/link";
import { BrandLink } from "@/components/shell/BrandMark";
import { NavLink } from "@/components/shell/NavLink";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";
import { Icon } from "@/components/ui/Icon";
import { NAV_ITEMS } from "@/config/navigation";

/** Left navigation: the brand, every section with a large icon, the data download button and the theme switch. */
export function Sidebar() {
  return (
    <div className="x-nav">
      <BrandLink />
      <div className="mt-4 flex min-h-0 flex-col max-xl:items-center">
        <nav aria-label="Dashboard sections" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none]">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
        <Link href="/dashboard/methodology#downloads" className="btn btn-primary mt-3 h-12 w-full max-w-[220px] shrink-0 text-[16px]">
          <Icon name="download" className="size-[18px] shrink-0" />
          <span className="nav-label">Export data</span>
        </Link>
      </div>
      <div className="mt-auto pt-4">
        <ThemeSwitch />
      </div>
    </div>
  );
}
