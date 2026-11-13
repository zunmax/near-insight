import { Fragment, type ReactNode } from "react";

/** ISO dates (2026-11-09) and hyphenated ids (HSP-029), which browsers would otherwise break at the hyphen. */
const TOKEN = /\d{4}-\d{2}-\d{2}|\b[A-Z]{2,}-\d+\b/g;

/** `text` with every date and hyphenated id kept on one line; the rest wraps normally. */
export function NoBreakTokens({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} className="whitespace-nowrap">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
