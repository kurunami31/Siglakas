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
