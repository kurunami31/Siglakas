/**
 * The round labels the scorer recognises.
 *
 * Kept in one place so the sheet's dropdown, the admin form and the bulk-paste
 * parser cannot drift apart. This matters more than it looks: a round the
 * scorer does not recognise crowns nobody, so a fixture entered as "Semi-Final"
 * on a league sheet would silently award no medals.
 *
 * `Final` decides 1st and 2nd; `Bronze medal match` decides 3rd. The others feed
 * the bracket view and the pool table.
 */
export const ROUND_LABELS = [
  "Round Robin",
  "Quarterfinal",
  "Semifinal",
  "Final",
  "Bronze medal match",
] as const;

export type RoundLabel = (typeof ROUND_LABELS)[number];

/** True for the labels that mean "league stage" rather than a knockout round. */
export function isPoolLabel(round: string): boolean {
  return /roundrobin|pool|group|league/.test((round || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
}
