import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const QUERIES_HREF = "/dashboard/queries";
const METHODOLOGY_HREF = "/dashboard/methodology";
const DOWNLOADS_HREF = `${METHODOLOGY_HREF}#downloads`;

type PageHeaderProps = {
  title: string;
  href: string;
  /** Element after the title, e.g. the source button of the page's numbers. */
  info?: ReactNode;
  children?: ReactNode;
};

/** Opens a page in the feed: a sticky bar with the title, its source button and links to the query catalog and the data
    downloads (each left out on its own page, and on phones, where the menu links to both pages), then the optional intro
    under it. */
export function PageHeader({ title, href, info, children }: PageHeaderProps) {
  return (
    <>
      <header className="feed-top enter-title">
        <div className="flex min-w-0 flex-1 basis-[300px] items-center gap-2.5">
          <h1 className="text-[20px] leading-[1.25] font-extrabold text-ink">{title}</h1>
          {info}
        </div>
        <div className="flex shrink-0 items-center gap-2 max-md:hidden">
          {href !== QUERIES_HREF ? (
            <Link href={QUERIES_HREF} className="btn btn-secondary btn-sm">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
                <path d="m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5l3.5 3.5-3.5 3.5" />
              </svg>
              Queries
            </Link>
          ) : null}
          {href !== METHODOLOGY_HREF ? (
            <Link href={DOWNLOADS_HREF} className="btn btn-primary btn-sm">
              <Icon name="download" strokeWidth={1.6} className="size-3.5" />
              Export
            </Link>
          ) : null}
        </div>
      </header>
      {children ? <div className="feed-intro enter-title">{children}</div> : null}
    </>
  );
}
