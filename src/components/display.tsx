"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLive } from "./providers";
import { TeamBadge } from "./team-badge";
import { CountUp } from "./count-up";
import { sortStandings } from "@/lib/scoring/rank";
import { formatBounty } from "@/lib/format";
import { terms } from "@/lib/terminology";
import { relativeTime } from "@/lib/format";
import { Icon, MedalCount, MedalIcon } from "./icons";

const ROTATE_MS = 12_000;

export function DisplayView() {
  const { state, connected, transport } = useLive();
  const t = terms(state.config);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const ordered = useMemo(() => sortStandings(state.standings, "overall"), [state.standings]);
  const liveMatches = useMemo(() => state.matches.filter((m) => m.status === "live"), [state.matches]);
  const latestResults = useMemo(
    () => state.results.filter((r) => r.status === "published").slice(-6).reverse(),
    [state.results],
  );

  const slides = useMemo(
    () => [
      { id: "overall", label: t.overall },
      { id: "medals", label: "Medal Tally" },
      ...(liveMatches.length ? [{ id: "live", label: "Live Matches" }] : []),
      { id: "latest", label: "Latest Results" },
      ...(state.announcements.length ? [{ id: "news", label: "Announcements" }] : []),
    ],
    [t.overall, liveMatches.length, state.announcements.length],
  );

  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || reduce) return;
    const id = setInterval(next, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, next, reduce]);

  useEffect(() => {
    // Set on mount (not during render) so server and client HTML match.
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // every slide starts at the top, even if the previous one was scrolled
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
      // TV mode covers the whole viewport, so this is the keyboard way out.
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, router]);

  if (index >= slides.length) setIndex(0);
  const current = slides[index];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-b from-ink via-navy to-ink text-parchment">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-foam/15 px-4 py-3 sm:px-6 sm:py-4">
        <span aria-hidden className="hidden text-straw sm:inline">
          <Icon name="compass" size={32} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display truncate text-xl sm:text-3xl">{state.config.subtitle || "Grand Line Tally"}</h1>
          <p className="truncate text-xs text-foam/70 sm:text-sm">{state.config.competitionName}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foam/25 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider sm:gap-2 sm:px-3 sm:text-sm">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${connected ? "animate-pulse bg-teal" : "bg-blood"}`} />
            {connected ? t.live : "Reconnecting"}
            <span className="sr-only">transport {transport}</span>
          </span>
          <time className="font-display text-lg tabular-nums sm:text-2xl" dateTime={clock?.toISOString()}>
            {clock
              ? clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "--:--:--"}
          </time>
          <Link
            href="/"
            aria-label="Exit TV mode and go back to the home screen"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-xs font-semibold hover:border-straw hover:text-straw sm:text-sm"
          >
            <Icon name="chevronLeft" size={15} />
            <span className="hidden sm:inline">Exit TV mode</span>
            <span className="sm:hidden">Exit</span>
          </Link>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-xs hover:border-straw hover:text-straw sm:text-sm"
          >
            <Icon name={paused ? "play" : "pause"} size={15} />
            {paused ? "Play" : "Pause"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-foam/10 px-4 py-2 text-xs text-foam/70 sm:px-6 sm:text-sm">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-3 ${i === index ? "bg-straw text-ink" : "hover:bg-foam/10"}`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto hidden text-xs sm:inline">
          {index + 1}/{slides.length} · {paused ? "paused" : "auto-rotating"}
        </span>
      </div>

      <div
        ref={mainRef}
        role="region"
        aria-label="TV slides"
        tabIndex={0}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-straw sm:p-6"
      >
        <AnimatePresence mode="wait">
          <motion.section
            key={current?.id}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -24 }}
            transition={{ duration: 0.5 }}
            className="min-h-full"
            aria-label={current?.label}
          >
            {current?.id === "overall" && <SlideOverall ordered={ordered} state={state} />}
            {current?.id === "medals" && <SlideMedals ordered={ordered} state={state} />}
            {current?.id === "live" && <SlideLive matches={liveMatches} state={state} />}
            {current?.id === "latest" && <SlideLatest results={latestResults} state={state} />}
            {current?.id === "news" && <SlideNews state={state} />}
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="border-t border-foam/15 px-4 py-2 text-center text-[0.65rem] text-foam/60 sm:px-6 sm:text-xs">
        {state.config.schoolName}
        <span aria-hidden className="hidden sm:inline"> · </span>
        <span className="hidden sm:inline">arrow keys to change slide, space to pause, Esc to exit</span>
      </footer>
    </div>
  );
}

function SlideOverall({ ordered, state }: { ordered: ReturnType<typeof sortStandings>; state: ReturnType<typeof useLive>["state"] }) {
  const max = Math.max(1, ...ordered.map((s) => s.overall.totalMedals));
  return (
    <div className="min-h-full">
      <h2 className="font-display mb-3 flex items-center gap-2 text-2xl sm:mb-4 sm:gap-3 sm:text-4xl">
        <Icon name="flag" size={30} className="shrink-0 text-straw" /> Overall Championship
      </h2>
      <ul className="grid gap-2.5 lg:grid-cols-2">
        {ordered.map((row) => {
          const team = state.teams.find((x) => x.id === row.teamId)!;
          return (
            <li key={row.teamId} className="flex items-center gap-2 rounded-2xl border border-foam/15 bg-ink/40 p-2.5 sm:gap-4 sm:p-3">
              <span className="font-display w-7 shrink-0 text-center text-xl sm:w-10 sm:text-3xl">{row.ranks.overall}</span>
              <TeamBadge team={team} size={44} shape="square" />
              <div className="min-w-0 flex-1 sm:max-w-40">
                <p className="font-display truncate text-lg sm:text-2xl">{team.shortName}</p>
                <p className="truncate text-xs text-foam/70 sm:text-sm">The {team.mascot}</p>
              </div>
              {/* the progress bar is decorative; it is the first thing to go on a phone */}
              <div className="hidden h-5 flex-1 overflow-hidden rounded-full bg-ink/70 sm:block">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: team.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.overall.totalMedals / max) * 100}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <span className="font-display w-10 shrink-0 text-right text-xl text-straw sm:w-20 sm:text-3xl">
                <CountUp value={row.overall.totalMedals} />
              </span>
              <span className="hidden w-44 shrink-0 items-center justify-end gap-3 text-sm text-foam/70 sm:flex">
                <MedalCount kind="gold" value={row.overall.gold} size={15} className="text-straw" />
                <MedalCount kind="silver" value={row.overall.silver} size={15} />
                <MedalCount kind="bronze" value={row.overall.bronze} size={15} className="text-[#d59a6a]" />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SlideMedals({ ordered, state }: { ordered: ReturnType<typeof sortStandings>; state: ReturnType<typeof useLive>["state"] }) {
  return (
    <div className="min-h-full">
      <h2 className="font-display mb-3 flex items-center gap-2 text-2xl sm:mb-4 sm:gap-3 sm:text-4xl">
        <Icon name="medal" size={30} className="shrink-0 text-straw" /> Medal Tally
      </h2>
      <div className="grid gap-2.5 md:grid-cols-2">
        {ordered.map((row) => {
          const team = state.teams.find((x) => x.id === row.teamId)!;
          return (
            <div key={row.teamId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-foam/15 bg-ink/40 p-2.5">
              <span className="font-display w-6 shrink-0 text-center text-lg sm:w-8 sm:text-2xl">{row.ranks.overall}</span>
              <TeamBadge team={team} size={36} shape="square" />
              <span className="font-display min-w-0 flex-1 truncate text-base sm:text-xl">{team.shortName}</span>
              {/* on a phone the medal split drops to its own right-aligned line */}
              <span className="flex w-full items-center justify-end gap-2.5 text-base sm:w-auto sm:gap-3 sm:text-lg">
                <MedalCount kind="gold" value={row.overall.gold} size={16} className="text-straw" />
                <MedalCount kind="silver" value={row.overall.silver} size={16} />
                <MedalCount kind="bronze" value={row.overall.bronze} size={16} className="text-[#d59a6a]" />
                <span className="font-display w-10 text-right sm:w-16">{row.overall.totalMedals}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlideLive({ matches, state }: { matches: ReturnType<typeof useLive>["state"]["matches"]; state: ReturnType<typeof useLive>["state"] }) {
  return (
    <div className="min-h-full">
      <h2 className="font-display mb-3 flex items-center gap-2 text-2xl sm:mb-4 sm:gap-3 sm:text-4xl">
        <span className="mr-1 inline-block h-3 w-3 animate-pulse rounded-full bg-blood align-middle sm:h-4 sm:w-4" /> Live Matches
      </h2>
      {matches.length === 0 ? (
        <p className="text-lg text-foam/70 sm:text-2xl">No matches in play right now.</p>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {matches.map((m) => {
            const a = state.teams.find((t) => t.id === m.teamA);
            const b = state.teams.find((t) => t.id === m.teamB);
            const event = state.events.find((e) => e.id === m.eventId);
            return (
              <div key={m.id} className="rounded-2xl border border-blood/30 bg-ink/40 p-3 sm:p-4">
                <p className="text-xs uppercase tracking-wider text-foam/70 sm:text-sm">{event?.name} · {m.round}</p>
                <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-4">
                  {a && <TeamBadge team={a} size={40} shape="square" />}
                  <span className="min-w-0 flex-1 truncate font-display text-sm sm:text-2xl">{a?.shortName}</span>
                  <span className="font-display shrink-0 text-2xl tabular-nums sm:text-5xl">{m.scoreA}–{m.scoreB}</span>
                  <span className="min-w-0 flex-1 truncate text-right font-display text-sm sm:text-2xl">{b?.shortName}</span>
                  {b && <TeamBadge team={b} size={40} shape="square" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlideLatest({ results, state }: { results: ReturnType<typeof useLive>["state"]["results"]; state: ReturnType<typeof useLive>["state"] }) {
  return (
    <div className="min-h-full">
      <h2 className="font-display mb-3 flex items-center gap-2 text-2xl sm:mb-4 sm:gap-3 sm:text-4xl">
        <Icon name="signal" size={30} className="shrink-0 text-straw" /> Latest Results
      </h2>
      <ul className="grid gap-3">
        {results.map((r, i) => {
          const team = state.teams.find((t) => t.id === r.teamId);
          const event = state.events.find((e) => e.id === r.eventId);
          if (!team || !event) return null;
          return (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-foam/15 bg-ink/40 p-2.5 sm:gap-4 sm:p-3">
              <span className="grid w-6 shrink-0 place-items-center sm:w-9">
                {r.placement >= 1 && r.placement <= 3 ? (
                  <MedalIcon
                    kind={r.placement === 1 ? "gold" : r.placement === 2 ? "silver" : "bronze"}
                    size={24}
                  />
                ) : (
                  <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-foam/40" />
                )}
              </span>
              <TeamBadge team={team} size={36} shape="square" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base sm:text-2xl">{team.shortName} — The {team.mascot}</span>
                <span className="block truncate text-xs text-foam/70 sm:text-sm">
                  {r.placement === 0 ? "competed in" : `placed #${r.placement} in`} {event.name}
                </span>
              </span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-display text-base text-straw sm:text-2xl">
                +{event.medalWeight}
                <Icon name="medal" size={18} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SlideNews({ state }: { state: ReturnType<typeof useLive>["state"] }) {
  return (
    <div className="min-h-full">
      <h2 className="font-display mb-3 flex items-center gap-2 text-2xl sm:mb-4 sm:gap-3 sm:text-4xl">
        <Icon name="megaphone" size={30} className="shrink-0 text-straw" /> Announcements
      </h2>
      <ul className="space-y-3 sm:space-y-4">
        {state.announcements.slice(0, 5).map((a, i) => (
          <li key={i} className="rounded-2xl border border-foam/15 bg-ink/40 p-3 sm:p-4">
            <p className="text-xs uppercase tracking-wider text-foam/60 sm:text-sm">
              {relativeTime(a.timestamp)} · {a.postedBy}
            </p>
            <p className="mt-1 text-base text-parchment sm:text-2xl">{a.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
