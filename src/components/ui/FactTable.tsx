import { SourceInfo } from "@/components/ui/SourceInfo";
import type { Fact } from "@/content/facts";

/** Dated facts, one row each, with the source of each in its "i" button. On phones each row stacks its label over its
    value, with the button beside the label. */
export function FactTable({ facts, caption }: { facts: Fact[]; caption: string }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {facts.map((fact) => (
          <tr key={fact.label} className="border-b border-line last:border-0 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_24px] max-sm:gap-y-1 max-sm:py-2.5">
            <th scope="row" className="py-2.5 pr-3 text-left align-top font-semibold text-ink-2 max-sm:col-start-1 max-sm:row-start-1 max-sm:p-0">
              {fact.label}
            </th>
            <td className="py-2.5 pr-3 align-top text-ink-2 max-sm:col-span-full max-sm:row-start-2 max-sm:p-0">{fact.value}</td>
            <td className="w-6 py-2.5 text-right align-top max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
              <SourceInfo sources={[{ cite: fact.source }]} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
