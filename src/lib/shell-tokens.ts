import type { SqlTokenKind } from "@/lib/sql-tokens";

/** Shell tokens in the code part of a line (comments are split off first), one capture group per kind in SHELL_TOKEN_KINDS
    order: double- or single-quoted string, command or loop word, loop variable name or $variable, short flag. */
const SHELL_TOKEN =
  /("(?:[^"\\]|\\.)*"|'[^']*')|(?<![\w.-])(curl|npm|git|for|in|do|done)(?![\w.-])|((?<![\w.-])rpc(?![\w.-])|\$\w+)|(?<=\s)(-[a-zA-Z])\b/g;

const SHELL_TOKEN_KINDS: SqlTokenKind[] = ["string", "keyword", "function", "number"];

type Piece = { text: string; kind: SqlTokenKind | null };

/** Index of the `#` that starts a comment on the line: outside quotes and at the start of a word; -1 when there is none. */
function commentStart(line: string): number {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "#" && (i === 0 || /\s/.test(line[i - 1]!))) return i;
  }
  return -1;
}

function codePieces(code: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  for (const match of code.matchAll(SHELL_TOKEN)) {
    if (match.index > last) pieces.push({ text: code.slice(last, match.index), kind: null });
    pieces.push({ text: match[0], kind: SHELL_TOKEN_KINDS[match.slice(1).findIndex((value) => value !== undefined)]! });
    last = match.index + match[0].length;
  }
  if (last < code.length) pieces.push({ text: code.slice(last), kind: null });
  return pieces;
}

/** Shell commands as consecutive pieces: plain text (kind null) and tokens with their kind, line breaks kept. */
export function shellTokens(script: string): Piece[] {
  return script.split("\n").flatMap((line, i) => {
    const start = commentStart(line);
    const pieces = start < 0 ? codePieces(line) : [...codePieces(line.slice(0, start)), { text: line.slice(start), kind: "comment" as const }];
    return i === 0 ? pieces : [{ text: "\n", kind: null }, ...pieces];
  });
}
