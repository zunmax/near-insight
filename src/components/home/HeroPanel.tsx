import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { THESIS_STATEMENT, THESIS_STEPS } from "@/content/thesis";

/** Home's thesis post: the long-term thesis, then how it works in three numbered steps. */
export function HeroPanel() {
  return (
    <section id="how-it-works" aria-labelledby="hero-title" className="panel h-full scroll-mt-16">
      <h2 id="hero-title" className="panel-head panel-title">
        Long-term thesis
      </h2>
      <div className="panel-body post-text flex flex-col">
        <p className="text-[17px] leading-[1.45] font-medium text-ink">
          <NoBreakTokens text={THESIS_STATEMENT} />
        </p>
        <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 rounded-[8px] border border-line-strong p-3">
          {THESIS_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
              <span aria-hidden="true" className="icon-chip text-[12px] font-bold tabular-nums">
                {i + 1}
              </span>
              <span>
                <NoBreakTokens text={step} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
