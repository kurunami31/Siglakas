import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LiveProvider } from "@/components/providers";
import { Ocean } from "@/components/ocean";
import { SiteHeader } from "@/components/site-header";
import { Ticker } from "@/components/ticker";
import { Icon } from "@/components/icons";
import { getViewerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    default: "Grand Line Tally — Live Championship Scoreboard",
    template: "%s · Grand Line Tally",
  },
  description:
    "Live medal tally and bounty board for the school-wide Socio-Cultural & Sports Festival. Twelve crews, one Grand Line.",
  applicationName: "Grand Line Tally",
};

export const viewport: Viewport = {
  themeColor: "#0d2740",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const state = await getViewerState();

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
        <LiveProvider initial={state}>
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
            <p className="mt-1">
              Built for the Grand Line · {state.events.length} islands · {state.teams.length} crews
            </p>
          </footer>
        </LiveProvider>
      </body>
    </html>
  );
}
