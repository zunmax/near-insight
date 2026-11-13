import type { SqlTokenKind } from "@/lib/sql-tokens";

const TOKEN_CLASS: Record<SqlTokenKind, string> = {
  string: "text-code-string",
  comment: "text-muted",
  keyword: "font-semibold text-code-keyword",
  function: "text-code-function",
  number: "text-code-number",
};

/** Code split into plain text and tokens, each token colored by its kind; the caller supplies the surrounding <pre>. */
export function CodeTokens({ pieces }: { pieces: Array<{ text: string; kind: SqlTokenKind | null }> }) {
  return (
    <code>
      {pieces.map((piece, i) =>
        piece.kind ? (
          <span key={i} className={TOKEN_CLASS[piece.kind]}>
            {piece.text}
          </span>
        ) : (
          piece.text
        ),
      )}
    </code>
  );
}
