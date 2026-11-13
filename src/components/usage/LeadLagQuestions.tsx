"use client";

import { useState } from "react";
import { SkeletonWords } from "@/components/ui/PanelSkeleton";
import { PillButton } from "@/components/ui/PillButton";
import { LEAD_LAG } from "@/config/lead-lag";
import { LEAD_LAG_QUESTION_LABELS as LABELS, LEAD_LAG_QUESTIONS as QUESTIONS } from "@/content/lead-lag";
import { formatCorrelation, formatPValue } from "@/lib/format";
import type { LeadLagQuestion, LeadLagTest } from "@/lib/lead-lag";

const signed = (r: number | null) => (r === null ? "—" : formatCorrelation(r));
const pValue = (p: number | null) => (p === null ? "—" : formatPValue(p, LEAD_LAG.alpha));

/** The leading series, an arrow, and the series it is tested against; screen readers hear "leads" for the arrow. */
function Leads({ pair: [leads, follows], arrowClass = "" }: { pair: readonly [string, string]; arrowClass?: string }) {
  return (
    <>
      {leads}
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`mx-[0.25em] inline-block size-[1em] shrink-0 align-[-0.15em] ${arrowClass}`}>
        <path d="M2.5 8h11M9.5 4l4 4-4 4" />
      </svg>
      <span className="sr-only"> leads </span>
      {follows}
    </>
  );
}

/** The lead-lag tests of one question at a time, picked with a row of buttons. */
export function LeadLagQuestions({ groups }: { groups: Array<{ question: LeadLagQuestion; tests: LeadLagTest[] }> }) {
  const [selected, setSelected] = useState(groups[0]?.question);

  return (
    <div className="mt-4">
      <div role="group" aria-label="Lead-lag question" className="grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2 sm:grid-cols-4">
        {groups.map(({ question }) => (
          <PillButton key={question} pressed={selected === question} onClick={() => setSelected(question)} className="gap-0 px-2 text-[12.5px]">
            <Leads pair={LABELS[question]} />
          </PillButton>
        ))}
      </div>
      {/** Every table shares one grid cell, so the panel keeps the tallest table's height whichever question is open. */}
      <div className="mt-3 grid">
        {groups.map(({ question, tests }) => (
          <table key={question} className={`data-table [grid-area:1/1] self-start ${selected === question ? "" : "invisible"}`}>
            <caption className="mb-2 text-left text-[13px] font-medium text-ink">
              <Leads pair={QUESTIONS[question]} arrowClass="text-muted" />
            </caption>
            <thead>
              <tr>
                <th scope="col">Leads by</th>
                <th scope="col" className="text-right">
                  <span className="max-sm:hidden">Correlation</span>
                  <span className="sm:hidden">r</span>
                </th>
                <th scope="col" className="text-right">
                  p
                </th>
                <th scope="col" className="text-right">
                  <span className="max-sm:hidden">p, adjusted</span>
                  <span className="sm:hidden">p adj.</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.lag} className={test.significant ? "font-medium text-ink" : "text-ink-2"}>
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {test.lag === 0 ? "Same week" : `${test.lag} week${test.lag > 1 ? "s" : ""}`}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{signed(test.r)}</td>
                  <td className="py-1.5 text-right tabular-nums">{pValue(test.p)}</td>
                  <td className="py-1.5 text-right tabular-nums">{pValue(test.pAdjusted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

/** Loading placeholder of LeadLagQuestions: a pill per question and one question's table, a row for each lead from 0 weeks. */
export function LeadLagQuestionsSkeleton() {
  const questions = Object.keys(QUESTIONS);
  const rows = LEAD_LAG.maxLagWeeks + 1;
  return (
    <div aria-hidden="true" className="mt-4">
      <div className="grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2 sm:grid-cols-4">
        {questions.map((question) => (
          <span key={question} className="btn btn-sm btn-secondary px-2 text-[12.5px]">
            <SkeletonWords chars={14} />
          </span>
        ))}
      </div>
      <table className="data-table mt-3">
        <caption className="mb-2 text-left text-[13px] font-medium">
          <SkeletonWords chars={36} />
        </caption>
        <thead>
          <tr>
            {[8, 11, 1, 11].map((chars, i) => (
              <th key={i} className={i === 0 ? "" : "text-right"}>
                <SkeletonWords chars={chars} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {[9, 5, 4, 4].map((chars, i) => (
                <td key={i} className={`py-1.5 ${i === 0 ? "text-left" : "text-right"}`}>
                  <SkeletonWords chars={chars} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
