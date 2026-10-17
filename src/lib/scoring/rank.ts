import {
  addBreakdown,
  emptyBreakdown,
  type Config,
  type DivisionOrOverall,
  type EventItem,
  type Group,
  type Result,
  type ScoreBreakdown,
  type Team,
  type TeamStanding,
} from "../types";
import { compareBreakdowns, medalKindForPlacement } from "./medals";
import { placementToPoints } from "./placement";

export interface BuildStandingsInput {
  teams: Team[];
  events: EventItem[];
  results: Result[];
  config: Config;
  /** when false, drafts are included too (admin preview only) */
  onlyPublished: boolean;
  /** previous overall ranks, for the up/down arrows */
  previousRanks?: Record<string, number>;
  /** previous per-division ranks */
  previousDivisionRanks?: Record<string, Record<DivisionOrOverall, number>>;
}

/**
 * Aggregate every published result into per-division score breakdowns and rank
 * each division independently. Ranking is always computed across ALL teams;
 * the group filter only hides rows downstream.
 */
export function buildStandings(input: BuildStandingsInput): TeamStanding[] {
  const { teams, events, results, config, onlyPublished, previousRanks } = input;
  const eventById = new Map(events.map((e) => [e.id, e]));

  const acc = new Map<
    string,
    { overall: ScoreBreakdown; sports: ScoreBreakdown; cultural: ScoreBreakdown }
  >();
  for (const t of teams) {
    acc.set(t.id, {
      overall: emptyBreakdown(),
      sports: emptyBreakdown(),
      cultural: emptyBreakdown(),
    });
  }

  for (const r of results) {
    if (onlyPublished && r.status !== "published") continue;
    const event = eventById.get(r.eventId);
    if (!event) continue;
    const bucket = acc.get(r.teamId);
    if (!bucket) continue;

    const multiplier = event.multiplier || 1;
    const points = placementToPoints(r.placement, config.defaultPlacementTable, multiplier);
    const medal = medalKindForPlacement(r.placement);
    const weight = event.medalWeight; // medals are physical counts → no multiplier

    const applyTo = (b: ScoreBreakdown) => {
      const next = { ...b, points: round2(b.points + points) };
      if (medal === "gold") next.gold += weight;
      if (medal === "silver") next.silver += weight;
      if (medal === "bronze") next.bronze += weight;
      next.totalMedals = next.gold + next.silver + next.bronze;
      next.medalPoints = round2(
        next.gold * config.medalPoints.gold +
          next.silver * config.medalPoints.silver +
          next.bronze * config.medalPoints.bronze,
      );
      return next;
    };

    bucket.overall = applyTo(bucket.overall);
    if (event.division === "sports") bucket.sports = applyTo(bucket.sports);
    else bucket.cultural = applyTo(bucket.cultural);
  }

  const divisions: DivisionOrOverall[] = ["overall", "sports", "cultural"];
  const rankMaps: Record<DivisionOrOverall, Map<string, number>> = {
    overall: new Map(),
    sports: new Map(),
    cultural: new Map(),
  };

  for (const division of divisions) {
    const rows = [...acc.entries()].map(([teamId, b]) => ({
      teamId,
      breakdown: b[division],
    }));
    rows.sort(
      (x, y) =>
        compareBreakdowns(x.breakdown, y.breakdown, config.championshipRankBy) ||
        x.teamId.localeCompare(y.teamId),
    );
    let lastKey = "";
    let lastRank = 0;
    rows.forEach((row, i) => {
      const key = rankKey(row.breakdown);
      const rank = key === lastKey ? lastRank : i + 1;
      lastKey = key;
      lastRank = rank;
      rankMaps[division].set(row.teamId, rank);
    });
  }

  return teams.map((t) => {
    const bucket = acc.get(t.id)!;
    const prevRank = previousRanks?.[t.id] ?? null;
    const rank = rankMaps.overall.get(t.id) ?? teams.length;
    return {
      teamId: t.id,
      overall: bucket.overall,
      sports: bucket.sports,
      cultural: bucket.cultural,
      ranks: {
        overall: rank,
        sports: rankMaps.sports.get(t.id) ?? teams.length,
        cultural: rankMaps.cultural.get(t.id) ?? teams.length,
      },
      prevRank,
      rankChange: prevRank === null ? 0 : prevRank - rank,
    };
  });
}

/** Balance-aligned leaderboard / medal-tally ordering. */
export function sortStandings(
  standings: TeamStanding[],
  division: DivisionOrOverall,
): TeamStanding[] {
  return [...standings].sort(
    (a, b) => a.ranks[division] - b.ranks[division] || a.teamId.localeCompare(b.teamId),
  );
}

/**
 * The public group filter. Ranks are preserved — this only drops rows.
 */
export function applyGroupFilter<T extends { teamId: string }>(
  rows: T[],
  teams: Team[],
  group: Group | "all",
): T[] {
  if (group === "all") return rows;
  const allowed = new Set(teams.filter((t) => t.group === group).map((t) => t.id));
  return rows.filter((r) => allowed.has(r.teamId));
}

/** Medal-tally row shaped for the medal table UI. */
export interface MedalRow {
  teamId: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  rank: number;
  rankChange: number;
}

export function buildMedalTable(
  standings: TeamStanding[],
  division: DivisionOrOverall = "overall",
): MedalRow[] {
  return [...standings]
    .map((s) => {
      const b = s[division];
      return {
        teamId: s.teamId,
        gold: b.gold,
        silver: b.silver,
        bronze: b.bronze,
        total: b.totalMedals,
        rank: s.ranks[division],
        rankChange: s.rankChange,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

function rankKey(b: ScoreBreakdown): string {
  return `${b.totalMedals}|${b.gold}|${b.silver}|${b.bronze}|${b.medalPoints}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { addBreakdown };
