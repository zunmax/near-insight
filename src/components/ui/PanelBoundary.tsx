"use client";

import { catchError, type ErrorInfo } from "next/error";

function PanelError({ title }: { title: string }, { retry }: ErrorInfo) {
  return (
    <section role="alert" className="panel h-full">
      <h2 className="panel-head panel-title">{title}</h2>
      <div className="panel-body panel-empty">
        <p className="text-[13px] leading-relaxed text-ink-2">This panel could not be loaded. The rest of the page still works. Try again in a moment.</p>
        <button type="button" onClick={() => retry()} className="btn btn-primary btn-sm">
          Try again
        </button>
      </div>
    </section>
  );
}

/** Contains a failing panel so the rest of the dashboard keeps rendering. */
export const PanelBoundary = catchError(PanelError);
