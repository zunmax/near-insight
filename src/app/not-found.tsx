import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-6">
      <div className="panel w-full max-w-md">
        <h1 className="panel-head panel-title">Page not found</h1>
        <div className="panel-body flex flex-col items-start gap-3 p-5">
          <p className="text-[14px] leading-relaxed text-ink-2">No page exists at this address.</p>
          <Link href="/dashboard/home" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
