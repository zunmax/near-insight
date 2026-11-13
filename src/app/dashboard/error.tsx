"use client";

/** Shown when a dashboard page fails; the dashboard layout stays, and Try again renders the page again. */
export default function RouteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="content" tabIndex={-1} className="grid min-h-[60vh] place-items-center p-6 outline-none">
      <div className="panel w-full max-w-md">
        <h1 className="panel-head panel-title">This page could not load</h1>
        <div className="panel-body flex flex-col items-start gap-3 p-5">
          <p className="text-[14px] leading-relaxed text-ink-2">An error stopped this page from loading. The navigation still works. Try again in a moment.</p>
          <button type="button" onClick={() => retry()} className="btn btn-primary">
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
