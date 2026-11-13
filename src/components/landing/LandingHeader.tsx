import Link from "next/link";
import { BrandMark } from "@/components/shell/BrandMark";
import { ThemeSwitch } from "@/components/shell/ThemeSwitch";

/** Landing page header: the brand, the theme switch and the dashboard button. */
export function LandingHeader() {
  return (
    <header className="landing-header">
      <Link href="/" className="flex items-center gap-2.5 text-[16px] font-extrabold tracking-[-0.01em]">
        <BrandMark className="size-[30px]" />
        NEAR Insights
      </Link>
      <div className="flex items-center gap-2.5">
        <ThemeSwitch />
        <Link href="/dashboard/home" className="btn btn-ink btn-sm hidden sm:inline-flex">
          Open the dashboard
        </Link>
      </div>
    </header>
  );
}
