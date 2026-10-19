"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { CompetitionState, Division, EventItem } from "@/lib/types";
import { terms } from "@/lib/terminology";
import { buildEventDetail, buildEventSummaries } from "@/lib/scoring/events";
import { computeRoundRobin } from "@/lib/scoring/match";
import { useLive } from "./providers";
import { TeamBadge } from "./team-badge";
import { PrintButton } from "./print-button";
import { Select } from "./select";
import { Icon, MedalIcon } from "./icons";

type StatusFilter = "all" | "upcoming" | "live" | "finished";

export function EventExplorer() {
  const { state } = useLive();
  const t = terms(state.config);
  const [division, setDivision] = useState<Division | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<string>("all");

  const summaries = useMemo(
    () => buildEventSummaries(state.events, state.results, state.config),
    [state.events, state.results, state.config],
  );

  const categories = useMemo(() => {
    const set = new Set(state.events.filter((e) => division === "all" || e.division === division).map((e) => e.category));
    return ["all", ...[...set].sort()];
  }, [state.events, division]);

  const filtered = summaries.filter(({ event }) => {
    if (division !== "all" && event.division !== division) return false;
    if (status !== "all" && event.status !== status) return false;
    if (category !== "all" && event.category !== category) return false;
    return true;
  });

  // ---- pagination (98 islands is far too long to scroll) ----
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const listRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // any filter change jumps back to the first page
  useEffect(() => {
    setPage(1);
  }, [division, status, category, perPage]);

  function goTo(next: number) {
    setPage(Math.max(1, Math.min(totalPages, next)));
    listRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display flex items-center gap-2 text-3xl text-parchment sm:text-4xl">
            <Icon name="map" size={28} className="text-straw" /> {t.islands}
          </h1>
          <PrintButton label="Print the list" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            label="Sea"
            value={division}
            onChange={(v) => {
              setDivision(v as Division | "all");
              setCategory("all");
            }}
            options={[
              { value: "all" as const, label: "All islands" },
              { value: "sports" as const, label: t.sports },
              { value: "cultural" as const, label: t.cultural },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
            options={[
              { value: "all" as const, label: "All statuses" },
              { value: "upcoming" as const, label: "Upcoming" },
              { value: "live" as const, label: "Live" },
              { value: "finished" as const, label: "Finished" },
            ]}
          />
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({ value: c, label: c === "all" ? "All categories" : c }))}
          />
        </div>
      </div>

      <div ref={listRef} className="scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foam/70" role="status" aria-live="polite">
            Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + perPage, filtered.length)} of{" "}
            {filtered.length} islands
            {filtered.length !== summaries.length && ` (filtered from ${summaries.length})`}
          </p>
          <label className="flex items-center gap-2 text-xs text-foam/70">
            Per page
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="min-h-9 rounded-md border border-foam/25 bg-ink/60 px-2 text-parchment"
            >
              {[12, 24, 48].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map(({ event, rows }) => (
            <li key={event.id}>
              <IslandCard event={event} rows={rows} teams={state.teams} />
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="panel mt-3 rounded-xl p-6 text-center text-sm text-foam/75">
            No islands match these filters. Try clearing the category or status.
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Island pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 1}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm text-parchment/85 hover:border-straw hover:text-straw disabled:opacity-40"
          >
            <Icon name="chevronLeft" size={15} /> Prev
          </button>

          {pageWindow(current, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} aria-hidden className="px-1.5 text-foam/50">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goTo(p)}
                aria-current={p === current ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 text-sm font-semibold transition ${
                  p === current ? "bg-straw text-ink" : "border border-foam/25 text-parchment/85 hover:border-straw hover:text-straw"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === totalPages}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm text-parchment/85 hover:border-straw hover:text-straw disabled:opacity-40"
          >
            Next <Icon name="chevronRight" size={15} />
          </button>
        </nav>
      )}
    </section>
  );
}

/** Windowed page numbers: 1 … 4 5 6 … 9 (with `null` as an ellipsis marker). */
function pageWindow(current: number, total: number, span = 1): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  for (let d = 1; d <= span; d++) {
    if (current - d > 1) pages.add(current - d);
    if (current + d < total) pages.add(current + d);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

export function IslandCard({
  event,
  rows,
  teams,
}: {
  event: EventItem;
  rows: ReturnType<typeof buildEventSummaries>[number]["rows"];
  teams: CompetitionState["teams"];
}) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const winners = rows.filter((r) => r.status === "published" && r.placement >= 1 && r.placement <= 3).slice(0, 3);
  const statusStyles: Record<EventItem["status"], string> = {
    live: "bg-blood text-parchment",
    finished: "bg-teal/25 text-teal",
    upcoming: "bg-foam/15 text-foam",
  };

  return (
    <Link
      href={`/events/${event.id}`}
      className="panel panel-hover block h-full rounded-2xl p-3.5"
      style={{ borderTop: `3px solid ${event.division === "sports" ? "var(--color-ocean-2)" : "var(--color-sunset)"}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display truncate text-lg text-parchment">{event.name}</h3>
          <p className="truncate text-[0.68rem] text-foam/70">
            {event.category} · {event.gender}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase ${statusStyles[event.status]}`}>
          {event.status === "live" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {event.status}
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-2 text-[0.7rem] text-foam/75">
        <span className="inline-flex items-center gap-1 rounded bg-ink/60 px-1.5 py-0.5">
          <Icon name="medal" size={12} /> {event.medalWeight} {event.medalWeight === 1 ? "medal" : "medals"}
        </span>
        {event.multiplier !== 1 && <span className="rounded bg-straw/20 px-1.5 py-0.5 text-straw">{event.multiplier}× </span>}
        {event.locked && (
          <span title="Locked" className="inline-flex items-center">
            <Icon name="lock" size={12} />
            <span className="sr-only">Locked</span>
          </span>
        )}
        {event.verify && (
          <span title="Needs verification" className="inline-flex items-center gap-1 text-sunset">
            <Icon name="warning" size={12} /> verify
          </span>
        )}
      </div>

      {winners.length > 0 ? (
        <ol className="mt-2.5 space-y-1">
          {winners.map((w) => {
            const team = byId.get(w.teamId);
            if (!team) return null;
            return (
              <li key={w.teamId} className="flex items-center gap-2 text-xs">
                <MedalIcon kind={w.placement === 1 ? "gold" : w.placement === 2 ? "silver" : "bronze"} size={14} />
                <TeamBadge team={team} size={20} shape="square" />
                <span className="truncate text-parchment/90">{team.shortName}</span>
                <span className="ml-auto text-foam/60">{team.mascot}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-2.5 text-xs italic text-foam/55">
          {event.status === "live" ? "Scores coming in…" : "No results yet"}
        </p>
      )}
    </Link>
  );
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const { state } = useLive();
  const t = terms(state.config);
  const reduce = useReducedMotion();
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return <p className="panel rounded-xl p-6">Island not found.</p>;

  const detail = buildEventDetail(
    event,
    state.teams,
    state.results,
    state.matches,
    [],
    state.criteria,
    "first_criterion",
    state.config,
  );
  const byId = new Map(state.teams.map((x) => [x.id, x]));

  return (
    <div className="space-y-5">
      <header className="panel rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] uppercase tracking-widest text-foam/70">{t.islands} · {event.category}</p>
            <h1 className="font-display text-3xl text-parchment sm:text-4xl">{event.name}</h1>
          </div>
          <PrintButton label="Print this island" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge>{event.division === "sports" ? t.sports : t.cultural}</Badge>
          <Badge>{event.scoringType === "match" ? "Match-based" : event.scoringType === "judged" ? "Judged" : "Placement"}</Badge>
          <Badge><span className="inline-flex items-center gap-1"><Icon name="medal" size={13} /> {event.medalWeight} {event.medalWeight === 1 ? "medal" : "medals"}</span></Badge>
          <Badge>{event.gender}</Badge>
          {event.schedule && <Badge><span className="inline-flex items-center gap-1"><Icon name="calendar" size={13} /> {event.schedule}</span></Badge>}
          {event.venue && <Badge><span className="inline-flex items-center gap-1"><Icon name="pin" size={13} /> {event.venue}</span></Badge>}
        </div>
        {event.verify && event.note && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-sunset/40 bg-sunset/10 p-2.5 text-xs text-sunset">
            <Icon name="warning" size={15} className="mt-0.5 shrink-0" />
            <span><strong>Verify:</strong> {event.note}</span>
          </p>
        )}
      </header>

      {event.scoringType === "match" && (
        <section aria-labelledby="standings-h" className="panel rounded-2xl p-4">
          <h2 id="standings-h" className="font-display mb-2 flex items-center gap-2 text-xl text-parchment">
            <Icon name="trophy" size={20} className="text-straw" /> Standings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-wider text-foam/70">
                  <th scope="col" className="py-1.5 pr-2">#</th>
                  <th scope="col" className="py-1.5 pr-2">Crew</th>
                  <th scope="col" className="py-1.5 pr-2 text-center">W</th>
                  <th scope="col" className="py-1.5 pr-2 text-center">L</th>
                  <th scope="col" className="py-1.5 text-center">Diff</th>
                </tr>
              </thead>
              <tbody>
                {computeRoundRobin(state.matches.filter((m) => m.eventId === event.id)).map((r) => {
                  const team = byId.get(r.teamId);
                  if (!team) return null;
                  return (
                    <tr key={r.teamId} className="border-t border-foam/10">
                      <td className="py-1.5 pr-2 font-display">{r.rank}</td>
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <TeamBadge team={team} size={22} shape="square" />
                          {team.shortName}
                        </span>
                      </th>
                      <td className="py-1.5 pr-2 text-center">{r.wins}</td>
                      <td className="py-1.5 pr-2 text-center">{r.losses}</td>
                      <td className="py-1.5 text-center">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                    </tr>
                  );
                })}
                {state.matches.filter((m) => m.eventId === event.id).length === 0 && (
                  <tr><td colSpan={5} className="py-3 text-center text-xs italic text-foam/60">No matches recorded yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="font-display mt-4 mb-2 text-lg text-parchment">Matches</h3>
          <ul className="space-y-2">
            {state.matches
              .filter((m) => m.eventId === event.id)
              .map((m) => {
                const a = byId.get(m.teamA);
                const b = byId.get(m.teamB);
                return (
                  <motion.li
                    key={m.id}
                    layout={!reduce}
                    className="flex items-center gap-2 rounded-xl border border-foam/15 bg-ink/50 p-2 text-sm"
                  >
                    <span className="w-20 shrink-0 truncate text-[0.65rem] uppercase text-foam/65">{m.round}</span>
                    {a && <TeamBadge team={a} size={22} shape="square" />}
                    <span className="truncate font-semibold">{a?.shortName ?? "TBD"}</span>
                    <span className="font-display rounded bg-ink px-2 py-0.5 text-base">
                      {m.scoreA}–{m.scoreB}
                    </span>
                    <span className="truncate font-semibold">{b?.shortName ?? "TBD"}</span>
                    {b && <TeamBadge team={b} size={22} shape="square" />}
                    <span className="ml-auto shrink-0">
                      {m.status === "live" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blood px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Live
                        </span>
                      ) : m.status === "final" ? (
                        <span className="text-[0.65rem] text-teal">Final</span>
                      ) : (
                        <span className="text-[0.65rem] text-foam/60">Scheduled</span>
                      )}
                    </span>
                    {m.detail && <span className="hidden text-[0.65rem] text-foam/60 lg:inline">{m.detail}</span>}
                  </motion.li>
                );
              })}
          </ul>
        </section>
      )}

      {event.scoringType !== "match" && (
        <section aria-labelledby="results-h" className="panel rounded-2xl p-4">
          <h2 id="results-h" className="font-display mb-2 flex items-center gap-2 text-xl text-parchment">
            {event.scoringType === "judged" ? (
              <>
                <Icon name="mask" size={20} className="text-sunset" /> Final Rankings
              </>
            ) : event.scoringType === "participation" ? (
              <>
                <Icon name="medal" size={20} className="text-straw" /> Gold medals
              </>
            ) : (
              <>
                <Icon name="chart" size={20} className="text-teal" /> Results
              </>
            )}
          </h2>
          {detail.placementRows.length === 0 && detail.judged.length === 0 ? (
            <p className="text-sm italic text-foam/60">
              {event.scoringType === "participation"
                ? "No participants have been entered yet."
                : "Results have not been published yet."}
            </p>
          ) : (
            <ol className="space-y-2">
              {(detail.placementRows.length > 0
                ? detail.placementRows.map((r) => ({
                    teamId: r.teamId,
                    placement: r.placement,
                    medal: r.medal,
                    count: r.count,
                    golds: r.golds,
                  }))
                : detail.judged.map((j) => ({
                    teamId: j.teamId,
                    placement: j.rank,
                    medal: j.rank <= 3 ? (["gold", "silver", "bronze"] as const)[j.rank - 1] : null,
                    count: undefined,
                    golds: undefined,
                  }))
              ).map((row) => {
                const team = byId.get(row.teamId);
                if (!team) return null;
                const participation = event.scoringType === "participation";
                const count = row.count ?? 0;
                return (
                  <li key={row.teamId} className="flex items-center gap-3 rounded-xl border border-foam/15 bg-ink/40 p-2">
                    <span className="font-display w-7 text-center text-xl">
                      {participation ? (
                        (row.golds ?? 0)
                      ) : row.placement > 0 ? (
                        row.placement
                      ) : (
                        // Placement 0 is "competed but did not place" — the `-` the
                        // PIO guide uses. Printing a bare 0 reads like a rank.
                        <abbr title="Competed, not placed" className="text-foam/60 no-underline">
                          –
                        </abbr>
                      )}
                    </span>
                    {row.medal ? (
                      <MedalIcon kind={row.medal} size={16} />
                    ) : (
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-foam/30" />
                    )}
                    <TeamBadge team={team} size={30} shape="square" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{team.name}</span>
                      <span className="block text-[0.68rem] text-foam/70">
                        The {team.mascot}
                        {participation && row.golds !== count
                          ? ` · ${count} participant${count === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {event.scoringType === "judged" && (
            <p className="mt-3 text-[0.68rem] text-foam/60">
              Individual judge scores are kept private to the panel; only the weighted final ranking is published.
            </p>
          )}
          {event.scoringType === "participation" && (
            <p className="mt-3 text-[0.68rem] text-foam/60">
              Every participant earns one gold medal. There are no placings, so this event counts towards the medal
              board but adds no placement points.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-foam/20 bg-ink/50 px-2.5 py-1 text-parchment/85">{children}</span>;
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-lg border border-foam/15 bg-ink/50 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-xs font-semibold transition ${value === o.id ? "bg-straw text-ink" : "text-parchment/80 hover:bg-foam/10"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
