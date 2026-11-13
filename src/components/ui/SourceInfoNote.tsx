"use client";

import { useEffect, useState, type FocusEvent, type ReactNode } from "react";

/** The "i" button and its note (`children`, rendered on the server by SourceInfo), shown while the pointer is over it or focus
    is inside it (`.source-info` in globals.css). Escape hides the note until both have left. */
export function SourceInfoNote({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shown = (hovered || focused) && !dismissed;

  useEffect(() => {
    if (!shown) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shown]);

  const onMouseLeave = () => {
    setHovered(false);
    if (!focused) setDismissed(false);
  };
  const onBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setFocused(false);
    if (!hovered) setDismissed(false);
  };

  return (
    <span
      className="source-info"
      data-dismissed={dismissed || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onMouseLeave}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <button type="button" aria-label="Data sources" aria-expanded={shown}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" className="size-4">
          <circle cx="8" cy="8" r="6.3" />
          <path d="M8 7.4v3.6M8 5.1v.1" />
        </svg>
      </button>
      <span className="source-info-tip">{children}</span>
    </span>
  );
}
