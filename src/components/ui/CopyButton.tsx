"use client";

import { useEffect, useRef, useState } from "react";

/** How long the check mark shows after copying. */
const COPIED_MS = 1500;

/** An icon button that copies `text` to the clipboard and shows a check mark for a moment; `label` names what it copies. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy: ${label}`}
      className={`grid size-[30px] shrink-0 place-items-center rounded-lg transition-colors hover:bg-[var(--hover)] ${copied ? "text-accent" : "text-muted hover:text-ink"}`}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={copied ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
        {copied ? (
          <path d="M3.5 8.5l3 3 6-6.5" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
          </>
        )}
      </svg>
    </button>
  );
}
