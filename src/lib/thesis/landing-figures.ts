import type { ThesisMetrics } from "@/data/thesis-metrics";
import { formatCount, formatNear, formatPercentFromFull, formatUsd } from "@/lib/format";
import { windowName } from "@/lib/thesis/window-name";

/** A live figure on the landing page: the label above it (what it counts, with its window or day), its formatted value and the verb shown under it. */
export type LandingFigure = { eyebrow: string; value: string; verb: string };

/** The metrics the landing figures read; of the buybacks, only the NEAR bought over 30 days. */
export type LandingMetrics = Pick<ThesisMetrics, "dataThrough" | "flowsCurrent" | "intents" | "issuance" | "absorption" | "intentsReach"> & {
  bought30dNear: number | null;
};

/** The landing page's rolling figures, in order; a figure without data, or with nothing to show yet (zero), is left out. */
export function landingFigures(m: LandingMetrics): LandingFigure[] {
  const window = windowName(m, "30 days");
  const minted = m.issuance?.minted30dNear ?? 0;
  const absorbed = m.absorption?.d30?.share ?? 0;
  const figures: Array<LandingFigure | null> = [
    m.intents && m.intents.total30d > 0 ? { eyebrow: `Swapped through NEAR Intents · ${window}`, value: formatUsd(m.intents.total30d), verb: "swapped" } : null,
    m.bought30dNear !== null && m.bought30dNear > 0
      ? { eyebrow: `Bought with NEAR Intents fees · ${window}`, value: formatNear(m.bought30dNear), verb: "bought" }
      : null,
    minted > 0 ? { eyebrow: `Minted by the protocol · ${window}`, value: formatNear(minted), verb: "minted" } : null,
    absorbed > 0 ? { eyebrow: `Share of NEAR minted that was burned or bought · ${window}`, value: formatPercentFromFull(absorbed, 1), verb: "absorbed" } : null,
    m.intentsReach && m.intentsReach.chains > 0
      ? { eyebrow: `Chains with NEAR Intents volume · ${m.intentsReach.day}`, value: formatCount(m.intentsReach.chains, "chain"), verb: "reached" }
      : null,
  ];
  return figures.filter((figure) => figure !== null);
}
