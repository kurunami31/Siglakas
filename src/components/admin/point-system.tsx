"use client";

import { useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import { formatBounty } from "@/lib/format";
import type { ChampionshipRankBy, Config } from "@/lib/types";
import { Icon, MedalIcon } from "@/components/icons";

interface FormState {
  competitionName: string;
  schoolName: string;
  subtitle: string;
  championshipRankBy: ChampionshipRankBy;
  terminology: "onepiece" | "plain";
  pointsFreeze: boolean;
  revealMode: boolean;
  maintenance: boolean;
  gold: number;
  silver: number;
  bronze: number;
  participation: number;
  places: Record<number, number>;
}

function fromConfig(c: Config): FormState {
  return {
    competitionName: c.competitionName,
    schoolName: c.schoolName,
    subtitle: c.subtitle,
    championshipRankBy: c.championshipRankBy,
    terminology: c.terminology,
    pointsFreeze: c.pointsFreeze,
    revealMode: c.revealMode,
    maintenance: c.maintenance,
    gold: c.medalPoints.gold,
    silver: c.medalPoints.silver,
    bronze: c.medalPoints.bronze,
    participation: c.defaultPlacementTable.participation,
    places: { ...c.defaultPlacementTable.places },
  };
}

/**
 * Competition settings + the point system. Because the sheet stores the
 * placement table as `placement_1..4` plus `participation`, only those rows are
 * editable here — but any deeper placements already in the sheet are preserved.
 */
export function PointSystem() {
  const { state } = useLive();
  const [form, setForm] = useState<FormState>(() => fromConfig(state.config));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await postCommand({
      type: "updateConfig",
      patch: {
        competitionName: form.competitionName.trim(),
        schoolName: form.schoolName.trim(),
        subtitle: form.subtitle.trim(),
        championshipRankBy: form.championshipRankBy,
        terminology: form.terminology,
        pointsFreeze: form.pointsFreeze,
        revealMode: form.revealMode,
        maintenance: form.maintenance,
        medalPoints: {
          gold: Number(form.gold) || 0,
          silver: Number(form.silver) || 0,
          bronze: Number(form.bronze) || 0,
        },
        defaultPlacementTable: {
          ...state.config.defaultPlacementTable,
          participation: Number(form.participation) || 0,
          places: {
            ...state.config.defaultPlacementTable.places,
            1: Number(form.places[1]) || 0,
            2: Number(form.places[2]) || 0,
            3: Number(form.places[3]) || 0,
            4: Number(form.places[4]) || 0,
          },
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "error", text: res.error ?? "Save failed" });
      return;
    }
    setMessage({ kind: "ok", text: "Settings saved." });
  }

  const inputCls = "w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment";

  return (
    <section className="space-y-4">
      <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="gear" size={26} className="text-straw" /> Point system
      </h1>

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

      <div className="panel space-y-3 rounded-2xl p-4">
        <h2 className="font-display text-xl text-parchment">Competition</h2>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Competition name</span>
          <input
            value={form.competitionName}
            onChange={(e) => set("competitionName", e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">School name</span>
          <input value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">
            Site subtitle (shown in the header)
          </span>
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Overall champion decided by</span>
            <select
              value={form.championshipRankBy}
              onChange={(e) => set("championshipRankBy", e.target.value as ChampionshipRankBy)}
              className={inputCls}
            >
              <option value="total_medals">Most total medals (tie-break: golds, then silvers)</option>
              <option value="gold_first">Most golds first</option>
              <option value="weighted_points">Weighted points</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Terminology</span>
            <select
              value={form.terminology}
              onChange={(e) => set("terminology", e.target.value as "onepiece" | "plain")}
              className={inputCls}
            >
              <option value="onepiece">Pirate (Bounty Board, Islands, Crews)</option>
              <option value="plain">Plain (Leaderboard, Events, Teams)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panel space-y-3 rounded-2xl p-4">
        <h2 className="font-display text-xl text-parchment">Medal points</h2>
        <p className="text-xs text-foam/60">
          Used when the champion is decided by weighted points. Medals themselves are counted as physical medals.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["gold", "Gold"],
              ["silver", "Silver"],
              ["bronze", "Bronze"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-foam/70">
                <MedalIcon kind={key} size={14} /> {label}
              </span>
              <input
                type="number"
                min={0}
                value={form[key]}
                onChange={(e) => set(key, Number(e.target.value))}
                className={inputCls}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel space-y-3 rounded-2xl p-4">
        <h2 className="font-display text-xl text-parchment">Placement points</h2>
        <p className="text-xs text-foam/60">
          1st place in a placement event earns {form.places[1] ?? 0} points ·{" "}
          {formatBounty(form.places[1] ?? 0)} bounty.
        </p>
        <div className="grid gap-3 sm:grid-cols-5">
          {[1, 2, 3, 4].map((p) => (
            <label key={p} className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">
                {p === 1 ? "1st" : p === 2 ? "2nd" : p === 3 ? "3rd" : "4th"}
              </span>
              <input
                type="number"
                min={0}
                value={form.places[p] ?? 0}
                onChange={(e) => set("places", { ...form.places, [p]: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Participation</span>
            <input
              type="number"
              min={0}
              value={form.participation}
              onChange={(e) => set("participation", Number(e.target.value))}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div className="panel space-y-3 rounded-2xl p-4">
        <h2 className="font-display flex items-center gap-2 text-xl text-parchment">
          <Icon name="lock" size={18} className="text-straw" /> Suspense
        </h2>
        <label className="flex items-start gap-2.5 text-sm text-parchment/90">
          <input
            type="checkbox"
            className="mt-1 size-6 shrink-0 accent-straw"
            checked={form.pointsFreeze}
            onChange={(e) => set("pointsFreeze", e.target.checked)}
          />
          <span>
            <strong>Freeze the public board.</strong> Standings are hidden from viewers until the reveal — useful for a
            closing-ceremony announcement.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-parchment/90">
          <input
            type="checkbox"
            className="mt-1 size-6 shrink-0 accent-straw"
            checked={form.revealMode}
            onChange={(e) => set("revealMode", e.target.checked)}
          />
          <span>
            <strong>Dramatic reveal.</strong> Play the treasure-chest reveal animation when the freeze lifts.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-parchment/90">
          <input
            type="checkbox"
            className="mt-1 size-6 shrink-0 accent-straw"
            checked={form.maintenance}
            onChange={(e) => set("maintenance", e.target.checked)}
          />
          <span>
            <strong>Close the board (maintenance).</strong> Every page and both live feeds are hidden from viewers
            behind a holding screen, so results can be corrected in private. Signed-in crew still see the real
            board — which is how you check the fix.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(fromConfig(state.config));
            setMessage(null);
          }}
          disabled={busy}
          className="rounded-lg border border-foam/25 px-4 py-2.5 text-sm text-parchment/85 hover:border-straw hover:text-straw disabled:opacity-50"
        >
          Reset to saved
        </button>
      </div>
    </section>
  );
}
