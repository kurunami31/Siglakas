"use client";

import { useMemo, useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import type { Group, Team } from "@/lib/types";
import { Icon } from "@/components/icons";
import { TeamBadge } from "@/components/team-badge";

type Draft = Team;

/**
 * Crew editor. The mascot logos themselves are never recoloured or redrawn —
 * the bundled artwork stays in /public/logos and this screen only manages the
 * metadata around it (plus an optional hosted logo override).
 */
export function TeamAdmin() {
  const { state } = useLive();
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const teams = useMemo(
    () => [
      ...state.teams.map((t) => edits[t.id] ?? t),
      ...added.map((id) => edits[id]).filter(Boolean),
    ],
    [state.teams, edits, added],
  );

  const changed = useMemo(() => {
    return Object.keys(edits).filter((id) => {
      if (added.includes(id)) return true;
      const base = state.teams.find((t) => t.id === id);
      if (!base) return true;
      return JSON.stringify(base) !== JSON.stringify(edits[id]);
    });
  }, [edits, added, state.teams]);

  function patch(id: string, fields: Partial<Draft>) {
    setEdits((prev) => {
      const base =
        prev[id] ??
        state.teams.find((t) => t.id === id) ??
        ({
          id,
          name: "",
          shortName: "",
          group: "faculty" as Group,
          color: "#cccccc",
          logoFile: id,
          mascot: "",
        } as Draft);
      return { ...prev, [id]: { ...base, ...fields } };
    });
  }

  function addTeam() {
    let n = 1;
    while (state.teams.some((t) => t.id === `crew-${n}`) || added.includes(`crew-${n}`)) n++;
    const id = `crew-${n}`;
    setEdits((prev) => ({
      ...prev,
      [id]: { id, name: "", shortName: "", group: "faculty", color: "#7aa7d9", logoFile: id, mascot: "" },
    }));
    setAdded((prev) => [...prev, id]);
  }

  async function save() {
    const ids = changed.filter((id) => edits[id]);
    if (ids.length === 0) return;

    for (const id of ids) {
      const t = edits[id];
      if (!/^[a-z0-9_-]+$/.test(t.id)) {
        setMessage({ kind: "error", text: `${t.id}: id must be lowercase letters, numbers, dashes or underscores.` });
        return;
      }
      if (!t.name.trim() || !t.shortName.trim()) {
        setMessage({ kind: "error", text: `${t.id}: name and short name are required.` });
        return;
      }
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.color)) {
        setMessage({ kind: "error", text: `${t.shortName}: accent must be a hex colour like #e4c417.` });
        return;
      }
      if (t.logoUrl) {
        try {
          new URL(t.logoUrl);
        } catch {
          setMessage({ kind: "error", text: `${t.shortName}: the logo URL is not a valid URL.` });
          return;
        }
      }
    }

    setBusy(true);
    setMessage(null);
    const failed: string[] = [];
    for (const id of ids) {
      const t = edits[id];
      const payload: Draft = {
        ...t,
        name: t.name.trim(),
        shortName: t.shortName.trim().slice(0, 12),
        mascot: t.mascot.trim(),
        motto: t.motto?.trim() || undefined,
        logoUrl: t.logoUrl?.trim() || undefined,
      };
      const res = await postCommand({ type: "upsertTeam", team: payload });
      if (!res.ok) failed.push(`${t.shortName || id}: ${res.error}`);
    }
    setBusy(false);
    if (failed.length) {
      setMessage({ kind: "error", text: failed.slice(0, 3).join(" · ") });
      return;
    }
    setEdits({});
    setAdded([]);
    setMessage({ kind: "ok", text: `Saved ${ids.length} crew${ids.length === 1 ? "" : "s"}.` });
  }

  async function remove(team: Team) {
    if (!window.confirm(`Delete ${team.shortName}? Existing results for this crew are not removed.`)) return;
    setBusy(true);
    const res = await postCommand({ type: "deleteTeam", id: team.id });
    setBusy(false);
    if (!res.ok) setMessage({ kind: "error", text: res.error ?? "Delete failed" });
    else {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[team.id];
        return next;
      });
      setAdded((prev) => prev.filter((x) => x !== team.id));
      setMessage({ kind: "ok", text: `${team.shortName} deleted.` });
    }
  }

  const inputCls = "w-full rounded-lg border border-foam/25 bg-ink/60 px-2.5 py-2 text-sm text-parchment";

  return (
    <section className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
          <Icon name="flag" size={26} className="text-straw" /> Teams &amp; logos
        </h1>
        <button
          type="button"
          onClick={addTeam}
          className="rounded-lg border border-foam/25 px-3 py-2 text-sm hover:border-straw hover:text-straw"
        >
          + Add crew
        </button>
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

      <p className="text-xs text-foam/60">
        Mascot artwork is never recoloured or cropped. Bundled logos load from <code>/logos/&lt;id&gt;</code>; a hosted
        override (Supabase Storage) can be set per crew — it must be an allowed image host.
      </p>

      <ul className="grid gap-3 lg:grid-cols-2">
        {teams.map((team) => {
          const isDirty = changed.includes(team.id);
          return (
            <li key={team.id} className={`panel rounded-2xl p-3 ${isDirty ? "border-straw/60" : ""}`}>
              <div className="flex items-start gap-3">
                <TeamBadge team={team} size={56} shape="square" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Short name</span>
                      <input
                        aria-label={`${team.id} short name`}
                        value={team.shortName}
                        maxLength={12}
                        onChange={(e) => patch(team.id, { shortName: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Crew id</span>
                      <input
                        aria-label={`${team.id} id`}
                        value={team.id}
                        disabled={!added.includes(team.id)}
                        onChange={(e) => patch(team.id, { id: e.target.value.toLowerCase() })}
                        className={`${inputCls} font-mono disabled:opacity-60`}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Official name</span>
                    <input
                      aria-label={`${team.id} official name`}
                      value={team.name}
                      onChange={(e) => patch(team.id, { name: e.target.value })}
                      placeholder="Faculty of Business and Management"
                      className={inputCls}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Mascot</span>
                      <input
                        aria-label={`${team.id} mascot`}
                        value={team.mascot}
                        onChange={(e) => patch(team.id, { mascot: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Group</span>
                      <select
                        aria-label={`${team.id} group`}
                        value={team.group}
                        onChange={(e) => patch(team.id, { group: e.target.value as Group })}
                        className={inputCls}
                      >
                        <option value="faculty">Faculty</option>
                        <option value="extension_campus">Extension campus</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Accent</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={`${team.id} accent colour`}
                          value={team.color}
                          onChange={(e) => patch(team.id, { color: e.target.value })}
                          className="h-9 w-12 shrink-0 rounded border border-foam/25 bg-ink/60"
                        />
                        <input
                          aria-label={`${team.id} accent hex`}
                          value={team.color}
                          onChange={(e) => patch(team.id, { color: e.target.value })}
                          className={`${inputCls} font-mono`}
                        />
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">Motto</span>
                      <input
                        aria-label={`${team.id} motto`}
                        value={team.motto ?? ""}
                        onChange={(e) => patch(team.id, { motto: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[0.6rem] uppercase tracking-wider text-foam/60">
                      Logo override URL
                    </span>
                    <input
                      aria-label={`${team.id} logo URL`}
                      value={team.logoUrl ?? ""}
                      onChange={(e) => patch(team.id, { logoUrl: e.target.value })}
                      placeholder="/logos/fbm/256.webp (leave blank to use the bundled logo)"
                      className={`${inputCls} font-mono`}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                {isDirty && (
                  <span className="text-[0.6rem] font-bold uppercase tracking-wider text-straw">unsaved</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(team)}
                  disabled={busy}
                  className="ml-auto rounded-lg border border-foam/25 px-2.5 py-1.5 text-xs text-foam/70 hover:border-blood hover:text-blood disabled:opacity-50"
                >
                  Delete crew
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {changed.length > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-straw/40 bg-ink/95 p-3 backdrop-blur">
          <span className="text-sm text-parchment">
            {changed.length} crew{changed.length === 1 ? "" : "s"} changed
          </span>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save crews"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEdits({});
              setAdded([]);
            }}
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
