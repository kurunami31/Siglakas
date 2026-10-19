"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLive } from "./providers";
import { TeamBadge } from "./team-badge";
import { CountUp } from "./count-up";
import { accentFor, formatBounty } from "@/lib/format";
import { terms } from "@/lib/terminology";
import { sortStandings } from "@/lib/scoring/rank";
import { Icon, MedalIcon } from "./icons";

export function TeamProfile({ teamId }: { teamId: string }) {
  const { state } = useLive();
  const t = terms(state.config);
  const team = state.teams.find((x) => x.id === teamId);

  const standing = useMemo(
    () => state.standings.find((s) => s.teamId === teamId),
    [state.standings, teamId],
  );
  const totalCrews = state.teams.length;

  if (!team || !standing) {
    return (
      <div className="panel rounded-2xl p-6">
        <p className="font-display text-2xl text-parchment">Crew not found</p>
        <Link href="/" className="mt-2 inline-flex min-h-11 items-center text-sm text-straw underline">Back to the Bounty Board</Link>
      </div>
    );
  }

  const results = state.results
    .filter((r) => r.teamId === teamId && r.status === "published")
    .map((r) => ({ r, event: state.events.find((e) => e.id === r.eventId) }))
    .filter((x) => x.event)
    .sort((a, b) => (a.event!.division === b.event!.division ? 0 : a.event!.division === "sports" ? -1 : 1));

  const order = sortStandings(state.standings, "overall");
  const neighbours = order.slice(Math.max(0, order.findIndex((s) => s.teamId === teamId) - 1), order.findIndex((s) => s.teamId === teamId) + 2);

  return (
    <div className="space-y-5">
      <header
        className="panel relative overflow-hidden rounded-2xl p-5"
        style={{ borderTop: `4px solid ${accentFor(team.color)}`, boxShadow: `0 0 40px -22px ${accentFor(team.color)}` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-2xl"
          style={{ background: accentFor(team.color) }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <TeamBadge team={team} size={120} priority shape="square" />
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.25em] text-foam/70">
              {team.group === "faculty" ? t.facultyFleet : t.campusFleet} · {t.rank} #{standing.ranks.overall}
            </p>
            <h1 className="font-display text-3xl text-parchment sm:text-4xl">{team.name}</h1>
            <p className="font-stencil mt-1 text-lg" style={{ color: accentFor(team.color) }}>
              The {team.mascot}
            </p>
            {team.motto && <p className="mt-1 text-sm italic text-foam/80">“{team.motto}”</p>}
          </div>
          <div className="sm:ml-auto sm:text-right">
            <p className="text-[0.68rem] uppercase tracking-widest text-foam/70">{t.points}</p>
            <p className="font-display text-2xl text-straw"><CountUp value={standing.overall.points} format={formatBounty} /></p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Overall rank" value={`#${standing.ranks.overall}`} sub={`of ${totalCrews}`} />
        <Stat
          label="Total medals"
          value={standing.overall.totalMedals}
          sub={
            <span className="mt-0.5 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1"><MedalIcon kind="gold" size={13} /> {standing.overall.gold}</span>
              <span className="inline-flex items-center gap-1"><MedalIcon kind="silver" size={13} /> {standing.overall.silver}</span>
              <span className="inline-flex items-center gap-1"><MedalIcon kind="bronze" size={13} /> {standing.overall.bronze}</span>
            </span>
          }
        />
        <Stat label={t.sports} value={standing.sports.totalMedals} sub={`rank #${standing.ranks.sports}`} />
        <Stat label={t.cultural} value={standing.cultural.totalMedals} sub={`rank #${standing.ranks.cultural}`} />
      </section>

      <section className="panel rounded-2xl p-4">
        <h2 className="font-display mb-2 flex items-center gap-2 text-xl text-parchment">
          <Icon name="users" size={20} className="text-straw" /> Neighbours on the board
        </h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {neighbours.map((n) => {
            const other = state.teams.find((x) => x.id === n.teamId);
            if (!other) return null;
            const isSelf = other.id === teamId;
            return (
              <li key={n.teamId}>
                <Link
                  href={`/teams/${other.id}`}
                  aria-current={isSelf ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-xl border p-2 ${isSelf ? "border-straw bg-straw/10" : "border-foam/15 bg-ink/40 hover:border-foam/40"}`}
                >
                  <span className="font-display w-6 text-center">{n.ranks.overall}</span>
                  <TeamBadge team={other} size={30} shape="square" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{other.shortName}</span>
                    <span className="block text-[0.65rem] text-foam/70">{other.mascot}</span>
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-straw">
                    {n.overall.totalMedals}
                    <Icon name="medal" size={12} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel rounded-2xl p-4">
        <h2 className="font-display mb-2 flex items-center gap-2 text-xl text-parchment">
          <Icon name="scroll" size={20} className="text-straw" /> Event-by-event
        </h2>
        {results.length === 0 ? (
          <p className="text-sm italic text-foam/60">No published results for this crew yet.</p>
        ) : (
          // No `overflow-x-auto`: three fixed columns and wrapping event names
          // fit 320px without a nested horizontal scroller.
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Every published result for this crew</caption>
            <colgroup>
              <col />
              <col className="w-14 sm:w-16" />
              <col className="w-14 sm:w-16" />
            </colgroup>
            <thead>
              <tr className="text-left text-[0.68rem] uppercase tracking-wider text-foam/70">
                <th scope="col" className="py-1.5 pr-2">{t.islands}</th>
                <th scope="col" className="py-1.5 pr-2 text-center">Place</th>
                <th scope="col" className="py-1.5 text-right">Medals</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ r, event }) => (
                <tr key={event!.id} className="border-t border-foam/10">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <Link href={`/events/${event!.id}`} className="flex min-h-6 items-center hover:text-straw">
                      <span className="min-w-0">
                        <span className="block break-words">{event!.name}</span>
                        <span className="block text-[0.68rem] font-normal text-foam/60">{event!.category}</span>
                      </span>
                    </Link>
                  </th>
                  <td className="py-1.5 pr-2 text-center">
                    {r.placement === 0 ? (
                      <span className="text-foam/50">—</span>
                    ) : r.placement <= 3 ? (
                      <span className="inline-flex items-center gap-1">
                        <MedalIcon kind={r.placement === 1 ? "gold" : r.placement === 2 ? "silver" : "bronze"} size={14} />
                        {r.placement}
                      </span>
                    ) : (
                      r.placement
                    )}
                  </td>
                  <td className="py-1.5 text-right text-straw">{r.placement >= 1 && r.placement <= 3 ? event!.medalWeight : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: React.ReactNode }) {
  return (
    <div className="panel rounded-2xl p-3.5">
      <p className="text-[0.66rem] uppercase tracking-widest text-foam/70">{label}</p>
      <p className="font-display text-2xl text-straw">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {sub && <div className="text-[0.68rem] text-foam/70">{sub}</div>}
    </div>
  );
}
