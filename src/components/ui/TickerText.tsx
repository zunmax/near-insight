import type { ReactNode } from "react";

/** Logo marks (viewBox 0 0 24 24) shown before a cashtag or hashtag of these symbols. NEAR: Simple Icons, CC0. */
export const TICKER_ICONS: Record<string, string> = {
  NEAR: "M21.443 0c-.89 0-1.714.46-2.18 1.218l-5.017 7.448a.533.533 0 0 0 .792.7l4.938-4.282a.2.2 0 0 1 .334.151v13.41a.2.2 0 0 1-.354.128L5.03.905A2.555 2.555 0 0 0 3.078 0h-.521A2.557 2.557 0 0 0 0 2.557v18.886a2.557 2.557 0 0 0 4.736 1.338l5.017-7.448a.533.533 0 0 0-.792-.7l-4.938 4.283a.2.2 0 0 1-.333-.152V5.352a.2.2 0 0 1 .354-.128l14.924 17.87c.486.574 1.2.905 1.952.906h.521A2.558 2.558 0 0 0 24 21.445V2.557A2.558 2.558 0 0 0 21.443 0Z",
};

/** A `$` or `#` tag that starts a word, followed by a letter and more letters, digits or underscores. */
const TAG_PATTERN = /(?<![\w$#])[$#][A-Za-z]\w*/g;

/** One cashtag or hashtag in the accent color, with the symbol's logo before it when one is known. */
function Tag({ tag }: { tag: string }) {
  const icon = TICKER_ICONS[tag.slice(1).toUpperCase()];
  return (
    <span className="whitespace-nowrap text-accent-text">
      {icon ? (
        /** One inline SVG, so its bottom edge is the baseline and the circle centers on capital letters. */
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-[0.2em] inline-block size-[1.1em] align-[-0.2em]">
          <circle cx="12" cy="12" r="12" className="fill-ink" />
          <path d={icon} transform="translate(5.4 5.4) scale(0.55)" className="fill-bg" />
        </svg>
      ) : null}
      {tag}
    </span>
  );
}

/** Text with its cashtags ($NEAR) and hashtags (#NEAR) marked the way X shows them. */
export function TickerText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(TAG_PATTERN)) {
    parts.push(text.slice(end, match.index), <Tag key={match.index} tag={match[0]} />);
    end = match.index + match[0].length;
  }
  parts.push(text.slice(end));
  return parts;
}
