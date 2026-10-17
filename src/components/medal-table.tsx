"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { DivisionOrOverall, Group } from "@/lib/types";
import { buildMedalTable, applyGroupFilter, sortStandings } from "@/lib/scoring/rank";
import { terms } from "@/lib/terminology";
import { useLive } from "./providers";
import { PrintButton } from "./print-button";
import { TeamBadge } from "./team-badge";
import { RankArrow } from "./leaderboard";
import { CountUp } from "./count-up";
import { Icon, MedalIcon } from "./icons";

export function MedalTally() {
  const { state } = useLive();
  const t = terms(state.config);
  const reduce = useReducedMotion();
  const [division, setDivision] = useState<DivisionOrOverall>("overall");
  const [group, setGroup] = useState<Group | "all">("all");

  const byId = useMemo(() => new Map(state.teams.map((x) => [x.id, x])), [state.teams]);
  const rows = useMemo(() => {
    const sorted = sortStandings(state.standings, division);
    const table = buildMedalTable(sorted, division);
    return applyGroupFilter(table, state.teams, group);
  }, [state.standings, state.teams, division, group]);

  const divisions: Array<{ id: DivisionOrOverall; label: string }> = [
    { id: "overall", label: state.config.terminology === "plain" ? "Overall" : t.overall },
    { id: "sports", label: t.sports },
    { id: "cultural", label: t.cultural },
  ];

  return (
    <section aria-labelledby="medals-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="medals-heading" className="font-display flex items-center gap-2 text-3xl text-parchment sm:text-4xl">
          <Icon name="medal" size={28} className="text-straw" /> Medal Tally
        </h1>
        <p className="text-xs text-foam/75">Tie-break: total medals → golds → silvers</p>
        <PrintButton label="Print the tally" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div role="group" aria-label="Division" className="flex flex-wrap gap-1 rounded-lg border border-foam/15 bg-ink/50 p-1">
          {divisions.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={division === d.id}
              onClick={() => setDivision(d.id)}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-xs font-semibold transition ${division === d.id ? "bg-straw text-ink" : "text-parchment/80 hover:bg-foam/10"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Fleet" className="flex flex-wrap gap-1 rounded-lg border border-foam/15 bg-ink/50 p-1">
          {([["all", "All"], ["faculty", t.facultyFleet], ["extension_campus", t.campusFleet]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={group === id}
              onClick={() => setGroup(id as Group | "all")}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-xs font-semibold transition ${group === id ? "bg-straw text-ink" : "text-parchment/80 hover:bg-foam/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* `table-fixed` + a colgroup keeps the crew column truncating inside
          320px instead of forcing a nested horizontal scroller. */}
      <div className="panel overflow-hidden rounded-2xl">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">Medal tally ranked across all twelve crews</caption>
          <colgroup>
            <col className="w-9 sm:w-12" />
            <col />
            <col className="w-9 sm:w-12" />
            <col className="w-9 sm:w-12" />
            <col className="w-9 sm:w-12" />
            <col className="w-12 sm:w-16" />
          </colgroup>
          <thead>
            <tr className="border-b border-foam/20 bg-ink/60 text-left text-[0.68rem] uppercase tracking-wider text-foam/80">
              <th scope="col" className="px-1.5 py-2.5 sm:px-3">#</th>
              <th scope="col" className="px-1.5 py-2.5 sm:px-2">{t.team}</th>
              <th scope="col" className="px-1 py-2.5 text-center sm:px-2"><MedalIcon kind="gold" size={18} title="Gold medals" /></th>
              <th scope="col" className="px-1 py-2.5 text-center sm:px-2"><MedalIcon kind="silver" size={18} title="Silver medals" /></th>
              <th scope="col" className="px-1 py-2.5 text-center sm:px-2"><MedalIcon kind="bronze" size={18} title="Bronze medals" /></th>
              <th scope="col" className="px-1.5 py-2.5 text-center sm:px-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const team = byId.get(row.teamId);
              if (!team) return null;
              return (
                <motion.tr
                  key={row.teamId}
                  layout={!reduce}
                  className="border-b border-foam/10 last:border-0 hover:bg-foam/5"
                  style={{ boxShadow: `inset 3px 0 0 ${team.color}` }}
                >
                  <td className="px-1 py-2 sm:px-2">
                    <span className="block text-center font-display text-lg leading-none">{row.rank}</span>
                    <span className="mt-0.5 block text-center">
                      <RankArrow change={division === "overall" ? row.rankChange : 0} compact />
                    </span>
                  </td>
                  <th scope="row" className="overflow-hidden px-1.5 py-2 text-left font-normal sm:px-2">
                    <Link href={`/teams/${team.id}`} className="flex items-center gap-2 hover:text-straw sm:gap-2.5">
                      <TeamBadge team={team} size={32} shape="square" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-parchment">{team.shortName}</span>
                        <span className="hidden truncate text-[0.68rem] text-foam/70 sm:block">{team.mascot}</span>
                      </span>
                    </Link>
                  </th>
                  <td className="px-1 py-2 text-center font-semibold text-straw sm:px-2"><CountUp value={row.gold} /></td>
                  <td className="px-1 py-2 text-center font-semibold text-parchment/85 sm:px-2"><CountUp value={row.silver} /></td>
                  <td className="px-1 py-2 text-center font-semibold text-[#d59a6a] sm:px-2"><CountUp value={row.bronze} /></td>
                  <td className="px-1.5 py-2 text-center sm:px-3">
                    <span className="inline-block rounded-full bg-straw/15 px-1.5 py-0.5 font-display text-base text-straw sm:px-2">
                      <CountUp value={row.total} />
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
