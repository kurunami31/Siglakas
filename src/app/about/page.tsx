import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "About the developer",
  description: "Who built the Grand Line Tally scoreboard for the SIGLAKAS 2026 festival.",
};

const GITHUB = "https://github.com/kurunami31";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          <Image
            src="/developer.jpg"
            alt="Christopher Lyod Mercado"
            width={160}
            height={160}
            priority
            className="h-32 w-32 shrink-0 rounded-2xl object-cover ring-2 ring-straw/40 sm:h-40 sm:w-40"
          />
          <div className="min-w-0">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-sunset">Developer</p>
            <h1 className="font-display mt-1 text-3xl text-parchment sm:text-4xl">
              Christopher Lyod Mercado
            </h1>
            <p className="mt-2 max-w-prose text-sm text-foam/80">
              Designer and developer of the Grand Line Tally — the live scoreboard for the
              DOrSU SIGLAKAS 2026 Socio-Cultural &amp; Sports Festival.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <a
                href={GITHUB}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-foam/25 px-4 text-sm font-semibold text-parchment/90 transition hover:border-straw hover:text-straw"
              >
                <Icon name="compass" size={15} /> github.com/kurunami31
              </a>
              <Link
                href="/welcome"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-foam/25 px-4 text-sm text-parchment/90 transition hover:border-straw hover:text-straw"
              >
                <Icon name="chevronLeft" size={14} /> Back to welcome
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="panel rounded-2xl p-6">
        <h2 className="font-display flex items-center gap-2 text-2xl text-parchment">
          <Icon name="ship" size={22} className="text-straw" /> About the project
        </h2>
        <p className="mt-2 max-w-prose text-sm text-foam/80">
          A single live scoreboard for a twelve-crew, ninety-seven-event festival, built so that a
          result entered at the field appears on the board — and on the projector — within seconds.
          The Google Sheet remains the source of truth, so the tally can be read, audited and
          exported by the organisers even if the site is offline.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Front end", "Next.js (App Router) · React · Tailwind CSS"],
            ["Live data", "Server-sent events with a polling fallback"],
            ["Source of truth", "Google Sheets, read through a service account"],
            ["Scoring", "Placement, judged criteria and match brackets"],
            ["Accounts", "PIO, Secretariat and Super Admin roles"],
            ["Artwork", "Original SVG; the festival mark is official SIGLAKAS artwork"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-foam/15 bg-ink/40 p-3">
              <dt className="text-[0.65rem] uppercase tracking-widest text-foam/60">{k}</dt>
              <dd className="mt-0.5 text-sm text-parchment/90">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-center text-xs text-foam/60">
        Built for the Grand Line · {new Date().getFullYear()}
      </p>
    </div>
  );
}
