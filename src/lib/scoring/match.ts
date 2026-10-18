import type { EventItem, Match, Result } from "../types";
import { isPoolLabel } from "../match-rounds";

export interface RoundRobinRow {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  /** sets/points for and against */
  forPoints: number;
  againstPoints: number;
  diff: number;
  rank: number;
}

export interface BracketSlot {
  round: string;
  matchId: string;
  teamA: string;
  teamB: string;
  winner: string;
  status: Match["status"];
  scoreA: number;
  scoreB: number;
}

/**
 * Round-robin standings for a single sport.
 * Ranking: wins desc, then point differential, then points-for.
 */
export function computeRoundRobin(matches: Match[]): RoundRobinRow[] {
  const table = new Map<string, RoundRobinRow>();
  const ensure = (teamId: string) => {
    if (!teamId) return null;
    let row = table.get(teamId);
    if (!row) {
      row = {
        teamId,
        played: 0,
        wins: 0,
        losses: 0,
        forPoints: 0,
        againstPoints: 0,
        diff: 0,
        rank: 0,
      };
      table.set(teamId, row);
    }
    return row;
  };

  for (const m of matches) {
    const a = ensure(m.teamA);
    const b = ensure(m.teamB);
    if (!a || !b) continue;
    if (m.status !== "final" && m.status !== "live") continue;

    a.played += 1;
    b.played += 1;
    a.forPoints += m.scoreA;
    a.againstPoints += m.scoreB;
    b.forPoints += m.scoreB;
    b.againstPoints += m.scoreA;

    const winner = m.winner || (m.scoreA > m.scoreB ? m.teamA : m.teamB);
    if (winner === m.teamA) {
      a.wins += 1;
      b.losses += 1;
    } else if (winner === m.teamB) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  const rows = [...table.values()].map((r) => ({
    ...r,
    diff: r.forPoints - r.againstPoints,
  }));

  rows.sort(
    (x, y) =>
      y.wins - x.wins || y.diff - x.diff || y.forPoints - x.forPoints || x.teamId.localeCompare(y.teamId),
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/**
 * Flatten matches into bracket rounds.
 * Rounds are ordered by their earliest appearance in the source data so that
 * "Round 1" appears before "Semifinal" as long as the sheet is ordered.
 */
export function buildBracket(matches: Match[]): BracketSlot[][] {
  const byRound = new Map<string, BracketSlot[]>();
  for (const m of matches) {
    const slot: BracketSlot = {
      round: m.round || "Round",
      matchId: m.id,
      teamA: m.teamA,
      teamB: m.teamB,
      winner: m.winner,
      status: m.status,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
    };
    const list = byRound.get(slot.round) ?? [];
    list.push(slot);
    byRound.set(slot.round, list);
  }
  return [...byRound.values()];
}

export type RoundKind = "final" | "bronze" | "other";

/** Round labels that mean "not the championship game" even if they mention a final. */
const EARLY_ROUND = /semi|quarter|elimination|roundrobin|pool|group|prelim|qualif|consolation2/;
/** Round labels that mean a bronze / third-place playoff. */
const BRONZE_ROUND = /bronze|thirdplace|3rdplace|battleforthird|battlefor3rd|consolation|lowerbracketfinal/;

/**
 * Classify the free-text Round column of the Matches sheet.
 *
 * The old code used `round.includes("final")`, which is also true for
 * "Semifinal" and "Quarterfinal" — so a semifinal listed first would crown its
 * winner champion. Anything ambiguous is deliberately treated as "other".
 */
export function classifyRound(round: string): RoundKind {
  const r = (round || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!r) return "other";
  if (BRONZE_ROUND.test(r)) return "bronze";
  if (EARLY_ROUND.test(r)) return "other";
  if (
    r === "final" ||
    r === "finals" ||
    r === "finalmatch" ||
    r === "finalround" ||
    r === "grandfinal" ||
    r === "grandfinals" ||
    r === "championship" ||
    r === "championshipmatch" ||
    r === "gold" ||
    r === "goldmedal" ||
    r === "goldmedalmatch" ||
    r === "1stplace"
  ) {
    return "final";
  }
  return "other";
}

function winnerOf(m: Match): string {
  if (m.winner) return m.winner;
  if (m.scoreA === m.scoreB) return "";
  return m.scoreA > m.scoreB ? m.teamA : m.teamB;
}

/**
 * Final placement per team from a completed bracket, per the SIGLAKAS manual:
 * the final decides 1st and 2nd, and the bronze-medal match decides 3rd.
 *
 * In double elimination the bracket-reset game (if forced) is played last, so
 * the last completed final is the decisive one.
 */
export function matchEventPlacements(matches: Match[]): Record<string, number> {
  const placements: Record<string, number> = {};
  const done = matches.filter((m) => m.status === "final");

  const finals = done.filter((m) => classifyRound(m.round) === "final");
  const final = finals[finals.length - 1];
  if (final) {
    const winner = winnerOf(final);
    const loser = winner === final.teamA ? final.teamB : final.teamA;
    if (winner) placements[winner] = 1;
    if (loser) placements[loser] = 2;
  }

  const bronze = done.filter((m) => classifyRound(m.round) === "bronze").pop();
  if (bronze) {
    const winner = winnerOf(bronze);
    // A bronze playoff must never overwrite a gold or silver placing.
    if (winner && placements[winner] === undefined) placements[winner] = 3;
  }

  // A league with no knockout final: the pool table itself decides the placings.
  // Three conditions, all deliberate:
  //   - only when there is no Final row, so a knockout event is never decided by
  //     its pool stage;
  //   - only from rounds explicitly marked as a pool (Round Robin / Pool /
  //     Group / League), because `classifyRound` lumps early knockout rounds
  //     into "other" and a semifinal must never be read as a league table;
  //   - only once EVERY pool fixture is final. A half-played league must not
  //     crown anyone, and two fixtures do not make a league.
  if (finals.length === 0) {
    const pool = matches.filter((m) => isPoolLabel(m.round));
    if (pool.length >= 2 && pool.every((m) => m.status === "final")) {
      for (const row of computeRoundRobin(pool)) {
        if (row.rank <= 3) placements[row.teamId] = row.rank;
      }
    }
  }

  return placements;
}

/**
 * Fold completed brackets into the result set so a team-sport event awards
 * medals on final placing without the PIO re-typing 1st/2nd/3rd by hand.
 *
 * A hand-entered result for the same event always wins, so nothing is counted
 * twice and the Secretariat keeps the final say (including declaring a tie).
 */
export function mergeMatchPlacements(
  results: Result[],
  events: EventItem[],
  matches: Match[],
): Result[] {
  const matchEvents = events.filter((e) => e.scoringType === "match");
  if (matchEvents.length === 0) return results;

  const handEntered = new Set(results.map((r) => r.eventId));
  const derived: Result[] = [];
  for (const e of matchEvents) {
    if (handEntered.has(e.id)) continue;
    const placements = matchEventPlacements(matches.filter((m) => m.eventId === e.id));
    for (const [teamId, placement] of Object.entries(placements)) {
      derived.push({
        eventId: e.id,
        teamId,
        placement,
        tie: false,
        status: "published",
        enteredBy: "bracket",
        timestamp: "",
      });
    }
  }
  return derived.length ? [...results, ...derived] : results;
}
