import { io } from "next/cache";
import Link from "next/link";
import { LatestNewsFeed } from "@/components/news/LatestNewsFeed";
import { NewsLiveBadge } from "@/components/news/NewsEventsProvider";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { getLatestNewsSnapshot } from "@/data/news";

const TITLE = "Latest news";
/** Stories listed. */
const COUNT = 5;

/** The newest stories as a feed that new stories reach without a reload, through the dashboard's news connection, marked live
    while that connection is open. */
export async function LatestNewsPanel() {
  await io();
  const { items, readAt } = await getLatestNewsSnapshot(COUNT);
  if (items.length === 0) return null;
  return (
    <Panel title={TITLE} sources={["cryptopanic", "chaincatcher"]} action={<NewsLiveBadge />}>
      {/** Keyed by the stories, so a page kept alive and shown again starts from the newer list it is given. */}
      <LatestNewsFeed key={items.map((item) => item.id).join("|")} initial={items} readAt={readAt} count={COUNT} />
      <Link href="/dashboard/news" className="mt-auto inline-block pt-3 text-[15px] text-accent-text hover:underline">
        Show more
      </Link>
    </Panel>
  );
}

/** Loading placeholder of LatestNewsPanel: a publisher line and a headline for each story, then the link to more. */
export function LatestNewsPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length}>
      <ul className="-mx-4 my-0 flex list-none flex-col p-0">
        {Array.from({ length: COUNT }, (_, i) => (
          <li key={i} className="px-4 py-2.5">
            <span className="block text-[13px]">
              <SkeletonWords chars={20} />
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug font-bold">
              <SkeletonWords chars={75} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-3 text-[15px]">
        <SkeletonWords chars={"Show more".length} />
      </p>
    </PanelSkeleton>
  );
}
