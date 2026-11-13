/** Title for a group of posts in the feed. */
export function SectionHeading({ title, id }: { title: string; id?: string }) {
  return (
    <h2 id={id} className="feed-heading scroll-mt-16">
      {title}
    </h2>
  );
}
