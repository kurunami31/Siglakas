import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewerState } from "@/lib/server-state";
import { Icon } from "@/components/icons";
import { PartnerLogos } from "@/components/partner-logos";
import { SplitText } from "@/components/split-text";
import { terms } from "@/lib/terminology";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome" };

/**
 * Welcome / landing page.
 *
 * Deliberately a separate route rather than `/`: the Bounty Board is the screen
 * people open during the festival, and it should never be one click away from
 * the live numbers. Link here from the navigation instead.
 */
export default async function WelcomePage() {
  const state = await getViewerState();
  const t = terms(state.config);
  const medals = state.events.reduce((s, e) => s + e.medalWeight, 0);
  const live = state.events.filter((e) => e.status === "live").length;

  const cards = [
    { href: "/", label: t.leaderboard, icon: "flag" as const, note: "The live standings" },
    { href: "/medals", label: "Medal Tally", icon: "medal" as const, note: "Gold, silver and bronze" },
    { href: "/events", label: t.islands, icon: "map" as const, note: "Every event and result" },
    { href: "/sports", label: t.sports, icon: "ball" as const, note: "Match fixtures and brackets" },
  ];

  return (
    <div className="space-y-7">
      <section className="panel relative overflow-hidden rounded-2xl p-6 text-center sm:p-10">
        {/* Drifting accent blobs — a living hero instead of a flat panel. Uses
            the existing `floaty` keyframe, and globals.css collapses every
            animation under prefers-reduced-motion, so it simply sits still. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-ocean-2/40 blur-3xl animate-[floaty_16s_ease-in-out_infinite]" />
          <span className="absolute -right-6 top-8 h-48 w-48 rounded-full bg-sunset/30 blur-3xl animate-[floaty_21s_ease-in-out_infinite]" />
          <span className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-straw/25 blur-3xl animate-[floaty_26s_ease-in-out_infinite]" />
        </div>
        <div className="relative">
        <p className="font-stencil text-xs uppercase tracking-[0.3em] text-sunset sm:text-sm">
          {state.config.schoolName}
        </p>
        <h1 className="font-display mt-1 text-4xl text-parchment sm:text-6xl">
          <SplitText text={state.config.competitionName} delay={0.1} />
        </h1>
        <p className="font-display mt-2 text-2xl text-straw sm:text-3xl">
          {state.config.subtitle || "Grand Line Tally"}
        </p>
        <p className="mx-auto mt-3 max-w-prose text-sm text-foam/80 sm:text-base">
          The live scoreboard for the SIGLAKAS 2026 Socio-Cultural &amp; Sports Festival — every
          island, every crew, every medal, as it happens.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-straw px-5 font-semibold text-ink transition hover:brightness-110"
          >
            <Icon name="flag" size={17} /> Open the {t.leaderboard}
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-foam/25 px-5 text-sm font-semibold text-parchment/90 transition hover:border-straw hover:text-straw"
          >
            <Icon name="users" size={16} /> About the developer
          </Link>
        </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t.teams, value: state.teams.length, icon: "flag" as const },
          { label: t.islands, value: state.events.length, icon: "map" as const },
          { label: "Medals at stake", value: medals, icon: "medal" as const },
        ].map((s) => (
          <div key={s.label} className="panel flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-center">
            <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest text-foam/70">
              <Icon name={s.icon} size={13} />
              {s.label}
            </p>
            <p className="font-display text-2xl leading-none text-straw">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-parchment">Where to go</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="panel panel-hover flex items-center gap-3 rounded-2xl p-4"
            >
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-straw/15 text-straw">
                <Icon name={c.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-parchment">{c.label}</span>
                <span className="block truncate text-xs text-foam/70">{c.note}</span>
              </span>
              <Icon name="chevronRight" size={16} className="ml-auto shrink-0 text-foam/50" />
            </Link>
          ))}
        </div>
      </section>

      <section className="panel rounded-2xl p-5">
        <h2 className="font-display text-center text-xl text-parchment">Organized by</h2>
        <PartnerLogos className="mt-4" />
      </section>

      <p className="text-center text-xs text-foam/60">
        {live > 0 ? `${live} event${live === 1 ? "" : "s"} live right now. ` : ""}
        Crew mascot logos are the property of their respective faculties and campuses.
      </p>
    </div>
  );
}
