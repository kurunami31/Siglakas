import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { LiveProvider } from "@/components/providers";
import { Ocean } from "@/components/ocean";
import { SiteHeader } from "@/components/site-header";
import { Ticker } from "@/components/ticker";
import { Icon } from "@/components/icons";
import { getViewerState } from "@/lib/server-state";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  // Required for absolute OpenGraph/canonical URLs. Without it Next emits a
  // RELATIVE og:image, which social scrapers cannot resolve, so link previews
  // silently show nothing.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://siglakas.vercel.app"),
  title: {
    default: "Grand Line Tally — Live Championship Scoreboard",
    template: "%s · Grand Line Tally",
  },
  description:
    "Live medal tally and bounty board for the school-wide Socio-Cultural & Sports Festival. Twelve crews, one Grand Line.",
  applicationName: "Grand Line Tally",
  openGraph: {
    title: "Grand Line Tally — SIGLAKAS 2026",
    description:
      "Live medal tally and bounty board for the DOrSU SIGLAKAS 2026 Socio-Cultural & Sports Festival.",
    siteName: "Grand Line Tally",
    images: [{ url: "/brand/siglakas-logo-1024.png", width: 1024, height: 1024, alt: "SIGLAKAS 2026" }],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2740",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const state = await getViewerState();
  const session = await getSession();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Pirata+One&family=Bangers&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only sr-only-focusable print:hidden">
          Skip to content
        </a>
        <LiveProvider initial={state} role={session?.role ?? null}>
          <Ocean />
          <SiteHeader />
          <Ticker />
          <main id="main" className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-7">
            {children}
          </main>
          <footer className="mt-10 border-t border-foam/15 bg-ink/60 px-3 py-6 text-center text-xs text-foam/60 sm:px-5 print:hidden">
            <p className="font-display flex items-center justify-center gap-2 text-base text-parchment/80">
              <Icon name="ship" size={18} />
              {state.config.competitionName}
            </p>
            <p className="mt-1">
              {state.config.schoolName} · Original pirate-inspired artwork. Crew mascot logos are the property of their
              respective faculties and campuses.
            </p>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link href="/welcome" className="min-h-6 text-foam/70 hover:text-straw hover:underline">
                Welcome
              </Link>
              <Link href="/about" className="min-h-6 text-foam/70 hover:text-straw hover:underline">
                About the developer
              </Link>
            </p>
            <p className="mt-1">
              Built for the Grand Line · {state.events.length} islands · {state.teams.length} crews
            </p>
          </footer>
        </LiveProvider>
      </body>
    </html>
  );
}
