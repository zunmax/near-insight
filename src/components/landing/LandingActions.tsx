import Link from "next/link";

/** The landing page's two calls to action: open the dashboard, or jump to the thesis on the dashboard's Home. */
export function LandingActions({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      <Link href="/dashboard/home" className="btn btn-primary">
        See the live numbers
      </Link>
      <Link href="/dashboard/home#how-it-works" className="btn btn-secondary">
        How the thesis works
      </Link>
    </div>
  );
}
