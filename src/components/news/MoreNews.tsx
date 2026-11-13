import { io } from "next/cache";
import { NewsListItem, NewsListItemSkeleton } from "@/components/news/NewsListItem";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { getLatestNews, readStoryId, type SearchParams } from "@/data/news";

const TITLE = "More NEAR news";
/** Stories listed beside an open story. */
const MORE_COUNT = 6;

/** The latest other stories, shown beside the one chosen by `?id=`. */
export async function MoreNews({ searchParams }: { searchParams: SearchParams }) {
  await io();
  const items = await getLatestNews(MORE_COUNT, readStoryId(await searchParams) ?? "");
  if (items.length === 0) return null;
  return (
    <Panel title={TITLE}>
      <ul className="m-0 -mt-2 list-none p-0">
        {items.map((item) => (
          <NewsListItem key={item.id} item={item} compact />
        ))}
      </ul>
    </Panel>
  );
}

/** Loading placeholder of MoreNews. */
export function MoreNewsSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} source={false}>
      <ul className="m-0 -mt-2 list-none p-0">
        {Array.from({ length: MORE_COUNT }, (_, i) => (
          <NewsListItemSkeleton key={i} compact />
        ))}
      </ul>
    </PanelSkeleton>
  );
}
