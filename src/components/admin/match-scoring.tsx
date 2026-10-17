"use client";

import { useEffect, useMemo, useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import { slugify } from "@/lib/format";
import type { Match, MatchStatus } from "@/lib/types";
import { Icon } from "@/components/icons";
import { TeamBadge } from "@/components/team-badge";

const blank = {
  round: "Round 1",
  teamA: "",
  teamB: "",
  scoreA: 0,
  scoreB: 0,
  status: "scheduled" as MatchStatus,
  detail: "",
  winner: "",
};

/**
 * Match scoring for head-to-head events. Matches are keyed by a derived id so
 * re-saving the same fixture updates it in place instead of duplicating.
 */
export function MatchScoring() {
  const { state } = useLive();

  const events = useMemo(
    () =>
      [...state.events]
        .filter((e) => e.scoringType === "match")
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [state.events],
  );

  const [eventId, setEventId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0].id);
  }, [events, eventId]);

  const matches = useMemo(
    () => state.matches.filter((m) => m.eventId === eventId),
    [state.matches, eventId],
  );

  function reset(next?: Partial<typeof blank>) {
    setEditingId(null);
    setForm({ ...blank, ...next, teamA: next?.teamA ?? "", teamB: next?.teamB ?? "" });
    setMessage(null);
  }

  function load(m: Match) {
    setEditingId(m.id);
    setForm({
      round: m.round,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      status: m.status,
      detail: m.detail ?? "",
      winner: m.winner,
    });
    setMessage(null);
  }

  async function save() {
    if (!eventId) return;
    if (!form.teamA || !form.teamB || form.teamA === form.teamB) {
      setMessage({ kind: "error", text: "Pick two different crews." });
      return;
    }
    const winner =
      form.winner || (form.scoreA > form.scoreB ? form.teamA : form.scoreB > form.scoreA ? form.teamB : "");
    const id = editingId ?? `${eventId}--${slugify(form.round) || "round"}--${form.teamA}-${form.teamB}`;

    setBusy(true);
    const res = await postCommand({
      type: "saveMatch",
      match: {
        id,
        eventId,
        round: form.round,
        teamA: form.teamA,
        teamB: form.teamB,
        scoreA: Number(form.scoreA) || 0,
        scoreB: Number(form.scoreB) || 0,
        detail: form.detail || undefined,
        winner,
        status: form.status,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: res.error ?? "Save failed" });
      return;
    }
    setMessage({ kind: "ok", text: `${editingId ? "Updated" : "Created"} ${form.round}: ${form.teamA} vs ${form.teamB}.` });
    reset({ round: form.round });
  }

  async function remove(m: Match) {
    if (!window.confirm(`Delete ${m.round}: ${m.teamA} vs ${m.teamB}?`)) return;
    setBusy(true);
    const res = await postCommand({ type: "deleteMatch", id: m.id });
    setBusy(false);
    if (!res.ok) setMessage({ kind: "error", text: res.error ?? "Delete failed" });
    else {
      setMessage({ kind: "ok", text: "Match deleted." });
      if (editingId === m.id) reset();
    }
  }

  const name = (id: string) => state.teams.find((t) => t.id === id)?.shortName ?? id;

  return (
    <section className="space-y-4">
      <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="ball" size={26} className="text-straw" /> Match scoring
      </h1>

      <div className="panel space-y-3 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Match event</span>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              reset();
            }}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.category} · {e.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Round</span>
            <input
              value={form.round}
              list="round-options"
              onChange={(e) => setForm((f) => ({ ...f, round: e.target.value }))}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            />
            {/*
              Only these labels are understood by the scoring: the final decides
              1st/2nd and the bronze-medal match decides 3rd. "Semifinal" is not
              the final.
            */}
            <datalist id="round-options">
              <option value="Round 1" />
              <option value="Quarterfinal" />
              <option value="Semifinal" />
              <option value="Bronze Medal Match" />
              <option value="Final" />
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MatchStatus }))}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="final">Final</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Crew A</span>
            <select
              value={form.teamA}
              onChange={(e) => setForm((f) => ({ ...f, teamA: e.target.value, winner: "" }))}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-2 py-2.5 text-parchment"
            >
              <option value="">— pick —</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName}
                </option>
              ))}
            </select>
          </label>
          <span className="pb-3 text-foam/50">vs</span>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Crew B</span>
            <select
              value={form.teamB}
              onChange={(e) => setForm((f) => ({ ...f, teamB: e.target.value, winner: "" }))}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-2 py-2.5 text-parchment"
            >
              <option value="">— pick —</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Score A</span>
            <input
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              value={form.scoreA}
              onChange={(e) => setForm((f) => ({ ...f, scoreA: Number(e.target.value) }))}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Score B</span>
            <input
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              value={form.scoreB}
              onChange={(e) => setForm((f) => ({ ...f, scoreB: Number(e.target.value) }))}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Per-set detail (optional)</span>
          <input
            value={form.detail}
            onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
            placeholder="25-20, 25-18, 25-22"
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Winner</span>
          <select
            value={form.winner}
            onChange={(e) => setForm((f) => ({ ...f, winner: e.target.value }))}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
          >
            <option value="">Auto from score</option>
            {form.teamA && <option value={form.teamA}>{name(form.teamA)}</option>}
            {form.teamB && <option value={form.teamB}>{name(form.teamB)}</option>}
          </select>
        </label>

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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : editingId ? "Update match" : "Add match"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg border border-foam/25 px-4 py-2.5 text-sm text-parchment/85 hover:border-straw hover:text-straw"
            >
              Cancel edit
            </button>
          )}
        </div>
      </div>

      <div className="panel rounded-2xl p-4">
        <h2 className="font-display mb-2 text-xl text-parchment">Fixtures ({matches.length})</h2>
        <ul className="space-y-1.5">
          {matches.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-foam/15 bg-ink/40 px-2.5 py-2 text-sm">
              <span className="text-[0.68rem] uppercase tracking-wider text-foam/60">{m.round}</span>
              <span className="font-semibold text-parchment">{name(m.teamA)}</span>
              <span className="font-display tabular-nums">
                {m.scoreA}–{m.scoreB}
              </span>
              <span className="font-semibold text-parchment">{name(m.teamB)}</span>
              {m.status === "live" && (
                <span className="inline-flex items-center gap-1 rounded bg-blood px-1.5 py-0.5 text-[0.6rem] font-bold uppercase">
                  <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Live
                </span>
              )}
              {m.status === "final" && m.winner && (
                <span className="rounded bg-straw/20 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-straw">
                  {name(m.winner)} won
                </span>
              )}
              <span className="ml-auto flex gap-1.5">
                <button
                  type="button"
                  onClick={() => load(m)}
                  className="rounded-lg border border-foam/25 px-2.5 py-1 text-xs hover:border-straw hover:text-straw"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  disabled={busy}
                  className="rounded-lg border border-foam/25 px-2.5 py-1 text-xs text-foam/70 hover:border-blood hover:text-blood disabled:opacity-50"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {matches.length === 0 && <li className="text-sm italic text-foam/60">No fixtures for this event yet.</li>}
        </ul>
      </div>
    </section>
  );
}
