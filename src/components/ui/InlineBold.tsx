import { Fragment, type ReactNode } from "react";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";

/** A span marked `**like this**`, the same marking THESIS.md renders as bold. */
const BOLD = /\*\*(.+?)\*\*/g;

/** `text` with its `**marked**` spans in bold and every date and hyphenated id kept on one line. */
export function InlineBold({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    parts.push(<NoBreakTokens key={`t${match.index}`} text={text.slice(last, match.index)} />);
    parts.push(
      <strong key={`b${match.index}`} className="font-semibold text-ink">
        <NoBreakTokens text={match[1]!} />
      </strong>,
    );
    last = match.index + match[0].length;
  }
  parts.push(<NoBreakTokens key="end" text={text.slice(last)} />);
  return <Fragment>{parts}</Fragment>;
}
