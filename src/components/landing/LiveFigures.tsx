import { io } from "next/cache";
import { LiveFigureRoll } from "@/components/landing/LiveFigureRoll";
import { getLandingFigures } from "@/data/landing";

/** The landing figures from the live database; nothing at all while none has data. */
export async function LiveFigures() {
  await io();
  const figures = await getLandingFigures();
  if (figures.length === 0) return null;
  return <LiveFigureRoll initial={figures} />;
}
