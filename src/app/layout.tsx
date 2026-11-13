import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SITE } from "@/config/site";
import { THEME_COLORS } from "@/config/theme";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.name,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  /** No title or description here: Next fills the og: and twitter: tags from each page's own title and description. */
  openGraph: { type: "website", siteName: SITE.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

/** The browser UI color of the default light theme; the theme script switches it to the saved theme before first paint. */
export const viewport: Viewport = {
  themeColor: THEME_COLORS.light,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" data-theme-pref="light" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        {/** Applies the saved or system theme before first paint (src/lib/theme.ts). Browser extensions (wallets) insert
            their own <script> at the top of <head> before hydration; suppressHydrationWarning lets React keep it. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
