"use client";

import { useMemo, useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import { can } from "@/lib/auth/permissions";
import type { Division, EventItem, EventStatus } from "@/lib/types";
import { Icon } from "@/components/icons";
import { useAdmin } from "./admin-shell";

type Patch = Partial<EventItem>;

/**
 * Bulk editor for the event catalogue: medals at stake, multiplier, status and
 * the lock / verify flags. Edits are collected locally and flushed as one
 * `updateEvent` command per changed row, so a typo never half-saves a batch.
 */
export function EventAdmin() {
  const { state } = useLive();
  const { role } = useAdmin();
  const canLock = can(role, "lock_event");

  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<Division | "all">("all");
  const [dirty, setDirty] = useState<Record<string, Patch>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.events
      .filter((e) => (division === "all" ? true : e.division === division))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) : true))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [state.events, query, division]);

  const changedCount = Object.keys(dirty).length;

  function setField(event: EventItem, field: keyof EventItem, value: unknown) {
    setDirty((prev) => ({
      ...prev,
      [event.id]: { ...(prev[event.id] ?? {}), [field]: value } as Patch,
    }));
  }

  const value = <K extends keyof EventItem>(event: EventItem, field: K): EventItem[K] =>
    (dirty[event.id]?.[field] ?? event[field]) as EventItem[K];

  async function save() {
    const entries = Object.entries(dirty);
    if (entries.length === 0) return;
    setBusy(true);
    setMessage(null);
    const failed: string[] = [];
    for (const [id, patch] of entries) {
      const res = await postCommand({ type: "updateEvent", id, patch });
      if (!res.ok) failed.push(`${state.events.find((e) => e.id === id)?.name ?? id}: ${res.error}`);
    }
    setBusy(false);
    if (failed.length) {
      setMessage({ kind: "error", text: failed.slice(0, 3).join(" · ") });
      return;
    }
    setDirty({});
    setMessage({ kind: "ok", text: `Saved ${entries.length} event${entries.length === 1 ? "" : "s"}.` });
  }

  const inputCls =
    "w-full rounded-lg border border-foam/25 bg-ink/60 px-2 py-1.5 text-sm text-parchment disabled:opacity-50";

  return (
    <section className="space-y-4 pb-24">
      <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="map" size={26} className="text-straw" /> Events &amp; locks
      </h1>

      <div className="panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Event or category…"
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
          />
        </label>
        <div role="group" aria-label="Division" className="flex gap-1 rounded-lg border border-foam/15 bg-ink/50 p-1">
          {(["all", "sports", "cultural"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={division === d}
              onClick={() => setDivision(d)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                division === d ? "bg-straw text-ink" : "text-parchment/80 hover:bg-foam/10"
              }`}
            >
              {d === "all" ? "All" : d === "sports" ? "Sports" : "Socio-Cultural"}
            </button>
          ))}
        </div>
        <span className="text-xs text-foam/60">{rows.length} shown</span>
      </div>

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

      <ul className="space-y-2">
        {rows.map((event) => {
          const isDirty = Boolean(dirty[event.id]);
          return (
            <li
              key={event.id}
              className={`panel rounded-xl p-3 ${isDirty ? "border-straw/60" : ""}`}
              style={isDirty ? { boxShadow: "inset 3px 0 0 var(--color-straw)" } : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-parchment">{event.name}</span>
                <span className="rounded bg-ink/60 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-foam/70">
                  {event.category}
                </span>
                <span className="rounded bg-ink/60 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-foam/70">
                  {event.gender}
                </span>
                {event.verify && (
                  <span className="inline-flex items-center gap-1 rounded bg-sunset/20 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-sunset">
                    <Icon name="warning" size={11} /> verify
                  </span>
                )}
                {isDirty && (
                  <span className="ml-auto text-[0.6rem] font-bold uppercase tracking-wider text-straw">unsaved</span>
                )}
              </div>

              {event.note && <p className="mt-1 text-xs text-sunset/90">{event.note}</p>}

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <label className="block">
                  <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Medals</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    aria-label={`${event.name} medals at stake`}
                    value={value(event, "medalWeight")}
                    onChange={(e) => setField(event, "medalWeight", Number(e.target.value))}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">×Mult</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step="0.5"
                    aria-label={`${event.name} multiplier`}
                    value={value(event, "multiplier")}
                    onChange={(e) => setField(event, "multiplier", Number(e.target.value))}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Status</span>
                  <select
                    aria-label={`${event.name} status`}
                    value={value(event, "status")}
                    onChange={(e) => setField(event, "status", e.target.value as EventStatus)}
                    className={inputCls}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="finished">Finished</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Schedule</span>
                  <input
                    aria-label={`${event.name} schedule`}
                    placeholder="Day 2, 9:00 AM"
                    value={value(event, "schedule") ?? ""}
                    onChange={(e) => setField(event, "schedule", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Venue</span>
                  <input
                    aria-label={`${event.name} venue`}
                    placeholder="Gym"
                    value={value(event, "venue") ?? ""}
                    onChange={(e) => setField(event, "venue", e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Note</span>
                  <input
                    aria-label={`${event.name} note`}
                    placeholder="Optional note"
                    value={value(event, "note") ?? ""}
                    onChange={(e) => setField(event, "note", e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="mt-2 flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-parchment/85">
                  <input
                    type="checkbox"
                    className="size-6 shrink-0 accent-straw"
                    disabled={!canLock}
                    checked={Boolean(value(event, "locked"))}
                    onChange={(e) => setField(event, "locked", e.target.checked)}
                  />
                  <span className="inline-flex items-center gap-1">
                    <Icon name="lock" size={12} /> Locked
                  </span>
                  {!canLock && <span className="text-foam/50">(Secretariat only)</span>}
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-parchment/85">
                  <input
                    type="checkbox"
                    className="size-6 shrink-0 accent-straw"
                    checked={Boolean(value(event, "verify"))}
                    onChange={(e) => setField(event, "verify", e.target.checked)}
                  />
                  <span className="inline-flex items-center gap-1">
                    <Icon name="warning" size={12} /> Needs verification
                  </span>
                </label>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-sm italic text-foam/60">No events match that filter.</li>}
      </ul>

      {changedCount > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-straw/40 bg-ink/95 p-3 backdrop-blur">
          <span className="text-sm text-parchment">
            {changedCount} event{changedCount === 1 ? "" : "s"} changed
          </span>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setDirty({})}
            disabled={busy}
            className="rounded-lg border border-foam/25 px-4 py-2.5 text-sm text-parchment/85 hover:border-blood hover:text-blood disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
    </section>
  );
}
