"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SqlCode } from "@/components/queries/SqlCode";
import { formatCount, formatDecimal, formatInteger } from "@/lib/format";
import { errorMessage } from "@/lib/validate";

/** Longest wait for one run of a catalog query. */
const RUN_TIMEOUT_MS = 10_000;
/** Result rows that rise in one after another; the rows after them appear without animation. */
const STAGGERED_ROWS = 12;
/** Result rows drawn in the table; the CSV holds every row. */
const SHOWN_ROWS = 200;
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

type Tab = "view" | "query" | "result";

/** Every row of a catalog query as a CSV download. */
const csvHref = (id: string) => `/api/query/${id}?format=csv`;

/** The catalog entry a panel's Query tab shows. */
export type PanelQuery = { id: string; sentence: string; sql: string };

/** Body of GET /api/query/{id}. */
type QueryRows = { columns: string[]; rows: Array<Record<string, unknown>>; rowCount: number; truncated: boolean };

type Run =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: QueryRows; ms: number }
  | { status: "error"; message: string };

/** Tabs under a panel's header: the panel's chart or values, the SQL behind them, and the rows that SQL returns. Panes
    slide sideways inside the chart pane's height, so the panel keeps its size on every tab; Run query opens Result. */
export function QueryTabs({ query, viewLabel, children }: { query: PanelQuery; viewLabel: string; children: ReactNode }) {
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "view", label: viewLabel },
    { key: "query", label: "Query" },
    { key: "result", label: "Result" },
  ];
  const baseId = useId();
  const [active, setActive] = useState<Tab>("view");
  /** Tabs opened at least once: the SQL and result panes are built on first open, not on every page view. */
  const [opened, setOpened] = useState<ReadonlySet<Tab>>(() => new Set(["view"]));
  const [sliding, setSliding] = useState(false);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const [height, setHeight] = useState<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const paneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const request = useRef<AbortController | null>(null);
  const index = tabs.findIndex((tab) => tab.key === active);

  useEffect(() => {
    const pane = paneRefs.current[0];
    if (!pane) return;
    const observer = new ResizeObserver(() => setHeight(pane.offsetHeight));
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  /** A page kept hidden after navigation runs this cleanup but keeps its state, so a run cut short goes back to idle
      instead of staying "running" with the button disabled. */
  useEffect(
    () => () => {
      request.current?.abort();
      setRun((current) => (current.status === "running" ? { status: "idle" } : current));
    },
    [],
  );

  function open(next: Tab) {
    if (next === active) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setSliding(true);
    setActive(next);
    setOpened((current) => (current.has(next) ? current : new Set(current).add(next)));
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Partial<Record<string, number>> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = (move + tabs.length) % tabs.length;
    open(tabs[next]?.key ?? "view");
    tabRefs.current[next]?.focus();
  }

  async function runQuery() {
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    open("result");
    /** The Run button's pane turns inert, so focus moves to the Result tab rather than falling back to the page. */
    tabRefs.current[tabs.findIndex((tab) => tab.key === "result")]?.focus();
    setRun({ status: "running" });
    const started = performance.now();
    try {
      const res = await fetch(`/api/query/${query.id}`, {
        cache: "no-store",
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(RUN_TIMEOUT_MS)]),
      });
      /** A proxy or server error page is HTML, not JSON, so the body is read as JSON only when it says it is. */
      const body: unknown = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
      if (!res.ok || body === null) {
        const reason = (body as { error?: unknown } | null)?.error;
        throw new Error(typeof reason === "string" ? reason : `The server answered ${res.status}`);
      }
      setRun({ status: "done", result: body as QueryRows, ms: Math.round(performance.now() - started) });
    } catch (error) {
      if (current.signal.aborted) return;
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      setRun({ status: "error", message: timedOut ? `No answer within ${RUN_TIMEOUT_MS / 1000} seconds` : errorMessage(error) });
    }
  }

  return (
    <>
      <div role="tablist" aria-label={`${viewLabel}, query and result`} className="segmented pill-track query-tabs mb-4 self-start">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.key}`}
            aria-controls={`${baseId}-pane-${tab.key}`}
            aria-selected={active === tab.key}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => open(tab.key)}
            onKeyDown={onTabKey}
            className="py-[5px] text-[13px]"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`-mx-1 px-1 transition-[height] duration-300 motion-reduce:transition-none ${EASE} ${sliding ? "overflow-hidden" : "overflow-x-clip"}`}
        style={height === null ? undefined : { height }}
      >
        <div
          className={`flex items-start transition-transform duration-[360ms] motion-reduce:transition-none ${EASE}`}
          style={{ transform: `translateX(-${index * 100}%)` }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "transform") setSliding(false);
          }}
        >
          {tabs.map((tab, i) => (
            <div
              key={tab.key}
              ref={(el) => {
                paneRefs.current[i] = el;
              }}
              role="tabpanel"
              id={`${baseId}-pane-${tab.key}`}
              aria-labelledby={`${baseId}-tab-${tab.key}`}
              inert={active !== tab.key}
              className={`w-full min-w-0 shrink-0 ${tab.key === "view" ? "" : "flex flex-col"} ${paneClass(tab.key, active === tab.key, sliding)}`}
              style={tab.key !== "view" && active === tab.key && height !== null ? { height } : undefined}
            >
              {tab.key === "view" ? children : null}
              {tab.key === "query" && opened.has("query") ? <QueryPane query={query} running={run.status === "running"} onRun={runQuery} /> : null}
              {tab.key === "result" && opened.has("result") ? <ResultPane query={query} run={run} /> : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Classes for a pane that is not open: the chart pane keeps its height, which every tab uses; the others collapse. */
function paneClass(key: Tab, isActive: boolean, sliding: boolean): string {
  if (isActive) return "";
  if (key === "view") return sliding ? "" : "invisible";
  return sliding ? "h-0" : "invisible h-0";
}

function QueryPane({ query, running, onRun }: { query: PanelQuery; running: boolean; onRun: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col text-[12.5px]">
      <p className="leading-relaxed text-ink-2">{query.sentence}</p>
      <pre role="region" aria-label={`SQL of query ${query.id}`} tabIndex={0} className="mt-2 min-h-0 overflow-auto rounded-[8px] bg-surface-3 p-3 text-[12px] leading-relaxed text-ink thin-scroll">
        <SqlCode sql={query.sql} />
      </pre>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onRun} disabled={running} className="btn btn-primary btn-sm disabled:pointer-events-none disabled:opacity-60">
          Run query
        </button>
        <a href={csvHref(query.id)} download className="btn btn-secondary btn-sm">
          CSV
        </a>
      </div>
    </div>
  );
}

function ResultPane({ query, run }: { query: PanelQuery; run: Run }) {
  const notice = "grid flex-1 place-items-center rounded-[8px] border border-dashed border-line-strong px-3 py-6 text-center text-[12.5px] text-muted";
  if (run.status === "idle") return <p className={notice}>This query has not run yet. Open the Query tab and press Run query to see its rows here.</p>;
  if (run.status === "running") {
    return (
      <div role="status" className="grid gap-1.5">
        <span className="sr-only">Running the query.</span>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} aria-hidden="true" className="skeleton h-[22px] rounded-[4px]" />
        ))}
      </div>
    );
  }
  if (run.status === "error") {
    return (
      <p role="alert" className={notice}>
        The query could not run: {run.message}.
      </p>
    );
  }

  const { columns, rows, rowCount, truncated } = run.result;
  return (
    <div className="flex min-h-0 flex-1 flex-col text-[12px]">
      {rows.length === 0 ? (
        <p className={notice}>The query returned no rows.</p>
      ) : (
        <div role="region" aria-label={`Rows returned by ${query.id}`} tabIndex={0} className="thin-scroll min-h-0 overflow-auto rounded-[8px] border border-line">
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="sticky top-0 z-10 bg-surface-3 px-2.5 py-1.5 text-right text-[12px] font-semibold tracking-[0.04em] whitespace-nowrap text-muted uppercase shadow-[inset_0_-1px_0_var(--border)] first:text-left"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, SHOWN_ROWS).map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-line last:border-0 ${i < STAGGERED_ROWS ? "feed-in" : ""}`}
                  style={i < STAGGERED_ROWS ? { animationDelay: `${i * 35}ms` } : undefined}
                >
                  {columns.map((column) => (
                    <td key={column} className="px-2.5 py-1.5 text-right whitespace-nowrap text-ink-2 first:text-left first:text-ink">
                      <Cell value={row[column]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > SHOWN_ROWS ? (
        <p className="mt-1.5 text-[11.5px] text-muted">
          Showing the first {formatInteger(SHOWN_ROWS)} of {formatCount(rows.length, "row")}.{" "}
          <a href={csvHref(query.id)} download className="font-medium text-ink hover:underline">
            Download the CSV
          </a>{" "}
          for all of them.
        </p>
      ) : null}
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11.5px] text-muted">
        <span>
          {formatCount(rowCount, "row")} in {run.ms} ms, read-only{truncated ? "; older rows are left out" : ""}.
        </span>
        <code>npm run query -- {query.id}</code>
      </p>
    </div>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted">null</span>;
  return typeof value === "number" ? formatDecimal(value) : String(value);
}
