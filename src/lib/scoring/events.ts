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
  /**
   * Participation events only (FUN RUN, FUNEBALL). `count` is the headcount the
   * secretariat entered, `golds` is what the medal board will show — one gold
   * per participant, times the event weight. Placing-based fields stay empty:
   * there is no position to score.
   */
  count?: number;
  golds?: number;
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
    const participation = event.scoringType === "participation";
    const rows: EventResultRow[] = results
      .filter((r) => r.eventId === event.id)
      .map((r): EventResultRow => {
        /**
         * A participation event has no placing — `placement` is 0 and `count`
         * carries the headcount. Scoring it with the placement table (as every
         * other event is) printed a "0" and a participation point against each
         * crew while the medal board showed a pile of golds, so this mirrors
         * `buildStandings` exactly: golds = count x weight, and no points.
         */
        if (participation) {
          const count = r.count ?? 0;
          const golds = count * (event.medalWeight || 1);
          return {
            teamId: r.teamId,
            placement: 0,
            points: 0,
            medal: golds > 0 ? "gold" : null,
            status: r.status,
            tie: r.tie,
            count,
            golds,
          };
        }
        return {
          teamId: r.teamId,
          placement: r.placement,
          points: placementToPoints(r.placement, config.defaultPlacementTable, event.multiplier || 1),
          medal: medalKindForPlacement(r.placement),
          status: r.status,
          tie: r.tie,
        };
      })
      // Placings ascend. Participation rows all sit at 0, so break that tie on
      // headcount and let the biggest contributor read first.
      .sort((a, b) => a.placement - b.placement || (b.count ?? 0) - (a.count ?? 0));
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
        ? /**
           * Only teams the panel has actually scored, matching what the admin
           * judge screen shows (`judge-scores.tsx` skips `finalScore === 0`).
           * Without this the page ranked all twelve crews 1st to 12th off a
           * board of zeroes and handed the top three phantom
           * gold/silver/bronze icons — before a single score was entered.
           */
          computeJudgedStandings(event.id, teams, criteria, judgeScores, tieBreak).filter(
            (j) => j.finalScore > 0,
          )
        : [],
    hasJudgeScores,
  };
}

/** Draft + published results keyed for the admin inline editor. */
export function resultsForEvent(results: Result[], eventId: string): Result[] {
  return results.filter((r) => r.eventId === eventId);
}
