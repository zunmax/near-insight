import type { CSSProperties, ReactNode } from "react";

/** Lengths of the placeholder words, repeated, so placeholder lines wrap and end unevenly like prose; with the narrow spaces
    between them, a run of these is about as wide as the same number of characters of the dashboard's text in Inter. */
const WORD_LENGTHS = [3, 5, 2, 7, 4, 3, 6, 2, 5, 4];

/** Words of transparent "x"s about `chars` characters long in all, an "x" being about as wide as an average character. */
function placeholderWords(chars: number) {
  const words: string[] = [];
  for (let used = 0, i = 0; used < chars; i++) {
    const length = Math.min(WORD_LENGTHS[i % WORD_LENGTHS.length]!, chars - used);
    words.push("x".repeat(length));
    used += length + 1;
  }
  return words.join(" ");
}

/** Placeholder for about `chars` characters of text, set in the surrounding font: one shimmering bar per line, wrapping where
    that text would, so it takes as many lines as the text at every screen width. */
export function SkeletonWords({ chars }: { chars: number }) {
  return (
    <span aria-hidden="true" className="skeleton box-decoration-clone text-transparent select-none">
      {placeholderWords(chars)}
    </span>
  );
}

/** A table cell's placeholder: its text's length (0 for an empty cell, which stacked phone rows leave out), a second smaller
    line under it with that line's classes, and classes the real cell has, such as `max-sm:hidden` on a column phones leave out. */
type CellSkeleton = number | { chars: number; detail?: number; detailClassName?: string; className?: string };

/** A cell as the row's label (`header`), a left-aligned value before it (`lead`, e.g. a rank), or a right-aligned value. */
function TableCellSkeleton({ cell, header, lead }: { cell: CellSkeleton; header: boolean; lead: boolean }) {
  const { chars, detail, detailClassName = "mt-0.5 text-[11.5px]", className = "" } = typeof cell === "number" ? { chars: cell } : cell;
  if (chars === 0) return <td className={className} />;
  const content = (
    <div className={header || lead ? "" : "max-sm:text-right"}>
      {/** A value is one unbreakable token (a number or date), so only the first column's labels wrap. */}
      <span className={header ? "block" : "block whitespace-nowrap"}>
        <SkeletonWords chars={chars} />
      </span>
      {detail ? (
        <span className={`block ${detailClassName}`}>
          <SkeletonWords chars={detail} />
        </span>
      ) : null}
    </div>
  );
  return header ? <th className={`text-left ${className}`}>{content}</th> : <td className={`${lead ? "" : "text-right"} ${className}`}>{content}</td>;
}

/** Placeholder for a `.data-table` with the same classes, so it stacks on phones (`stack`) and hides columns as the table does.
    `headers` are the column names' lengths, which set the column widths; `rows` is a row count (each row like `columns`) or each row's cells. */
export function TableSkeleton({
  headers,
  rows,
  columns,
  rowHeader = 0,
  stack = false,
  className = "",
}: {
  headers: number[];
  rows: number | CellSkeleton[][];
  columns: CellSkeleton[];
  /** Column holding each row's label; the columns before it are left-aligned values. */
  rowHeader?: number;
  stack?: boolean;
  className?: string;
}) {
  const hidden = (cell: CellSkeleton) => (typeof cell === "number" ? "" : (cell.className ?? ""));
  const body = typeof rows === "number" ? Array.from({ length: rows }, () => columns) : rows;
  return (
    <table aria-hidden="true" className={`data-table ${stack ? "data-table-stack" : ""} ${className}`}>
      <thead>
        <tr>
          {columns.map((cell, i) => (
            <th key={i} className={`${i <= rowHeader ? "" : "text-right"} ${hidden(cell)}`}>
              <SkeletonWords chars={headers[i] ?? 6} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((cells, row) => (
          <tr key={row}>
            {cells.map((cell, i) => (
              <TableCellSkeleton key={i} cell={cell} header={i === rowHeader} lead={i < rowHeader} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type PanelSkeletonProps = {
  /** Length of the title of the panel it stands in for. */
  title: number;
  /** Length of the post text under the title, when the panel has a description. */
  text?: number;
  /** Label of the first tab when the panel has Query and Result tabs (Panel's `sqlId` and `viewLabel`). */
  tabs?: string;
  /** Placeholder of the title row's right side; the row wraps it under the title when too narrow, as the panel's does. */
  action?: ReactNode;
  /** The panel has a source button at the right of its title row (Panel's `sources`), whose room the title wraps around. */
  source?: boolean;
  /** The body flows under the post text without the media box, as Panel's `textBody`. */
  textBody?: boolean;
  /** Avatar of the post it stands in for (avatarStyle), so the avatar does not change once it loads. */
  style?: CSSProperties;
  /** Placeholders of the panel's body, built from the same layout classes as the body. */
  children?: ReactNode;
};

/** A loading post laid out as the Panel it stands in for: the title row, the post text, the tab row and the body, so it is
    as tall as the panel at every screen width and nothing moves when the panel streams in. */
export function PanelSkeleton({ title, text, tabs, action, source = true, textBody = false, style, children }: PanelSkeletonProps) {
  return (
    <div aria-hidden="true" className="panel" style={style}>
      <div className={`panel-head${action ? " flex-wrap" : ""}`}>
        <span className="panel-title">
          <SkeletonWords chars={title} />
        </span>
        {action}
        {source ? <span className="size-4 shrink-0" /> : null}
      </div>
      {text ? (
        <p className="post-text px-4 pt-1 text-[14px] leading-relaxed">
          <SkeletonWords chars={text} />
        </p>
      ) : null}
      {children ? (
        <div className={`panel-body flex flex-col${textBody ? " post-text" : ""}`}>
          {tabs ? (
            <div className="segmented pill-track query-tabs mb-4 self-start">
              {[tabs, "Query", "Result"].map((label) => (
                <span key={label} className="py-[5px] text-[13px] whitespace-nowrap">
                  <SkeletonWords chars={label.length} />
                </span>
              ))}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Placeholder for a note under a chart (`mt-3 text-[12px] leading-relaxed`), the most common last line of a panel. */
export function NoteSkeleton({ chars }: { chars: number }) {
  return (
    <p className="mt-3 text-[12px] leading-relaxed">
      <SkeletonWords chars={chars} />
    </p>
  );
}
