/** A good system status (a protocol feature that is live) shown with a shape and a label, never by color alone. */
export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap text-ink">
      <StatusIcon />
      {label}
    </span>
  );
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-[15px] shrink-0">
      <circle cx="8" cy="8" r="7" fill="var(--up)" />
      <path d="M4.6 8.2 7 10.6l4.4-5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
