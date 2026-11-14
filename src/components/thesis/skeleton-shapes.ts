import type { SectionId } from "@/content/thesis";

type SectionSkeleton = {
  /** Labels of the stat tiles; the Home card shows the first two. */
  stats: number[];
  bull: number;
  /** The bear case before the section's own text. */
  bear: number;
  /** Labels of the numbers under the bear case. */
  bearStats: number[];
  /** The breaking point's rule and status lines. */
  breaking: [number, number];
  /** The Home card's short rule and status lines. */
  card: [number, number];
};

/** Lengths of each section's live text, for the loading placeholders of its thesis header and its Home card. */
export const SECTION_SKELETONS: Record<SectionId, SectionSkeleton> = {
  demand: { stats: [28, 73, 30, 60], bull: 375, bear: 548, bearStats: [85, 85, 96], breaking: [236, 273], card: [109, 97] },
  capture: { stats: [25, 98, 76, 72], bull: 225, bear: 195, bearStats: [59, 57, 67], breaking: [299, 340], card: [112, 128] },
  supply: { stats: [35, 47, 92, 68], bull: 152, bear: 267, bearStats: [44, 44, 59, 47], breaking: [295, 348], card: [178, 117] },
  valuation: { stats: [98, 109, 67, 196], bull: 496, bear: 254, bearStats: [37, 73, 115], breaking: [483, 338], card: [181, 91] },
  technology: { stats: [16, 30], bull: 181, bear: 110, bearStats: [37, 50], breaking: [139, 146], card: [66, 88] },
  network: { stats: [17, 20], bull: 133, bear: 199, bearStats: [68, 62], breaking: [293, 132], card: [93, 99] },
  peers: { stats: [41, 83, 21, 57], bull: 179, bear: 294, bearStats: [44], breaking: [193, 255], card: [111, 93] },
};
