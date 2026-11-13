import { notFound } from "next/navigation";

/** Where `src/proxy.ts` sends a link to a story that is not stored: notFound() runs before anything streams, so the answer is a real 404. */
export default function MissingStoryPage() {
  notFound();
}
