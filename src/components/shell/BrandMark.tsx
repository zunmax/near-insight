import Link from "next/link";

/** The NEAR Insights mark: an outlined rounded square holding an N whose diagonal is the accent green. It follows
    the theme; src/app/icon.svg draws the same mark for the browser tab. */
export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2.4" />
      <path d="M10 22V10M22 22V10" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <path d="M10 10l12 12" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The brand mark with the product name, linking to the site's home page. Its left padding equals the navigation links' (NavLink
    "nav") and its mark plus gap equals their icon plus gap, so the mark starts on the icons' left edge and the name on the labels'. */
export function BrandLink() {
  return (
    <Link href="/" className="flex w-fit items-center gap-2 rounded-full px-3 py-2 transition-colors hover:bg-[var(--hover)]">
      <BrandMark className="size-[30px]" />
      <span className="nav-label pr-2 text-[17px] font-extrabold tracking-[-0.01em] text-ink">NEAR Insights</span>
    </Link>
  );
}
