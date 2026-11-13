/** Runs a query from the catalog (src/db/named-queries/) against the dashboard's database and prints its SQL and result.
    `node scripts/query.ts` lists every query; `node scripts/query.ts <id> [--csv] [--all] [--db <path>]` runs one, printing
    the first 20 rows unless --all, or CSV with --csv; --db reads another database such as snapshot/dashboard.db. */
import { existsSync } from "node:fs";
import { styleText } from "node:util";
import { DATABASE_PATH } from "../src/config/database.ts";
import { PAGE_LABEL } from "../src/config/navigation.ts";
import { openReader } from "../src/db/connection.ts";
import { NAMED_QUERIES, namedQuery } from "../src/db/named-queries/index.ts";
import { csvLines } from "../src/lib/csv.ts";
import { formatCount } from "../src/lib/format.ts";
import { sqlTokens, type SqlTokenKind } from "../src/lib/sql-tokens.ts";
import { errorMessage } from "../src/lib/validate.ts";

const PREVIEW_ROWS = 20;
/** Terminal colors of SQL tokens, close to the dashboard's SQL view; styleText leaves them out when output is not a terminal or NO_COLOR is set. */
const TOKEN_STYLE: Record<SqlTokenKind, Parameters<typeof styleText>[0]> = {
  string: "green",
  comment: "gray",
  keyword: ["bold", "blueBright"],
  function: "magenta",
  number: "yellow",
};
/** Widest line of wrapped text: the terminal's width, at most 100 columns. */
const WIDTH = Math.min(process.stdout.columns || 100, 100);
const INDENT = "  ";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--db");

/** Text broken into lines at word boundaries to fit WIDTH: the first line starts with `first`, the rest with `rest`. */
function wrap(text: string, first = INDENT, rest = first): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const prefix = lines.length === 0 ? first : rest;
    if (line && prefix.length + line.length + 1 + word.length > WIDTH) {
      lines.push(prefix + line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push((lines.length === 0 ? first : rest) + line);
  return lines.join("\n");
}

/** A block under a bold title, followed by a blank line. */
const section = (title: string, body: string) => `${styleText("bold", title)}\n${body}\n`;

type SqlPiece = ReturnType<typeof sqlTokens>[number];

/** Widest SQL line inside the box: the terminal's width less the indent and the box's edges and padding. */
const SQL_WIDTH = (process.stdout.columns || 120) - INDENT.length - 4;

/** One SQL line as one or more lines of pieces that fit SQL_WIDTH. It breaks only at spaces, so a word with the punctuation
    touching it (a string and its comma, a name and its bracket) stays whole; continuation lines are indented four spaces more. */
function wrapSqlLine(line: string): SqlPiece[][] {
  /** Words: runs of pieces with no space between them, each with the spaces that come before it. */
  const words: Array<{ space: string; pieces: SqlPiece[] }> = [{ space: "", pieces: [] }];
  for (const piece of sqlTokens(line)) {
    const parts = piece.kind ? [piece.text] : piece.text.split(/(\s+)/).filter(Boolean);
    for (const text of parts) {
      if (!piece.kind && /^\s+$/.test(text)) words.push({ space: text, pieces: [] });
      else words.at(-1)!.pieces.push({ text, kind: piece.kind });
    }
  }
  const width = (pieces: SqlPiece[]) => pieces.reduce((sum, piece) => sum + piece.text.length, 0);
  const continuation = `${line.match(/^\s*/)![0]}    `;
  const lines: SqlPiece[][] = [];
  let current: SqlPiece[] = [];
  let length = 0;
  for (const word of words) {
    const size = width(word.pieces);
    if (current.length > 0 && length + word.space.length + size > SQL_WIDTH && size > 0) {
      lines.push(current);
      current = [{ text: continuation, kind: null }, ...word.pieces];
      length = continuation.length + size;
    } else {
      current.push({ text: word.space, kind: null }, ...word.pieces);
      length += word.space.length + size;
    }
  }
  lines.push(current);
  return lines;
}

/** SQL inside a dotted box, colored, wrapped to the terminal and indented like the other sections, with the border dimmed. */
function sqlBox(sql: string): string {
  const lines = sql.split("\n").flatMap(wrapSqlLine);
  const plain = (pieces: SqlPiece[]) => pieces.map((piece) => piece.text).join("");
  const colored = (pieces: SqlPiece[]) => pieces.map((piece) => (piece.kind ? styleText(TOKEN_STYLE[piece.kind], piece.text) : piece.text)).join("");
  const width = Math.max(...lines.map((pieces) => plain(pieces).length));
  const edge = (text: string) => styleText("dim", text);
  return [
    `${INDENT}${edge(`┌${"┄".repeat(width + 2)}┐`)}`,
    ...lines.map((pieces) => `${INDENT}${edge("┆")} ${colored(pieces)}${" ".repeat(width - plain(pieces).length)} ${edge("┆")}`),
    `${INDENT}${edge(`└${"┄".repeat(width + 2)}┘`)}`,
  ].join("\n");
}

/** Every query, grouped under the page that shows it, with ids padded so the titles line up. */
function listQueries(): void {
  const idWidth = Math.max(...NAMED_QUERIES.map((query) => query.id.length)) + 2;
  let page = "";
  for (const query of NAMED_QUERIES) {
    if (query.page !== page) {
      console.log(`${page ? "\n" : ""}${styleText("bold", PAGE_LABEL.get(query.page) ?? query.page)}`);
      page = query.page;
    }
    console.log(`${INDENT}${styleText("green", query.id.padEnd(idWidth))}${query.title}`);
  }
  console.log(styleText("dim", "\nRun one with: npm run query -- <id> [--csv] [--all] [--db <path>]"));
}

function main() {
  if (!id) {
    listQueries();
    return;
  }
  const query = namedQuery(id);
  if (!query) throw new Error(`No query "${id}". Run npm run query to list them.`);
  const path = option("--db") ?? DATABASE_PATH;
  if (!existsSync(path)) throw new Error(`No database at ${path}. Run npm run ingest, or pass --db snapshot/dashboard.db.`);

  const db = openReader(path);
  try {
    const statement = db.prepare(query.sql);
    const rows = statement.all();
    if (flag("--csv")) {
      console.log(csvLines(statement.columns().map((column) => column.name), rows).join("\n"));
      return;
    }
    const shown = flag("--all") ? rows : rows.slice(0, PREVIEW_ROWS);
    console.log(
      [
        section(query.title, `${INDENT}${styleText("green", query.id)}${styleText("dim", ` · shown on ${PAGE_LABEL.get(query.page) ?? query.page}`)}`),
        section("What it shows", wrap(query.sentence)),
        section("Filled by", query.requests.map((request) => wrap(request, `${INDENT}- `, `${INDENT}  `)).join("\n")),
        ...(query.code ? [section("Calculated further in", wrap(query.code))] : []),
        `${sqlBox(query.sql)}\n`,
        `${styleText("bold", "Result")}${styleText("dim", ` · ${shown.length === rows.length ? formatCount(rows.length, "row") : `first ${shown.length} of ${formatCount(rows.length, "row")} (--all for every row)`}, from ${path}`)}`,
      ].join("\n"),
    );
    console.table(shown);
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
}
