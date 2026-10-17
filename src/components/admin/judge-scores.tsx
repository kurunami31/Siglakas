"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLive } from "@/components/providers";
import { getJudgeScores, postCommand } from "@/lib/admin-client";
import { can } from "@/lib/auth/permissions";
import { computeJudgedStandings } from "@/lib/scoring/judged";
import type { Criterion, JudgeScore } from "@/lib/types";
import { Icon } from "@/components/icons";
import { TeamBadge } from "@/components/team-badge";
import { useAdmin } from "./admin-shell";

type Grid = Record<string, Record<string, number>>;

/** teamId -> criterion -> score, for one judge only. */
function buildGrid(rows: JudgeScore[], judgeName: string): Grid {
  const next: Grid = {};
  for (const s of rows) {
    if (s.judge !== judgeName) continue;
    next[s.teamId] = { ...(next[s.teamId] ?? {}), [s.criterion]: s.score };
  }
  return next;
}

/**
 * Judge scoring for socio-cultural (judged) events.
 *
 * `saveJudgeScores` replaces *every* score for an event, so this screen always
 * submits the other judges' rows verbatim alongside the one being edited —
 * otherwise entering judge #2 would silently wipe judge #1.
 *
 * Scores are not part of the public state payload, so they are fetched per
 * event from /api/admin/judge-scores.
 */
export function JudgeScores() {
  const { state } = useLive();
  const { role } = useAdmin();

  const events = useMemo(
    () =>
      [...state.events]
        .filter((e) => e.scoringType === "judged")
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [state.events],
  );

  const [eventId, setEventId] = useState("");
  const [scores, setScores] = useState<JudgeScore[]>([]);
  const [judge, setJudge] = useState("");
  const [grid, setGrid] = useState<Grid>({});
  const [criteriaDraft, setCriteriaDraft] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);

  const criteria = useMemo(
    () => state.criteria.filter((c) => c.eventId === eventId).sort((a, b) => a.order - b.order),
    [state.criteria, eventId],
  );

  const judges = useMemo(() => [...new Set(scores.map((s) => s.judge))], [scores]);

  /** Load this event's scores (and its criteria draft) whenever the event changes. */
  const load = useCallback(
    async (id: string, { resetJudge = true } = {}) => {
      if (!id) return;
      setLoading(true);
      const res = await getJudgeScores(id);
      setLoading(false);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error ?? "Could not load judge scores" });
        setScores([]);
        return;
      }
      setScores(res.rows);
      if (resetJudge) {
        const first = [...new Set(res.rows.map((r) => r.judge))][0] ?? "";
        setJudge(first);
        setGrid(buildGrid(res.rows, first));
      } else {
        setGrid(buildGrid(res.rows, judge));
      }
    },
    [judge],
  );

  useEffect(() => {
    void load(eventId, { resetJudge: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    setCriteriaDraft(
      state.criteria
        .filter((c) => c.eventId === eventId)
        .sort((a, b) => a.order - b.order)
        .map((c, i) => ({ ...c, order: i })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Re-hydrate the editing grid when the judge or the fetched rows change.
  // Typing a score does not touch either, so live updates never clobber it.
  useEffect(() => {
    setGrid(buildGrid(scores, judge));
  }, [judge, scores]);

  const standings = useMemo(
    () => (eventId ? computeJudgedStandings(eventId, state.teams, state.criteria, scores) : []),
    [eventId, state.teams, state.criteria, scores],
  );

  const filled = useMemo(() => {
    let n = 0;
    for (const team of state.teams) for (const c of criteria) {
      if (grid[team.id]?.[c.criterion] !== undefined) n++;
    }
    return n;
  }, [grid, criteria, state.teams]);

  function setScore(teamId: string, criterion: string, raw: string) {
    const value = raw === "" ? undefined : Number(raw);
    setGrid((prev) => {
      const forTeam = { ...(prev[teamId] ?? {}) };
      if (value === undefined || Number.isNaN(value)) delete forTeam[criterion];
      else forTeam[criterion] = value;
      return { ...prev, [teamId]: forTeam };
    });
  }

  async function save() {
    if (!eventId) return;
    const name = judge.trim();
    if (!name) {
      setMessage({ kind: "error", text: "Give the judge a name before saving." });
      return;
    }
    if (criteria.length === 0) {
      setMessage({ kind: "error", text: "Add at least one criterion before saving." });
      return;
    }
    setBusy(true);
    setMessage(null);

    const others = scores.filter((s) => s.judge !== name);
    const mine: JudgeScore[] = [];
    for (const team of state.teams) {
      for (const c of criteria) {
        const v = grid[team.id]?.[c.criterion];
        if (v === undefined) continue;
        mine.push({ eventId, teamId: team.id, judge: name, criterion: c.criterion, score: v });
      }
    }

    const res = await postCommand({ type: "saveJudgeScores", eventId, rows: [...others, ...mine] });
    if (!res.ok) {
      setBusy(false);
      setMessage({ kind: "error", text: res.error ?? "Save failed" });
      return;
    }
    await load(eventId, { resetJudge: false });
    setBusy(false);
    setMessage({ kind: "ok", text: `Saved ${mine.length} scores for ${name}.` });
  }

  async function saveCriteria() {
    const rows = criteriaDraft
      .filter((c) => c.criterion.trim())
      .map((c, i) => ({
        eventId,
        criterion: c.criterion.trim(),
        weight: Number(c.weight) || 0,
        order: i,
      }));
    setBusy(true);
    const res = await postCommand({ type: "saveCriteria", eventId, rows });
    setBusy(false);
    setMessage(
      res.ok
        ? { kind: "ok", text: `Saved ${rows.length} criteria.` }
        : { kind: "error", text: res.error ?? "Could not save criteria" },
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="mask" size={26} className="text-straw" /> Judge scores
      </h1>

      <div className="panel space-y-3 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Judged event</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.category} · {e.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Judge</span>
          <input
            value={judge}
            onChange={(e) => setJudge(e.target.value)}
            placeholder="e.g. Judge 1"
            list="judge-names"
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
          />
          <datalist id="judge-names">
            {judges.map((j) => (
              <option key={j} value={j} />
            ))}
          </datalist>
        </label>

        {judges.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-foam/70">
            Existing:
            {judges.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJudge(j)}
                className={`rounded-full border px-2.5 py-1 ${
                  j === judge ? "border-straw text-straw" : "border-foam/25 hover:border-straw"
                }`}
              >
                {j}
              </button>
            ))}
          </p>
        )}

        {message && (
          <p
            role="status"
            className={`rounded-lg p-2.5 text-sm ${
              message.kind === "ok"
                ? "border border-teal/40 bg-teal/10 text-teal"
                : "border border-blood/40 bg-blood/10 text-parchment"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {can(role, "manage_criteria") && (
        <div className="panel space-y-3 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl text-parchment">Criteria &amp; weights</h2>
            <button
              type="button"
              onClick={() => setCriteriaDraft((p) => [...p, { eventId, criterion: "", weight: 10, order: p.length }])}
              className="rounded-lg border border-foam/25 px-2.5 py-1.5 text-xs hover:border-straw hover:text-straw"
            >
              + Add criterion
            </button>
          </div>
          <ul className="space-y-1.5">
            {criteriaDraft.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  value={c.criterion}
                  aria-label={`Criterion ${i + 1} name`}
                  onChange={(e) =>
                    setCriteriaDraft((p) => p.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))
                  }
                  placeholder="Criterion name"
                  className="min-w-0 flex-1 rounded-lg border border-foam/25 bg-ink/60 px-2.5 py-2 text-parchment placeholder:text-foam/40"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={c.weight}
                  aria-label={`Criterion ${i + 1} weight`}
                  onChange={(e) =>
                    setCriteriaDraft((p) => p.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))
                  }
                  className="w-20 rounded-lg border border-foam/25 bg-ink/60 px-2.5 py-2 text-parchment"
                />
                <button
                  type="button"
                  aria-label={`Remove criterion ${i + 1}`}
                  onClick={() => setCriteriaDraft((p) => p.filter((_, j) => j !== i))}
                  className="rounded-lg border border-foam/25 p-2 text-foam/70 hover:border-blood hover:text-blood"
                >
                  <Icon name="close" size={13} />
                </button>
              </li>
            ))}
            {criteriaDraft.length === 0 && (
              <li className="text-sm italic text-foam/60">No criteria yet — judges cannot score without them.</li>
            )}
          </ul>
          <button
            type="button"
            onClick={saveCriteria}
            disabled={busy}
            className="rounded-lg border border-foam/30 px-4 py-2 text-sm font-semibold text-parchment hover:border-straw hover:text-straw disabled:opacity-50"
          >
            Save criteria
          </button>
        </div>
      )}

      <div className="panel overflow-hidden rounded-2xl">
        {/* A crews x criteria matrix genuinely scrolls sideways; pinning the crew
            column means context is never lost while it does. */}
        <p className="border-b border-foam/10 px-3 py-1.5 text-[0.68rem] text-foam/60 sm:hidden">
          Scroll sideways for more criteria — the crew column stays pinned.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Scores from {judge || "the selected judge"}
              {loading ? " (loading)" : ""}
            </caption>
            <thead>
              <tr className="border-b border-foam/20 bg-ink/60 text-left text-[0.68rem] uppercase tracking-wider text-foam/80">
                <th scope="col" className="sticky left-0 z-20 bg-ink px-2 py-2.5 sm:px-3">
                  Crew
                </th>
                {criteria.map((c) => (
                  <th key={c.criterion} scope="col" className="px-1 py-2.5 text-center sm:px-2">
                    {c.criterion}
                    <span className="ml-1 font-normal text-foam/50">{c.weight}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.teams.map((team) => (
                <tr key={team.id} className="border-b border-foam/10 last:border-0">
                  <th scope="row" className="sticky left-0 z-10 border-r border-foam/10 bg-ink px-2 py-2 text-left font-normal sm:px-3">
                    <span className="flex items-center gap-2">
                      <TeamBadge team={team} size={26} shape="square" />
                      <span className="truncate">{team.shortName}</span>
                    </span>
                  </th>
                  {criteria.map((c) => (
                    <td key={c.criterion} className="px-1 py-2 text-center sm:px-2">
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        inputMode="decimal"
                        aria-label={`${team.shortName} ${c.criterion}`}
                        value={grid[team.id]?.[c.criterion] ?? ""}
                        onChange={(e) => setScore(team.id, c.criterion, e.target.value)}
                        className="w-12 rounded-lg border border-foam/25 bg-ink/60 px-1.5 py-1.5 text-center text-parchment sm:w-16"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || loading}
          className="rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save scores"}
        </button>
        <span className="text-xs text-foam/60">
          {filled} score{filled === 1 ? "" : "s"} entered for this judge
        </span>
      </div>

      <div className="panel rounded-2xl p-4">
        <h2 className="font-display mb-2 flex items-center gap-2 text-xl text-parchment">
          <Icon name="trophy" size={18} className="text-straw" /> Live standings
        </h2>
        <ol className="space-y-1.5">
          {standings.map((row) => {
            const team = state.teams.find((t) => t.id === row.teamId);
            if (!team || row.finalScore === 0) return null;
            return (
              <li
                key={row.teamId}
                className="flex items-center gap-3 rounded-lg border border-foam/15 bg-ink/40 px-2.5 py-1.5"
              >
                <span className="font-display w-6 text-center text-lg">{row.rank}</span>
                <TeamBadge team={team} size={24} shape="square" />
                <span className="truncate text-sm">{team.shortName}</span>
                <span className="ml-auto font-display text-straw">{row.finalScore.toFixed(2)}</span>
              </li>
            );
          })}
          {standings.every((r) => r.finalScore === 0) && (
            <li className="text-sm italic text-foam/60">No scores yet for this event.</li>
          )}
        </ol>
      </div>
    </section>
  );
}
