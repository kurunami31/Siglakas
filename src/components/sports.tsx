"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLive } from "./providers";
import { TeamBadge } from "./team-badge";
import { computeRoundRobin, buildBracket } from "@/lib/scoring/match";
import { terms } from "@/lib/terminology";
import { Icon } from "./icons";
import type { CompetitionState } from "@/lib/types";

export function SportsView() {
  const { state } = useLive();
  const t = terms(state.config);
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<"all" | "live" | "match">("all");

  const matchEvents = useMemo(
    () => state.events.filter((e) => e.scoringType === "match"),
    [state.events],
  );

  const byId = useMemo(() => new Map(state.teams.map((x) => [x.id, x])), [state.teams]);

  const liveMatches = state.matches.filter((m) => m.status === "live");
  const shown = matchEvents.filter((e) => (filter === "live" ? e.status === "live" || liveMatches.some((m) => m.eventId === e.id) : true));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-3xl text-parchment sm:text-4xl">
          <Icon name="ball" size={28} className="text-straw" /> {t.sports}
        </h1>
        <div role="group" aria-label="Filter" className="flex gap-1 rounded-lg border border-foam/15 bg-ink/50 p-1">
          {([["all", "All sports"], ["live", "Live now"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id as "all" | "live")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${filter === id ? "bg-straw text-ink" : "text-parchment/80 hover:bg-foam/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {liveMatches.length > 0 && (
        <section aria-labelledby="live-h" className="panel rounded-2xl border-blood/40 p-4">
          <h2 id="live-h" className="font-display mb-2 flex items-center gap-2 text-xl text-parchment">
            <span className="inline-flex items-center gap-1.5 rounded bg-blood px-2 py-0.5 text-xs font-bold uppercase">
              <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-parchment" /> Live
            </span>
            On the court now
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {liveMatches.map((m) => (
              <li key={m.id}>
                <Scoreboard match={m} state={state} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((event) => {
          const matches = state.matches.filter((m) => m.eventId === event.id);
          const standings = computeRoundRobin(matches);
          const bracket = buildBracket(matches);
          return (
            <motion.section key={event.id} layout={!reduce} className="panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl text-parchment">
                    <Link href={`/events/${event.id}`} className="hover:text-straw">{event.name}</Link>
                  </h2>
                  <p className="flex items-center gap-1 text-[0.68rem] text-foam/70">
                    {event.category} ·<Icon name="medal" size={11} /> {event.medalWeight} medals
                  </p>
                </div>
                <StatusChip status={event.status} />
              </div>

              {matches.length === 0 ? (
                <p className="mt-3 text-sm italic text-foam/55">Bracket to be drawn.</p>
              ) : (
                <>
                  {standings.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">{event.name} standings</caption>
                        <thead>
                          <tr className="text-left text-[0.65rem] uppercase tracking-wider text-foam/70">
                            <th scope="col" className="py-1 pr-2">#</th>
                            <th scope="col" className="py-1 pr-2">Crew</th>
                            <th scope="col" className="py-1 pr-2 text-center">W</th>
                            <th scope="col" className="py-1 pr-2 text-center">L</th>
                            <th scope="col" className="py-1 text-center">Diff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.slice(0, 6).map((row) => {
                            const team = byId.get(row.teamId);
                            if (!team) return null;
                            return (
                              <tr key={row.teamId} className="border-t border-foam/10">
                                <td className="py-1 pr-2 font-display">{row.rank}</td>
                                <th scope="row" className="py-1 pr-2 text-left font-normal">
                                  <span className="flex items-center gap-1.5">
                                    <TeamBadge team={team} size={20} shape="square" />
                                    {team.shortName}
                                  </span>
                                </th>
                                <td className="py-1 pr-2 text-center">{row.wins}</td>
                                <td className="py-1 pr-2 text-center">{row.losses}</td>
                                <td className="py-1 text-center">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {bracket.length > 0 && (
                    <div className="mt-3">
                      <h3 className="mb-1.5 text-[0.68rem] uppercase tracking-wider text-foam/70">Bracket</h3>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {bracket.map((round, i) => (
                          <div key={i} className="min-w-[11rem]">
                            <p className="mb-1 text-[0.62rem] uppercase tracking-wider text-foam/60">{round[0]?.round}</p>
                            <ul className="space-y-1.5">
                              {round.map((slot) => (
                                <li key={slot.matchId} className="rounded-lg border border-foam/15 bg-ink/40 p-1.5 text-[0.72rem]">
                                  <SlotRow teamId={slot.teamA} score={slot.scoreA} winner={slot.winner} state={state} />
                                  <SlotRow teamId={slot.teamB} score={slot.scoreB} winner={slot.winner} state={state} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

function SlotRow({ teamId, score, winner, state }: { teamId: string; score: number; winner: string; state: CompetitionState }) {
  const team = state.teams.find((t) => t.id === teamId);
  const won = winner && winner === teamId;
  return (
    <div className={`flex items-center gap-1.5 ${won ? "font-bold text-straw" : "text-parchment/85"}`}>
      {team ? <TeamBadge team={team} size={18} shape="square" /> : <span className="inline-block h-[18px] w-[18px] rounded bg-foam/20" />}
      <span className="truncate">{team?.shortName ?? "TBD"}</span>
      <span className="ml-auto font-display">{score}</span>
    </div>
  );
}

function Scoreboard({ match, state }: { match: CompetitionState["matches"][number]; state: CompetitionState }) {
  const a = state.teams.find((t) => t.id === match.teamA);
  const b = state.teams.find((t) => t.id === match.teamB);
  const event = state.events.find((e) => e.id === match.eventId);
  return (
    <div className="rounded-xl border border-blood/30 bg-ink/50 p-2.5">
      <p className="mb-1.5 text-[0.62rem] uppercase tracking-wider text-foam/60">
        {event?.name} · {match.round}
      </p>
      <div className="flex items-center gap-2">
        <Side team={a} align="left" />
        <span className="font-display rounded-lg bg-ink px-2.5 py-1 text-2xl tabular-nums">
          {match.scoreA}<span className="mx-1 text-foam/50">–</span>{match.scoreB}
        </span>
        <Side team={b} align="right" />
      </div>
      {match.detail && <p className="mt-1.5 text-[0.65rem] text-foam/60">{match.detail}</p>}
    </div>
  );
}

function Side({ team, align }: { team?: CompetitionState["teams"][number]; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {team ? <TeamBadge team={team} size={30} shape="square" /> : <span className="h-[30px] w-[30px] rounded bg-foam/20" />}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{team?.shortName ?? "TBD"}</span>
        <span className="block truncate text-[0.6rem] text-foam/60">{team?.mascot ?? ""}</span>
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: CompetitionState["events"][number]["status"] }) {
  const map = {
    live: "bg-blood text-parchment",
    finished: "bg-teal/25 text-teal",
    upcoming: "bg-foam/15 text-foam",
  } as const;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase ${map[status]}`}>
      {status === "live" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}
