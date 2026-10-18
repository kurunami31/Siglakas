"use client";

import { useMemo, useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import { ROUND_LABELS } from "@/lib/match-rounds";
import { fixtureId, parseMatchLines } from "@/lib/match-parse";
import type { Match, MatchStatus } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Select } from "@/components/select";

const blank = {
  // A RECOGNISED label. The old default was "Round 1", which the scorer does not
  // understand — so the very first fixture anyone added counted for nothing.
  round: ROUND_LABELS[0] as string,
  teamA: "",
  teamB: "",
  scoreA: 0,
  scoreB: 0,
  status: "scheduled" as MatchStatus,
  detail: "",
  winner: "",
};

const STATUS_OPTIONS: Array<{ value: MatchStatus; label: string }> = [
  { value: "scheduled", label: "Scheduled — not counted yet" },
  { value: "live", label: "Live — show it on the board" },
  { value: "final", label: "Finished — count the placing" },
];

const ROUND_OPTIONS = ROUND_LABELS.map((label) => ({ value: label as string, label }));

/**
 * Fixtures for head-to-head events.
 *
 * The form asks only for what a person actually knows — event, round, two crews,
 * two scores. The fixture id is generated, the winner is derived from the scores,
 * and the round is a dropdown of the labels the scorer understands, because an
 * unrecognised round crowns nobody and says nothing.
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
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Derived rather than set in an effect: an effect only runs on the client, so
  // the first event would be unselected during server render and everything that
  // depends on it — the paste panel included — would be missing from the HTML.
  const activeEventId = eventId || events[0]?.id || "";

  const matches = useMemo(
    () => state.matches.filter((m) => m.eventId === activeEventId),
    [state.matches, activeEventId],
  );

  const name = (id: string) => state.teams.find((t) => t.id === id)?.shortName ?? id;

  /** Derived, not typed — unless the scores level, when someone must break it. */
  const derivedWinner =
    form.scoreA > form.scoreB ? form.teamA : form.scoreB > form.scoreA ? form.teamB : "";
  const isTied = Boolean(form.teamA && form.teamB && form.scoreA === form.scoreB);

  function reset(next?: Partial<typeof blank>) {
    setEditingId(null);
    setForm({ ...blank, ...next });
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
    if (!activeEventId) return;
    if (!form.teamA || !form.teamB || form.teamA === form.teamB) {
      setMessage({ kind: "error", text: "Pick two different crews." });
      return;
    }
    if (isTied && !form.winner) {
      setMessage({ kind: "error", text: "The scores are level — pick who won before saving." });
      return;
    }
    const winner = form.winner || derivedWinner;
    const id = editingId ?? fixtureId(activeEventId, form.round, form.teamA, form.teamB);

    setBusy(true);
    const res = await postCommand({
      type: "saveMatch",
      match: {
        id,
        eventId: activeEventId,
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
    setMessage({ kind: "ok", text: `${editingId ? "Updated" : "Added"} ${form.round}: ${name(form.teamA)} vs ${name(form.teamB)}.` });
    reset({ round: form.round });
  }

  async function remove(m: Match) {
    if (!window.confirm(`Delete ${m.round}: ${name(m.teamA)} vs ${name(m.teamB)}?`)) return;
    setBusy(true);
    const res = await postCommand({ type: "deleteMatch", id: m.id });
    setBusy(false);
    if (!res.ok) setMessage({ kind: "error", text: res.error ?? "Delete failed" });
    else {
      setMessage({ kind: "ok", text: "Fixture deleted." });
      if (editingId === m.id) reset();
    }
  }

  const field = "w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40";

  return (
    <section className="space-y-4">
      <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="ball" size={26} className="text-straw" /> Match scoring
      </h1>

      <div className="panel space-y-3 rounded-2xl p-4">
        <Select
          label="Match event"
          value={activeEventId}
          onChange={(v) => {
            setEventId(v);
            reset();
          }}
          options={events.map((e) => ({ value: e.id, label: `${e.category} · ${e.name}` }))}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            label="Round"
            value={form.round}
            onChange={(v) => setForm((f) => ({ ...f, round: v }))}
            options={ROUND_OPTIONS}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as MatchStatus }))}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Select
            label="Crew A"
            value={form.teamA}
            onChange={(v) => setForm((f) => ({ ...f, teamA: v, winner: "" }))}
            options={[{ value: "", label: "— pick —" }, ...state.teams.map((t) => ({ value: t.id, label: t.shortName }))]}
          />
          <span className="pb-3 text-foam/50">vs</span>
          <Select
            label="Crew B"
            value={form.teamB}
            onChange={(v) => setForm((f) => ({ ...f, teamB: v, winner: "" }))}
            options={[{ value: "", label: "— pick —" }, ...state.teams.map((t) => ({ value: t.id, label: t.shortName }))]}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          <label className="block">
            <span className="mb-1 block text-[0.65rem] uppercase tracking-widest text-foam/70">Score A</span>
            <input
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              value={form.scoreA}
              onChange={(e) => setForm((f) => ({ ...f, scoreA: Number(e.target.value), winner: "" }))}
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.65rem] uppercase tracking-widest text-foam/70">Score B</span>
            <input
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              value={form.scoreB}
              onChange={(e) => setForm((f) => ({ ...f, scoreB: Number(e.target.value), winner: "" }))}
              className={field}
            />
          </label>
        </div>

        {/* Derived, so there is nothing to get wrong. A level score is the one
            case that needs a human, because no placing can be inferred. */}
        {isTied ? (
          <Select
            label="Scores are level — who won?"
            value={form.winner}
            onChange={(v) => setForm((f) => ({ ...f, winner: v }))}
            options={[
              { value: "", label: "— pick the winner —" },
              { value: form.teamA, label: name(form.teamA) },
              { value: form.teamB, label: name(form.teamB) },
            ]}
          />
        ) : (
          <p className="text-xs text-foam/70">
            Winner:{" "}
            <strong className="text-parchment">
              {derivedWinner ? name(derivedWinner) : "set both scores"}
            </strong>{" "}
            <span className="text-foam/50">(derived from the scores)</span>
          </p>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-foam/70">Per-set detail (optional)</summary>
          <input
            value={form.detail}
            onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
            placeholder="25-20, 25-18, 25-22"
            className={`mt-1.5 ${field}`}
          />
        </details>

        {message && (
          <p
            role="status"
            className={`rounded-lg p-2.5 text-sm ${
              message.kind === "ok" ? "border border-teal/40 bg-teal/10 text-teal" : "border border-blood/40 bg-blood/10 text-parchment"
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
            className="min-h-11 rounded-lg bg-straw px-4 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : editingId ? "Update fixture" : "Add fixture"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => reset()}
              className="min-h-11 rounded-lg border border-foam/25 px-4 text-sm text-parchment/85 hover:border-straw hover:text-straw"
            >
              Cancel edit
            </button>
          )}
        </div>
      </div>

      {activeEventId && (
        <FixturePaste
          eventId={activeEventId}
          onDone={(text) => {
            setMessage({ kind: "ok", text });
            reset({ round: form.round });
          }}
          onError={(text) => setMessage({ kind: "error", text })}
        />
      )}

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
                  className="min-h-9 rounded-lg border border-foam/25 px-2.5 text-xs hover:border-straw hover:text-straw"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  disabled={busy}
                  className="min-h-9 rounded-lg border border-foam/25 px-2.5 text-xs text-foam/70 hover:border-blood hover:text-blood disabled:opacity-50"
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

/**
 * Paste a whole round at once:
 *
 *     FTED 2 - 0 FACET
 *     FBM  1 - 2 FCJE
 *
 * Crews resolve by short name, mascot or full name, so nobody has to know ids.
 * Nothing is written until Save, and unresolvable lines are reported rather than
 * dropped — a fixture that cannot be matched scores nothing and says nothing.
 */
function FixturePaste({
  eventId,
  onDone,
  onError,
}: {
  eventId: string;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const { state } = useLive();
  const [round, setRound] = useState<string>(ROUND_LABELS[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { fixtures, problems } = useMemo(() => parseMatchLines(text, state.teams), [text, state.teams]);
  const drawn = fixtures.filter((f) => !f.scheduled && f.scoreA === f.scoreB);

  async function saveAll() {
    setBusy(true);
    let saved = 0;
    for (const f of fixtures) {
      const res = await postCommand({
        type: "saveMatch",
        match: {
          id: fixtureId(eventId, round, f.teamA, f.teamB),
          eventId,
          round,
          teamA: f.teamA,
          teamB: f.teamB,
          scoreA: f.scoreA,
          scoreB: f.scoreB,
          detail: f.detail,
          // Left blank on purpose: the scorer derives the winner from the score.
          winner: "",
          status: f.scheduled ? "scheduled" : "final",
        },
      });
      if (!res.ok) {
        setBusy(false);
        onError(`Saved ${saved} of ${fixtures.length}, then failed: ${res.error ?? "unknown error"}`);
        return;
      }
      saved += 1;
    }
    setBusy(false);
    setText("");
    onDone(`Saved ${saved} fixture${saved === 1 ? "" : "s"} as ${round}.`);
  }

  return (
    <div className="panel rounded-2xl p-4">
      <h2 className="font-display mb-1 flex items-center gap-2 text-xl text-parchment">
        <Icon name="scroll" size={18} className="text-straw" /> Paste a round
      </h2>
      <p className="mb-3 text-xs text-foam/70">
        One fixture per line: <code>FTED 2 - 0 FACET</code>. Crew names come from the Teams tab, so
        &ldquo;Blue Phoenix&rdquo; works as well as <code>fted</code>. Write <code>vs</code> for a fixture that
        has not been played. Scored lines are saved as finished.
      </p>

      <Select
        label="Round for these fixtures"
        value={round}
        onChange={(v) => setRound(v)}
        options={ROUND_OPTIONS}
      />

      <label className="mt-3 block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-widest text-foam/70">Fixtures</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={"FTED 2 - 0 FACET\nFBM 1 - 2 FCJE"}
          className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 font-mono text-sm text-parchment placeholder:text-foam/40"
        />
      </label>

      <p role="status" className="mt-2 text-xs text-foam/70">
        {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"} ready
        {problems.length > 0 && <span className="text-sunset"> · {problems.length} line{problems.length === 1 ? "" : "s"} cannot be read</span>}
      </p>

      {problems.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-sunset">
          {problems.slice(0, 5).map((p) => (
            <li key={`${p.line}-${p.text}`}>
              line {p.line}: {p.message}
            </li>
          ))}
          {problems.length > 5 && <li>…and {problems.length - 5} more.</li>}
        </ul>
      )}

      {drawn.length > 0 && (
        <p className="mt-2 rounded-lg border border-sunset/40 bg-sunset/10 p-2 text-xs text-parchment">
          {drawn.length} fixture{drawn.length === 1 ? " has" : "s have"} level scores, so no winner can be
          derived. Save them, then pick the winner on the fixture row.
        </p>
      )}

      <button
        type="button"
        onClick={saveAll}
        disabled={busy || fixtures.length === 0 || problems.length > 0}
        className="mt-3 min-h-11 rounded-lg bg-straw px-4 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Saving…" : `Save ${fixtures.length || ""} fixture${fixtures.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
