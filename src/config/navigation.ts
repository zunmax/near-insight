/** Dashboard sections in sidebar order, in groups: the overview, the thesis pillars with their evidence, the network
    fundamentals, peers and news, and reference pages. `icon` keys into NavIcon. Every dashboard page lives under /dashboard;
    the landing page is /. */
export const NAV_GROUPS = [
  { items: [{ href: "/dashboard/home", label: "Home", icon: "home" }] },
  {
    items: [
      { href: "/dashboard/usage", label: "Usage", icon: "usage" },
      { href: "/dashboard/revenue", label: "Revenue", icon: "revenue" },
      { href: "/dashboard/supply", label: "Supply", icon: "supply" },
      { href: "/dashboard/valuation", label: "Valuation", icon: "valuation" },
    ],
  },
  {
    items: [
      { href: "/dashboard/network", label: "Network", icon: "network" },
      { href: "/dashboard/technology", label: "Technology", icon: "technology" },
    ],
  },
  {
    items: [
      { href: "/dashboard/peers", label: "Peers", icon: "peers" },
      { href: "/dashboard/news", label: "News", icon: "news" },
    ],
  },
  {
    /** Listed smaller, under a divider, in the phone menu. */
    secondary: true,
    items: [
      { href: "/dashboard/methodology", label: "Methodology", icon: "methodology" },
      { href: "/dashboard/queries", label: "Queries", icon: "queries" },
    ],
  },
] as const;

export type NavItem = (typeof NAV_GROUPS)[number]["items"][number];
export type NavIconName = NavItem["icon"];

/** Every section in sidebar order, the groups flattened into one list. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group): readonly NavItem[] => group.items);

/** Each section's label by its path, e.g. "/dashboard/usage" → "Usage". */
export const PAGE_LABEL = new Map<string, string>(NAV_ITEMS.map((item) => [item.href, item.label]));
