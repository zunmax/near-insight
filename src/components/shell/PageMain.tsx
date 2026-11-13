"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";
import { sectionAvatarStyle, sectionIconFor } from "@/components/ui/avatar";

/** The feed column's content, at least as tall as the column, with the page's section avatar for its posts. On navigation
    the old content fades out while the new posts play their `.enter` animation (::view-transition rules in globals.css). */
export function PageMain({ children }: { children: ReactNode }) {
  const icon = sectionIconFor(usePathname());
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <main id="content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none" style={icon ? sectionAvatarStyle(icon) : undefined}>
        {children}
      </main>
    </ViewTransition>
  );
}
