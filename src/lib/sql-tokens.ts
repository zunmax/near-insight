/** Splits catalog SQL into plain text and highlighted tokens, for the dashboard's SQL view and `npm run query`. */

export type SqlTokenKind = "string" | "comment" | "keyword" | "function" | "number";

/** SQL tokens, one capture group per kind in SQL_TOKEN_KINDS order: string literal, line comment, keyword, function name, number. */
const SQL_TOKEN =
  /('(?:[^']|'')*')|(--[^\n]*)|\b(WITH|SELECT|DISTINCT|FROM|WHERE|GROUP BY|ORDER BY|PARTITION BY|HAVING|LIMIT|LEFT JOIN|JOIN|ON|AND|OR|NOT|IN|IS|NULL|AS|CASE|WHEN|THEN|ELSE|END|OVER|ROWS|BETWEEN|UNBOUNDED|PRECEDING|FOLLOWING|CURRENT ROW|UNION ALL|VALUES|DESC|ASC|INTEGER|REAL)\b|\b([A-Za-z_][A-Za-z0-9_]*)(?=\()|\b(\d+(?:\.\d+)?)\b/g;

const SQL_TOKEN_KINDS: SqlTokenKind[] = ["string", "comment", "keyword", "function", "number"];

/** The SQL as consecutive pieces: plain text (kind null) and tokens with their kind. */
export function sqlTokens(sql: string): Array<{ text: string; kind: SqlTokenKind | null }> {
  const pieces: Array<{ text: string; kind: SqlTokenKind | null }> = [];
  let last = 0;
  for (const match of sql.matchAll(SQL_TOKEN)) {
    if (match.index > last) pieces.push({ text: sql.slice(last, match.index), kind: null });
    pieces.push({ text: match[0], kind: SQL_TOKEN_KINDS[match.slice(1).findIndex((value) => value !== undefined)]! });
    last = match.index + match[0].length;
  }
  if (last < sql.length) pieces.push({ text: sql.slice(last), kind: null });
  return pieces;
}
