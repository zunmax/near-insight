import { Panel } from "@/components/ui/Panel";
import { EXPORT_TABLES } from "@/config/exports";

/** One download: the file's name and CSV button on the title row, its description across the full width below. */
function ExportItem({ name, description, href }: { name: string; description: string; href: string }) {
  return (
    <li className="rounded-[8px] border border-line-strong px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-[12.5px] font-semibold break-words">{name}</span>
        <a href={href} download aria-label={`${name} as CSV`} className="btn btn-secondary btn-sm shrink-0">
          CSV
        </a>
      </div>
      <p className="mt-1 text-[12px] text-muted">{description}</p>
    </li>
  );
}

/** Download links for every table behind the dashboard. */
export function ExportPanel() {
  return (
    <Panel id="downloads" title="Download the data">
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        <ExportItem name="model-scenarios" description="The Valuation scenarios month by month, with the live inputs they start from" href="/api/model" />
        {Object.entries(EXPORT_TABLES).map(([table, description]) => (
          <ExportItem key={table} name={table} description={description} href={`/api/export/${table}.csv`} />
        ))}
      </ul>
    </Panel>
  );
}
