import { buildStandings } from "../scoring/rank";
import { mergeMatchPlacements } from "../scoring/match";
import { DEFAULT_CONFIG } from "./seed";
import type { CompetitionState, Config, RawSheets } from "../types";

/** Cheap, dependency-free, deterministic content hash (FNV-1a 32-bit). */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export interface DeriveOptions {
  /** previous overall ranks for the up/down arrows */
  previousRanks?: Record<string, number>;
}

/**
 * Turn raw sheet data into the single, fully-derived state object that both the
 * API and the UI consume. Pure + deterministic so it can be diffed by hash.
 */
export function deriveState(raw: RawSheets, options: DeriveOptions = {}): CompetitionState {
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...sanitizeConfig(raw.config),
  };

  const standings = buildStandings({
    teams: raw.teams,
    events: raw.events,
    // Completed brackets award 1st/2nd/3rd automatically (final + bronze-medal
    // match). Hand-entered results always take precedence.
    results: mergeMatchPlacements(raw.results, raw.events, raw.matches),
    config,
    onlyPublished: true,
    previousRanks: options.previousRanks,
  });

  const versionSource = JSON.stringify({
    t: raw.teams,
    e: raw.events.map((e) => [e.id, e.status, e.locked, e.multiplier, e.medalWeight]),
    r: raw.results,
    m: raw.matches,
    j: raw.judgeScores.length,
    c: raw.announcements.length,
    g: [config.championshipRankBy, config.pointsFreeze, config.revealMode, config.terminology, config.competitionName],
  });

  return {
    config,
    teams: raw.teams,
    events: raw.events,
    criteria: raw.criteria,
    matches: raw.matches,
    results: raw.results,
    announcements: raw.announcements,
    userCount: raw.users.length,
    standings,
    lastUpdated: new Date().toISOString(),
    version: hashString(versionSource),
  };
}

function sanitizeConfig(input: Record<string, unknown>): Partial<Config> {
  const out: Partial<Config> = {};
  if (typeof input.competitionName === "string") out.competitionName = input.competitionName;
  if (typeof input.schoolName === "string") out.schoolName = input.schoolName;
  if (typeof input.subtitle === "string") out.subtitle = input.subtitle;
  if (input.championshipRankBy === "total_medals" || input.championshipRankBy === "gold_first" || input.championshipRankBy === "weighted_points") {
    out.championshipRankBy = input.championshipRankBy;
  }
  if (input.terminology === "onepiece" || input.terminology === "plain") out.terminology = input.terminology;
  if (typeof input.pointsFreeze === "boolean") out.pointsFreeze = input.pointsFreeze;
  if (typeof input.revealMode === "boolean") out.revealMode = input.revealMode;
  if (typeof input.medalPoints === "object" && input.medalPoints) {
    const mp = input.medalPoints as Record<string, unknown>;
    out.medalPoints = {
      gold: num(mp.gold, DEFAULT_CONFIG.medalPoints.gold),
      silver: num(mp.silver, DEFAULT_CONFIG.medalPoints.silver),
      bronze: num(mp.bronze, DEFAULT_CONFIG.medalPoints.bronze),
    };
  }
  return out;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
