import type { PlacementTable } from "../types";

export const DEFAULT_PLACEMENT_TABLE: PlacementTable = {
  name: "default",
  places: { 1: 10, 2: 7, 3: 5, 4: 3 },
  participation: 1,
};

/** Highest placement we will ever score (12 crews + headroom). */
export const MAX_PLACEMENT = 30;

/**
 * Convert a placement into points using a (possibly sparse) table.
 *
 * Placement `0` means "participated but did not place".
 * Placements beyond the table fall through to the participation value,
 * unless an explicit entry exists (we allow up to MAX_PLACEMENT).
 */
export function placementToPoints(
  placement: number,
  table: PlacementTable = DEFAULT_PLACEMENT_TABLE,
  multiplier = 1,
): number {
  if (!Number.isFinite(placement) || placement < 0) return 0;
  const base =
    placement === 0
      ? table.participation
      : (table.places[placement] ?? table.participation);
  return round2(base * multiplier);
}

/**
 * Rank a list of {id, score} descending. Returns placement 1..n.
 * Equal scores share the SAME placement (competition ranking: 1,2,2,4).
 */
export function placementsFromScores<T extends { id: string; score: number }>(
  entries: T[],
): Array<T & { placement: number }> {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  let lastScore: number | null = null;
  let lastPlacement = 0;
  return sorted.map((e, i) => {
    const placement = lastScore !== null && e.score === lastScore ? lastPlacement : i + 1;
    lastScore = e.score;
    lastPlacement = placement;
    return { ...e, placement };
  });
}

/** Total points implied by a table, used for validation / previews. */
export function tableTotal(table: PlacementTable, teamCount: number): number {
  let total = table.participation * teamCount;
  for (const [place, pts] of Object.entries(table.places)) {
    const p = Number(place);
    if (p >= 1 && p <= teamCount) total += pts - table.participation;
  }
  return total;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
