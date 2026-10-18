"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import { useAdmin } from "./admin-shell";
import { BulkPaste } from "./bulk-paste";
import { toTsv, type BulkEntry } from "@/lib/bulk-parse";
import { canEditEvent } from "@/lib/auth/permissions";
import { TeamBadge } from "@/components/team-badge";
import { Icon, MedalIcon } from "@/components/icons";
import type { EventItem, Result, ResultStatus } from "@/lib/types";

interface Row {
  teamId: string;
  placement: number; // 0 = participation / not placed
  tie: boolean;
}

interface UndoEntry {
  eventId: string;
  previous: Result[];
  label: string;
}

export function QuickResult() {
  const { state } = useLive();
  const { role } = useAdmin();
  const [eventId, setEventId] = useState<string>("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const undoStack = useRef<UndoEntry[]>([]);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);

  const events = useMemo(
    () => [...state.events].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [state.events],
  );

  useEffect(() => {
    if (!eventId && events.length) {
      const firstOpen = events.find((e) => !e.locked) ?? events[0];
      setEventId(firstOpen.id);
    }
  }, [events, eventId]);

  const event: EventItem | undefined = state.events.find((e) => e.id === eventId);
  /** Participation events take a participant count, not a placing. */
  const isParticipation = event?.scoringType === "participation";

  // hydrate rows whenever the selected event changes
  useEffect(() => {
    if (!event) return;
    const existing = new Map(state.results.filter((r) => r.eventId === event.id).map((r) => [r.teamId, r]));
    const next: Record<string, Row> = {};
    for (const team of state.teams) {
      const r = existing.get(team.id);
      // Participation events keep the headcount in `count` and leave placement at
      // 0, so hydrating from `placement` alone showed 0 — and saving would then
      // write that 0 back, destroying the count. Read the right field per event.
      next[team.id] = {
        teamId: team.id,
        placement: isParticipation ? (r?.count ?? 0) : (r?.placement ?? 0),
        tie: r?.tie ?? false,
      };
    }
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const duplicates = useMemo(() => {
    // Participation events store a COUNT in the placement field, so two crews
    // with 5 participants would look like a duplicate placing. Skip entirely.
    if (isParticipation) return [];
    const used = new Map<number, string[]>();
    for (const row of Object.values(rows)) {
      if (row.placement < 1 || row.tie) continue;
      used.set(row.placement, [...(used.get(row.placement) ?? []), row.teamId]);
    }
    return [...used.entries()].filter(([, ids]) => ids.length > 1).map(([place]) => place);
  }, [rows]);

  const locked = Boolean(event?.locked) && !canEditEvent(role, true);

  async function save(status: ResultStatus) {
    if (!event) return;
    if (duplicates.length) {
      setMessage({ kind: "error", text: `Placement ${duplicates.join(", ")} is used twice. Declare a tie or change it.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    const previous = state.results.filter((r) => r.eventId === event.id).map((r) => ({ ...r }));
    const payload = Object.values(rows)
      .filter((r) => r.placement > 0)
      .map((r) =>
        isParticipation
          ? // Participants, not a placing: the scorer turns each one into a gold.
            { teamId: r.teamId, placement: 0, tie: false, count: r.placement, status }
          : { teamId: r.teamId, placement: r.placement, tie: r.tie, status },
      );
    const res = await postCommand({ type: "saveResults", eventId: event.id, rows: payload });
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: res.error ?? "Save failed" });
      return;
    }
    undoStack.current.push({ eventId: event.id, previous, label: `${event.name} (${status})` });
    setUndoLabel(`${event.name} (${status})`);
    setMessage({ kind: "ok", text: `Saved ${payload.length} placements as ${status}.` });
  }

  /** Push parsed spreadsheet rows into the grid (never straight to the sheet). */
  function applyBulk(entries: BulkEntry[]) {
    setRows((prev) => {
      const next = { ...prev };
      for (const e of entries) next[e.teamId] = { teamId: e.teamId, placement: e.placement, tie: e.tie };
      return next;
    });
  }

  /** Hand the current grid back as TSV so it can be edited in Excel and pasted back. */
  async function copyGrid() {
    const text = toTsv(
      state.teams.map((t) => {
        const r = rows[t.id];
        return { shortName: t.shortName, placement: r?.placement ?? 0, tie: r?.tie ?? false };
      }),
    );
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: "ok", text: "Grid copied — paste it into Excel, edit, then paste it back above." });
    } catch {
      setMessage({ kind: "error", text: "The browser blocked clipboard access. Copy the grid manually instead." });
    }
  }

  async function undo() {
    const entry = undoStack.current.pop();
    if (!entry) return;
    setBusy(true);
    const res = await postCommand({
      type: "saveResults",
      eventId: entry.eventId,
      rows: entry.previous.map((r) => ({ teamId: r.teamId, placement: r.placement, tie: r.tie, status: r.status })),
    });
    setBusy(false);
    setUndoLabel(undoStack.current.at(-1)?.label ?? null);
    if (!res.ok) setMessage({ kind: "error", text: res.error ?? "Undo failed" });
    else setMessage({ kind: "ok", text: `Undid the last entry for ${entry.label}.` });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
          <Icon name="bolt" size={26} className="text-straw" /> Quick result entry
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyGrid}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw disabled:opacity-50"
          >
            <Icon name="scroll" size={15} />
            Copy grid
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={busy || undoStack.current.length === 0}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw disabled:opacity-50"
          >
            <Icon name="undo" size={15} />
            Undo{undoLabel ? ` (${undoLabel})` : ""}
          </button>
        </div>
      </div>

      <div className="panel space-y-3 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Event / island</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.category} · {e.name} {e.locked ? " (locked)" : ""}
              </option>
            ))}
          </select>
        </label>

        {event && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill>{event.medalWeight} medals at stake</Pill>
            <Pill>{event.scoringType}</Pill>
            {event.multiplier !== 1 && <Pill>{event.multiplier}× multiplier</Pill>}
            {event.locked && (
              <Pill>
                <span className="inline-flex items-center gap-1">
                  <Icon name="lock" size={12} /> Locked
                </span>
              </Pill>
            )}
            {event.verify && (
              <Pill>
                <span className="inline-flex items-center gap-1 text-sunset">
                  <Icon name="warning" size={12} /> verify
                </span>
              </Pill>
            )}
          </div>
        )}

        {locked && (
          <p role="alert" className="rounded-lg border border-sunset/40 bg-sunset/10 p-2.5 text-sm text-sunset">
            This event is locked. Only the Secretariat can edit it.
          </p>
        )}
        {duplicates.length > 0 && (
          <p role="alert" className="rounded-lg border border-blood/40 bg-blood/10 p-2.5 text-sm">
            Duplicate placement: {duplicates.join(", ")}
          </p>
        )}
        {message && (
          <p role="status" className={`rounded-lg p-2.5 text-sm ${message.kind === "ok" ? "border border-teal/40 bg-teal/10 text-teal" : "border border-blood/40 bg-blood/10 text-parchment"}`}>
            {message.text}
          </p>
        )}
      </div>

      <BulkPaste
        teams={state.teams}
        locked={Boolean(locked)}
        participation={Boolean(isParticipation)}
        onApply={applyBulk}
      />

      <div className="panel overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {isParticipation ? "Record each crew's participants" : "Assign each crew a placement"}
          </caption>
          <thead>
            <tr className="border-b border-foam/20 bg-ink/50 text-left text-[0.68rem] uppercase tracking-wider text-foam/70">
              <th scope="col" className="px-3 py-2">Crew</th>
              <th scope="col" className="px-3 py-2">{isParticipation ? "Participants" : "Placement"}</th>
              <th scope="col" className="px-3 py-2 text-center">{isParticipation ? "—" : "Tie"}</th>
              <th scope="col" className="px-3 py-2">Award</th>
            </tr>
          </thead>
          <tbody>
            {state.teams.map((team) => {
              const row = rows[team.id] ?? { teamId: team.id, placement: 0, tie: false };
              const medal = row.placement >= 1 && row.placement <= 3;
              return (
                <tr key={team.id} className="border-b border-foam/10 last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <TeamBadge team={team} size={26} shape="square" />
                      <span className="truncate">{team.shortName}</span>
                      <span className="hidden truncate text-[0.68rem] text-foam/60 sm:inline">{team.mascot}</span>
                    </span>
                  </th>
                  <td className="px-3 py-2">
                    {isParticipation ? (
                      <input
                        type="number"
                        min={0}
                        max={500}
                        inputMode="numeric"
                        aria-label={`${team.shortName} participants`}
                        disabled={locked}
                        value={row.placement}
                        onChange={(e) =>
                          setRows((p) => ({ ...p, [team.id]: { ...row, placement: Math.max(0, Number(e.target.value) || 0) } }))
                        }
                        className="w-24 rounded-lg border border-foam/25 bg-ink/60 px-2 py-1.5 text-parchment disabled:opacity-50"
                      />
                    ) : (
                      <select
                        aria-label={`${team.shortName} placement`}
                        disabled={locked}
                        value={row.placement}
                        onChange={(e) => setRows((p) => ({ ...p, [team.id]: { ...row, placement: Number(e.target.value) } }))}
                        className="rounded-lg border border-foam/25 bg-ink/60 px-2 py-1.5 text-parchment disabled:opacity-50"
                      >
                        <option value={0}>— none —</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isParticipation ? (
                      <span className="text-xs text-foam/40">n/a</span>
                    ) : (
                      <input
                        type="checkbox"
                        className="size-6 shrink-0 accent-straw"
                        disabled={locked}
                        checked={row.tie}
                        aria-label={`${team.shortName} declared tie`}
                        onChange={(e) => setRows((p) => ({ ...p, [team.id]: { ...row, tie: e.target.checked } }))}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {medal ? (
                      <span className="inline-flex items-center gap-1">
                        <MedalIcon
                          kind={row.placement === 1 ? "gold" : row.placement === 2 ? "silver" : "bronze"}
                          size={14}
                        />
                        {row.placement === 1 ? "gold" : row.placement === 2 ? "silver" : "bronze"}
                      </span>
                    ) : row.placement > 0 ? (
                      "participation"
                    ) : (
                      "—"
                    )}
                    {medal && <span className="ml-1 text-straw">+{event?.medalWeight}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={busy || locked}
          className="inline-flex min-h-11 items-center rounded-lg border border-foam/30 px-4 font-semibold text-parchment hover:border-straw hover:text-straw disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={() => save("published")}
          disabled={busy || locked}
          className="inline-flex min-h-11 items-center rounded-lg bg-straw px-4 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save & publish"}
        </button>
        <button
          type="button"
          onClick={() => postCommand({ type: "unpublishResults", eventId })}
          disabled={busy || locked}
          className="inline-flex min-h-11 items-center rounded-lg border border-foam/25 px-4 text-sm text-parchment/85 hover:border-blood hover:text-blood disabled:opacity-50"
        >
          Unpublish event
        </button>
      </div>

      <p className="text-xs text-foam/60">
        Drafts stay invisible to the public. Publishing makes the result count toward the Bounty Board and medal tally
        immediately.
      </p>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-foam/20 bg-ink/50 px-2.5 py-1 text-parchment/85">{children}</span>;
}
