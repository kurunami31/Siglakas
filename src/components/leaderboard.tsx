"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { CompetitionState, DivisionOrOverall, Group } from "@/lib/types";
import { applyGroupFilter, sortStandings } from "@/lib/scoring/rank";
import { accentFor, formatBounty, hexToRgbTriplet, prefersDarkText } from "@/lib/format";
import { terms } from "@/lib/terminology";
import { TeamBadge } from "./team-badge";
import { CountUp } from "./count-up";
import { Icon, MedalCount } from "./icons";

type DivisionFilter = DivisionOrOverall;
type GroupFilter = Group | "all";

export function Leaderboard({ state, dense = false }: { state: CompetitionState; dense?: boolean }) {
  const t = terms(state.config);
  const [division, setDivision] = useState<DivisionFilter>("overall");
  const [group, setGroup] = useState<GroupFilter>("all");
  const reduce = useReducedMotion();

  const sorted = useMemo(() => sortStandings(state.standings, division), [state.standings, division]);
  const visible = useMemo(() => applyGroupFilter(sorted, state.teams, group), [sorted, state.teams, group]);

  const byId = useMemo(() => new Map(state.teams.map((x) => [x.id, x])), [state.teams]);

  const divisions: Array<{ id: DivisionFilter; label: string }> = [
    { id: "overall", label: state.config.terminology === "plain" ? "Overall" : t.overall },
    { id: "sports", label: t.sports },
    { id: "cultural", label: t.cultural },
  ];
  const groups: Array<{ id: GroupFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "faculty", label: t.facultyFleet },
    { id: "extension_campus", label: t.campusFleet },
  ];

  return (
    <section aria-labelledby="leaderboard-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="leaderboard-heading" className="font-display flex items-center gap-2 text-3xl text-parchment sm:text-4xl">
          <Icon name="flag" size={28} className="text-straw" />
          {t.leaderboard}
        </h1>
        <p className="text-xs text-foam/75">
          Ranked across all {state.teams.length} {t.teams.toLowerCase()} · filters only change what is shown
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterGroup label="Division" options={divisions} value={division} onChange={setDivision} />
        <FilterGroup label="Fleet" options={groups} value={group} onChange={setGroup} />
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visible.map((row) => {
            const team = byId.get(row.teamId);
            if (!team) return null;
            const breakdown = row[division];
            return (
              <motion.li
                key={team.id}
                layout={!reduce}
                // Deliberately no `opacity: 0` in the initial state. Starting the
                // entrance invisible means the server-rendered cards cannot paint
                // until JS has hydrated — which is what put LCP at 4.1s and Speed
                // Index at 5.7s on Lighthouse mobile while FCP was only 1.1s. A
                // scale-only entrance keeps the motion and the content is
                // paintable immediately.
                initial={reduce ? false : { scale: 0.94 }}
                animate={{ scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                // `min-w-0` matters: a grid item defaults to `min-width: auto`,
                // so it would refuse to shrink below the min-content width of
                // the `truncate`d text inside and overflow the 1fr track —
                // clipped by the card's own `overflow-hidden`, i.e. the right
                // edge of every card disappears on a phone.
                className="min-w-0"
              >
                <WantedPoster
                  team={team}
                  rank={row.ranks[division]}
                  rankChange={division === "overall" ? row.rankChange : 0}
                  points={breakdown.points}
                  gold={breakdown.gold}
                  silver={breakdown.silver}
                  bronze={breakdown.bronze}
                  total={breakdown.totalMedals}
                  dense={dense}
                />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      {visible.length === 0 && (
        <p className="panel rounded-xl p-6 text-center text-sm text-foam/80">
          No {t.teams.toLowerCase()} in this fleet yet.
        </p>
      )}
    </section>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="sr-only sm:not-sr-only sm:text-[0.7rem] sm:uppercase sm:tracking-wider sm:text-foam/70">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-lg border border-foam/15 bg-ink/50 p-1">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-xs font-semibold transition ${
                active ? "bg-straw text-ink" : "text-parchment/80 hover:bg-foam/10"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WantedPoster({
  team,
  rank,
  rankChange,
  points,
  gold,
  silver,
  bronze,
  total,
  dense = false,
}: {
  team: CompetitionState["teams"][number];
  rank: number;
  rankChange: number;
  points: number;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  dense?: boolean;
}) {
  const isFirst = rank === 1;
  const accent = accentFor(team.color);
  const rgb = hexToRgbTriplet(accent);
  // The medals now carry the card's display weight, so they scale with `dense`.
  const medalIcon = dense ? 22 : 28;
  const medalText = dense ? "text-lg font-bold" : "text-xl font-bold sm:text-2xl";
  return (
    <Link
      href={`/teams/${team.id}`}
      className={`parchment panel-hover group relative block overflow-hidden rounded-2xl p-3 ${dense ? "" : "sm:p-4"}`}
      style={{ ["--glow" as string]: accent, outline: isFirst ? `2px solid ${accent}` : undefined }}
      // Track the pointer so the spotlight below can follow it. Pure CSS vars,
      // no re-render; the glow simply sits still under reduced motion.
      onMouseMove={(e) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      // Deliberately no aria-label: WCAG 2.5.3 wants the visible text in the
      // accessible name, so let the card's own content compose it (the CountUp
      // spans contribute their final values as real text).
    >
      <div className="relative flex items-start gap-3">
        <div className="relative">
          <TeamBadge team={team} size={dense ? 56 : 72} priority={rank <= 3} shape="square" />
          <span
            className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-parchment bg-ink text-xs font-bold text-parchment"
            style={{ boxShadow: isFirst ? `0 0 14px ${accent}` : undefined }}
          >
            {rank}
          </span>
          {isFirst && (
            <span aria-hidden className="absolute -right-2 -top-3 text-[#8a6300] animate-[sway_4s_ease-in-out_infinite]">
              <Icon name="crown" size={22} strokeWidth={1.5} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-stencil text-[0.62rem] uppercase tracking-[0.2em] text-[#7a5a2e]">
            Wanted · Rank {rank}
          </p>
          <h3 className="font-display truncate text-xl leading-tight text-[#2c1d0c] sm:text-2xl">
            The {team.mascot}
          </h3>
          <p className="truncate text-[0.72rem] font-semibold text-[#5a4426]">{team.name}</p>

          {/* The medal tally sits where the bounty used to: it is the thing the
              board is read for, so it gets the display type and full-size
              medals rather than a row of 16px icons. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <MedalCount kind="gold" value={<CountUp value={gold} />} size={medalIcon} className={medalText} />
            <MedalCount kind="silver" value={<CountUp value={silver} />} size={medalIcon} className={medalText} />
            <MedalCount kind="bronze" value={<CountUp value={bronze} />} size={medalIcon} className={medalText} />
          </div>
        </div>

        <div className="shrink-0 rounded-lg bg-ink/85 px-2 py-1.5 text-center text-parchment">
          <span className="block font-display text-lg leading-none">
            <CountUp value={total} />
          </span>
          <span className="block text-[0.58rem] uppercase tracking-wider text-foam/80">Medals</span>
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-3 border-t border-[#8a6534]/30 pt-2 text-[0.72rem] font-semibold text-[#4a3618]">
        {/* The bounty moved down here when the medals took its place. */}
        <span className="font-display text-lg text-[#7a2b12]" title={formatBounty(points)}>
          <CountUp value={points} format={(n) => formatBounty(n)} />
        </span>
        <RankArrow change={rankChange} />
        <span className="ml-auto truncate text-[#6b4a2b]" aria-hidden style={{ color: `rgb(${rgb} / 1)` }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        </span>
      </div>

      {/* Pointer-following spotlight in the crew's own accent colour. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-30"
        style={{
          background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), var(--glow), transparent 70%)`,
        }}
      />
    </Link>
  );
}

export function RankArrow({ change, compact = false }: { change: number; compact?: boolean }) {
  // Hidden in print: movement arrows are noise on a pinned-up notice board.
  if (change === 0) {
    // `compact` is for the medal table's narrow rank column, where the words
    // "no change" cannot fit and made the column look ragged. A centred dash
    // keeps all twelve rows aligned; the meaning is kept for screen readers.
    return (
      <span
        className={`rank-same ${
          compact ? "text-[0.7rem] font-semibold" : "inline-flex items-center gap-1 text-xs font-semibold"
        } print:hidden`}
        title="No rank change"
      >
        <span aria-hidden>{compact ? "–" : <Icon name="minus" size={12} />}</span>
        <span className={compact ? "sr-only" : "sr-only sm:not-sr-only"}>no change</span>
      </span>
    );
  }

  const up = change > 0;
  const magnitude = Math.abs(change);
  const spoken = `${up ? "up" : "down"} ${magnitude} place${magnitude > 1 ? "s" : ""}`;
  return (
    <span
      className={`rank-${up ? "up" : "down"} inline-flex items-center justify-center gap-0.5 ${
        compact ? "text-[0.7rem] font-bold" : "text-xs font-bold"
      } print:hidden`}
      title={spoken}
    >
      <span aria-hidden className="inline-flex items-center gap-0.5">
        <Icon name={up ? "arrowUp" : "arrowDown"} size={compact ? 10 : 12} strokeWidth={2.4} />
        {magnitude}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
