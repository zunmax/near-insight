/** Shown when the database does not hold every reading a panel needs yet: before the first ingest run, or while a day it needs is missing. */
export function NoData({ title }: { title: string }) {
  return (
    <section className="panel h-full">
      <h2 className="panel-head panel-title">{title}</h2>
      <p className="panel-body panel-empty text-[14px] leading-relaxed text-ink-2">
        <span>This data is not complete yet. It appears here once every day it needs is stored from its public sources.</span>
      </p>
    </section>
  );
}
