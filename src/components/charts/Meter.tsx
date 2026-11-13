/** A share of a whole as a thin progress bar that fills from the left on load. */
export function Meter({ share, label }: { share: number; label: string }) {
  const clamped = Math.min(1, Math.max(0, share));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)} className="meter">
      <span style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
