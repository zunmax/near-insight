import type { NavIconName } from "@/config/navigation";

/** Section icons (24 × 24 strokes), shared by the navigation and the post avatars. */
export const NAV_ICON_PATHS: Record<NavIconName, string> = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z",
  news: "M5 5h11v13a2 2 0 0 0 2 2H7a2 2 0 0 1-2-2V5Zm11 4h3v9a2 2 0 0 1-4 0M8 9h5M8 12.5h5M8 16h3",
  supply: "M5 6c0 1.4 3.1 2.6 7 2.6S19 7.4 19 6s-3.1-2.6-7-2.6S5 4.6 5 6Zm0 0v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6",
  usage: "M3 12h4l3-7 4 14 3-7h4",
  revenue: "M12 3v18m4.5-14.5H9.75a2.75 2.75 0 0 0 0 5.5h4.5a2.75 2.75 0 0 1 0 5.5H7",
  technology: "M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm1-4v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4",
  network: "M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 7v4m0 0-6 5.5m6-5.5 6 5.5",
  peers: "M5 20V10m7 10V4m7 16v-7",
  valuation: "M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m0-14a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-6 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
  methodology: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h12",
  queries: "M8 7 3 12l5 5m8-10 5 5-5 5M14 4l-4 16",
};

export function NavIcon({ name, className }: { name: NavIconName; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={NAV_ICON_PATHS[name]} />
    </svg>
  );
}
