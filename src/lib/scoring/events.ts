import type {
  Config,
  EventItem,
  JudgeScore,
  Match,
  Result,
  Team,
} from "../types";
import { computeJudgedStandings, type TieBreak } from "./judged";
import { computeRoundRobin, buildBracket, mergeMatchPlacements, type BracketSlot, type RoundRobinRow } from "./match";
import { medalKindForPlacement, type MedalKind } from "./medals";
import { placementToPoints } from "./placement";

export interface EventResultRow {
  teamId: string;
  placement: number;
  points: number;
  medal: MedalKind | null;
  status: Result["status"];
  tie: boolean;
}

export interface EventSummary {
  event: EventItem;
  /** published + draft rows, ordered by placement */
  rows: EventResultRow[];
  isLive: boolean;
}

export function buildEventSummaries(
  events: EventItem[],
  results: Result[],
  config: Config,
): EventSummary[] {
  return events.map((event) => {
    const rows: EventResultRow[] = results
      .filter((r) => r.eventId === event.id)
      .map((r) => ({
        teamId: r.teamId,
        placement: r.placement,
        points: placementToPoints(r.placement, config.defaultPlacementTable, event.multiplier || 1),
        medal: medalKindForPlacement(r.placement),
        status: r.status,
        tie: r.tie,
      }))
      .sort((a, b) => a.placement - b.placement);
    return { event, rows, isLive: event.status === "live" };
  });
}

export interface EventDetail {
  event: EventItem;
  placementRows: EventResultRow[];
  roundRobin: RoundRobinRow[];
  bracket: BracketSlot[][];
  judged: ReturnType<typeof computeJudgedStandings>;
  hasJudgeScores: boolean;
}

export function buildEventDetail(
  event: EventItem,
  teams: Team[],
  results: Result[],
  matches: Match[],
  judgeScores: JudgeScore[],
  criteria: Parameters<typeof computeJudgedStandings>[2],
  tieBreak: TieBreak,
  config: Config,
): EventDetail {
  // A completed bracket feeds the placement rows too, so the event page shows
  // the medallists the moment the final (and bronze-medal match) is in.
  const placementRows = buildEventSummaries(
    [event],
    mergeMatchPlacements(results, [event], matches),
    config,
  )[0].rows;
  const eventMatches = matches.filter((m) => m.eventId === event.id);
  const hasJudgeScores = judgeScores.some((s) => s.eventId === event.id);
  return {
    event,
    placementRows,
    roundRobin: event.scoringType === "match" ? computeRoundRobin(eventMatches) : [],
    bracket: event.scoringType === "match" ? buildBracket(eventMatches) : [],
    judged:
      event.scoringType === "judged"
        ? computeJudgedStandings(event.id, teams, criteria, judgeScores, tieBreak)
        : [],
    hasJudgeScores,
  };
}

/** Draft + published results keyed for the admin inline editor. */
export function resultsForEvent(results: Result[], eventId: string): Result[] {
  return results.filter((r) => r.eventId === eventId);
}
