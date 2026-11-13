import type { CSSProperties } from "react";
import { NAV_ICON_PATHS } from "@/components/shell/NavIcon";
import { NAV_ITEMS, type NavIconName } from "@/config/navigation";

/** A white stroke icon as a CSS image, for the avatar drawn by `.x-center .panel:not(.tile)::before` in globals.css. */
function iconImage(path: string, viewBox: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${viewBox} ${viewBox}' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='${path}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** CSS variables that give every feed post inside the element an avatar with this icon on this color. */
export function avatarStyle(path: string, viewBox: number, color: string): CSSProperties {
  return { "--avatar": iconImage(path, viewBox), "--avatar-bg": color } as CSSProperties;
}

/** A dashboard section's avatar: its navigation icon on its section color (`--section-*` in globals.css). */
export function sectionAvatarStyle(icon: NavIconName): CSSProperties {
  return avatarStyle(NAV_ICON_PATHS[icon], 24, `var(--section-${icon})`);
}

/** Sections whose colors tell news publishers apart (the gray sections are left out). */
const PUBLISHER_COLORS: NavIconName[] = ["usage", "revenue", "supply", "valuation", "network", "technology", "peers"];

/** A news publisher's badge color: a fixed hash of its name into the section colors, so a publisher keeps its color. */
export function publisherColor(publisher: string): string {
  let hash = 7;
  for (const char of publisher) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `var(--section-${PUBLISHER_COLORS[hash % PUBLISHER_COLORS.length]})`;
}

/** The navigation icon of the section a dashboard path belongs to, e.g. /dashboard/news/story → news. */
export function sectionIconFor(path: string): NavIconName | undefined {
  return NAV_ITEMS.find((item) => path === item.href || path.startsWith(`${item.href}/`))?.icon;
}
