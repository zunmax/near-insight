import type { Metadata } from "next";
import { MissingStory } from "@/components/news/NewsStory";
import { PageMain } from "@/components/shell/PageMain";

export const metadata: Metadata = { title: "Story not available" };

export default function StoryNotFound() {
  return (
    <PageMain>
      <MissingStory />
    </PageMain>
  );
}
