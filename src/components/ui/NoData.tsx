/** Shown when the database does not hold every reading a panel needs yet: before the first ingest run, or while a day it needs is missing. */
export function NoData({ title }: { title: string }) {
  return (
    <section className="panel h-full">
      <h2 className="panel-head panel-title">{title}</h2>
      <p className="panel-body panel-empty text-[14px] leading-relaxed text-ink-2">
        <span>This panel is waiting for data. It appears once every day it needs is stored.</span>
      </p>
    </section>
  );
}
