"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readThemePreference, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Shown when the root layout itself fails; it replaces the layout, so it renders its own html and body, and applies the saved
    theme: with the script when rendered on the server, and with the effect when rendered after a client error. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  useLayoutEffect(() => applyTheme(readThemePreference()), []);
  return (
    <html lang="en" data-theme="light" data-theme-pref="light" suppressHydrationWarning>
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="grid min-h-screen place-items-center p-6 font-sans">
        <main className="panel w-full max-w-md">
          <h1 className="panel-head panel-title">NEAR Insights could not load</h1>
          <div className="panel-body flex flex-col items-start gap-3 p-5">
            <p className="text-[14px] leading-relaxed text-ink-2">An error stopped this page from loading. Try again in a moment.</p>
            <button type="button" onClick={() => retry()} className="btn btn-primary">
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
