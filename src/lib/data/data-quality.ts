import type { EventItem, Result, Team } from "../types";

/**
 * Data-quality checks for the raw result rows.
 *
 * This exists because of the worst failure mode in the whole system: the scorer
 * resolves a result's `eventId` and `teamId` by lookup and simply skips the row
 * when either is unknown. A mistyped id therefore produces a score that appears
 * in the sheet, appears in the API, and counts for nothing — silently, with no
 * error anywhere. A duplicated placing is the same kind of quiet corruption.
 *
 * `check-sheet` runs the same checks from the command line; this module is the
 * shared implementation so the admin UI can show it live.
 */

export type IssueKind = "unknown_event" | "unknown_team" | "duplicate_placement";

export interface QualityIssue {
  kind: IssueKind;
  /** Human-readable, safe to render directly. */
  message: string;
  eventId?: string;
}

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function auditResults(events: EventItem[], teams: Team[], results: Result[]): QualityIssue[] {
  const eventIds = new Set(events.map((e) => e.id));
  const teamIds = new Set(teams.map((t) => t.id));

  const issues: QualityIssue[] = [];
  const unknownEvents = new Map<string, number>();
  const unknownTeams = new Map<string, number>();
  // eventId -> placement -> teamIds
  const places = new Map<string, Map<number, string[]>>();

  for (const r of results) {
    if (!eventIds.has(r.eventId)) {
      unknownEvents.set(r.eventId, (unknownEvents.get(r.eventId) ?? 0) + 1);
      continue;
    }
    if (!teamIds.has(r.teamId)) {
      unknownTeams.set(r.teamId, (unknownTeams.get(r.teamId) ?? 0) + 1);
      continue;
    }
    // Ties are legitimate; an untied placing used twice is not.
    if (r.placement >= 1 && !r.tie) {
      const byPlace = places.get(r.eventId) ?? new Map<number, string[]>();
      byPlace.set(r.placement, [...(byPlace.get(r.placement) ?? []), r.teamId]);
      places.set(r.eventId, byPlace);
    }
  }

  for (const [eventId, count] of unknownEvents) {
    issues.push({
      kind: "unknown_event",
      eventId,
      message: `${count} result row${count === 1 ? "" : "s"} reference event id "${eventId}", which is not in the Events tab`,
    });
  }
  for (const [teamId, count] of unknownTeams) {
    issues.push({
      kind: "unknown_team",
      message: `${count} result row${count === 1 ? "" : "s"} reference crew id "${teamId}", which is not in the Teams tab`,
    });
  }
  for (const [eventId, byPlace] of places) {
    for (const [place, ids] of byPlace) {
      if (ids.length > 1) {
        issues.push({
          kind: "duplicate_placement",
          eventId,
          message: `${ordinal(place)} place is used by ${ids.length} crews in "${eventId}" (${ids.join(", ")})`,
        });
      }
    }
  }

  return issues;
}

/** One line for a banner. Returns null when there is nothing to report. */
export function summariseIssues(issues: QualityIssue[]): string | null {
  if (issues.length === 0) return null;
  const bad = issues.filter((i) => i.kind !== "duplicate_placement").length;
  const dupes = issues.length - bad;
  const parts: string[] = [];
  if (bad) parts.push(`${bad} result row${bad === 1 ? "" : "s"} cannot be matched to an event or crew`);
  if (dupes) parts.push(`${dupes} duplicated placing${dupes === 1 ? "" : "s"}`);
  return `${parts.join(", and ")} — these score nothing until fixed.`;
}
