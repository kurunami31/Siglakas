"use client";

import { Leaderboard } from "@/components/leaderboard";
import { SealedBoard } from "@/components/effects";
import { useLive } from "@/components/providers";
import { CrewParade } from "@/components/crew-parade";
import { terms } from "@/lib/terminology";
import { sortStandings } from "@/lib/scoring/rank";
import { Ticker } from "@/components/ticker";
import { Icon, MedalIcon, type IconName } from "@/components/icons";

export function HomeView() {
  const { state } = useLive();
  const t = terms(state.config);
  const top = sortStandings(state.standings, "overall").slice(0, 3);
  const colors = state.teams.map((x) => x.color);

  return (
    <div className="space-y-6">
      <CrewParade teams={state.teams} />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Islands" value={state.events.length} icon="map" />
        <StatCard label="Medals at stake" value={state.events.reduce((s, e) => s + e.medalWeight, 0) * 3} icon="medal" />
        <StatCard label="Crews" value={state.teams.length} icon="flag" />
      </section>

      <SealedBoard sealed={state.config.pointsFreeze} teams={top.map((s) => state.teams.find((t2) => t2.id === s.teamId)!)} colors={colors}>
        <Leaderboard state={state} />
      </SealedBoard>

      <section aria-labelledby="feed-h" className="panel rounded-2xl p-4">
        <h2 id="feed-h" className="font-display mb-2 flex items-center gap-2 text-2xl text-parchment">
          <Icon name="signal" size={22} className="text-straw" /> Live activity feed
        </h2>
        <Ticker />
        <ul className="mt-3 space-y-1.5">
          {state.results
            .filter((r) => r.status === "published")
            .slice(-8)
            .reverse()
            .map((r, i) => {
              const team = state.teams.find((x) => x.id === r.teamId);
              const event = state.events.find((x) => x.id === r.eventId);
              if (!team || !event) return null;
              return (
                <li key={`${r.eventId}-${r.teamId}-${i}`} className="flex items-center gap-2 rounded-lg border border-foam/10 bg-ink/40 px-2.5 py-1.5 text-sm">
                  {r.placement >= 1 && r.placement <= 3 ? (
                    <MedalIcon
                      kind={r.placement === 1 ? "gold" : r.placement === 2 ? "silver" : "bronze"}
                      size={16}
                    />
                  ) : (
                    <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-foam/40" />
                  )}
                  <span className="min-w-0 truncate">
                    <strong className="text-parchment">{team.shortName}</strong>{" "}
                    <span className="text-foam/80">
                      {r.placement === 1 ? "took 1st" : r.placement === 2 ? "took 2nd" : r.placement === 3 ? "took 3rd" : "competed"} in {event.name}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-straw">+{event.medalWeight} medals</span>
                </li>
              );
            })}
          {state.results.filter((r) => r.status === "published").length === 0 && (
            <li className="text-sm italic text-foam/60">No results yet — the {t.events.toLowerCase()} are about to begin.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: IconName }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-center">
      <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-widest text-foam/70">
        <Icon name={icon} size={13} />
        {label}
      </p>
      <p className="font-display text-2xl leading-none text-straw">{value.toLocaleString()}</p>
    </div>
  );
}
