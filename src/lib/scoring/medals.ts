import type { Config, ScoreBreakdown } from "../types";

export type MedalKind = "gold" | "silver" | "bronze";

export function medalKindForPlacement(placement: number): MedalKind | null {
  if (placement === 1) return "gold";
  if (placement === 2) return "silver";
  if (placement === 3) return "bronze";
  return null;
}

export const MEDAL_LABEL: Record<MedalKind, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function medalPoints(breakdown: ScoreBreakdown, config: Config): number {
  const { gold, silver, bronze } = config.medalPoints;
  return round2(
    breakdown.gold * gold + breakdown.silver * silver + breakdown.bronze * bronze,
  );
}

/**
 * Rank comparator used by every standings view.
 *
 * - total_medals  : most medals wins; ties broken by gold, then silver, then bronze
 * - gold_first    : classic medal table (gold, then silver, then bronze)
 * - weighted_points: gold/silver/bronze converted with Config.medalPoints
 */
export function compareBreakdowns(
  a: ScoreBreakdown,
  b: ScoreBreakdown,
  mode: Config["championshipRankBy"],
): number {
  switch (mode) {
    case "gold_first":
      return b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze;
    case "weighted_points":
      return b.medalPoints - a.medalPoints || b.gold - a.gold || b.silver - a.silver;
    case "total_medals":
    default:
      return (
        b.totalMedals - a.totalMedals || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze
      );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A one-line description of how the standings are ordered, derived from the
 * configured mode.
 *
 * The medal table used to hard-code "total medals → golds → silvers" while the
 * config said `gold_first`, so the page described a rule it was not following —
 * and the board visibly contradicted its own heading. Deriving it from the
 * config means the sentence cannot drift away from the behaviour again.
 */
export function rankingRuleLabel(config: Config): string {
  switch (config.championshipRankBy) {
    case "weighted_points": {
      const { gold, silver, bronze } = config.medalPoints;
      return `Ranked by weighted points (gold ${gold} · silver ${silver} · bronze ${bronze})`;
    }
    case "total_medals":
      return "Ranked by total medals → golds → silvers";
    case "gold_first":
    default:
      return "Ranked by golds → silvers → bronzes";
  }
}
