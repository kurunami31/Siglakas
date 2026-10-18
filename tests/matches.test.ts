import { describe, expect, it } from "vitest";
import { classifyRound, matchEventPlacements, computeRoundRobin } from "@/lib/scoring/match";
import { ROUND_LABELS, isPoolLabel } from "@/lib/match-rounds";
import type { Match, MatchStatus } from "@/lib/types";

const m = (
  round: string,
  teamA: string,
  teamB: string,
  scoreA: number,
  scoreB: number,
  status: MatchStatus = "final",
  winner = "",
  id = `${round}-${teamA}-${teamB}`,
): Match => ({ id, eventId: "e1", round, teamA, teamB, scoreA, scoreB, winner, status });

describe("round classification", () => {
  /**
   * The original code used `round.includes("final")`, which is also true of
   * "Semifinal" — so a semifinal listed first crowned its winner champion.
   */
  it("never treats a semifinal or quarterfinal as the final", () => {
    expect(classifyRound("Semifinal")).toBe("other");
    expect(classifyRound("Semi-Final")).toBe("other");
    expect(classifyRound("Quarterfinal")).toBe("other");
    expect(classifyRound("Semifinal 2")).toBe("other");
  });

  it("recognises the finale in its common spellings", () => {
    for (const label of ["Final", "Finals", "Grand Final", "Championship", "Gold Medal Match", "1st place"]) {
      expect(classifyRound(label), label).toBe("final");
    }
  });

  it("recognises the bronze playoff", () => {
    for (const label of ["Bronze", "Bronze medal match", "3rd place", "Battle for Third"]) {
      expect(classifyRound(label), label).toBe("bronze");
    }
  });

  it("every label offered by the app is understood", () => {
    // Guards the shared ROUND_LABELS list: nothing the dropdown offers may fall
    // through to "other" except the pool label, which is handled separately.
    expect(classifyRound("Final")).toBe("final");
    expect(classifyRound("Bronze medal match")).toBe("bronze");
    expect(isPoolLabel("Round Robin")).toBe(true);
    expect(ROUND_LABELS).toHaveLength(5);
  });
});

describe("bracket placements", () => {
  it("takes 1st and 2nd from the final and 3rd from the bronze match", () => {
    const placements = matchEventPlacements([
      m("Semifinal", "a", "b", 2, 0),
      m("Semifinal", "c", "d", 0, 2),
      m("Bronze medal match", "b", "c", 2, 1),
      m("Final", "a", "d", 1, 2),
    ]);
    expect(placements).toEqual({ d: 1, a: 2, b: 3 });
  });

  it("derives the winner from the scores when winner is blank", () => {
    expect(matchEventPlacements([m("Final", "a", "b", 3, 0)])).toEqual({ a: 1, b: 2 });
  });

  it("awards nothing while the final is not final", () => {
    expect(matchEventPlacements([m("Final", "a", "b", 3, 0, "live")])).toEqual({});
  });

  it("never lets a bronze match displace a gold or silver", () => {
    // A mistyped bronze row naming the final's winner must not demote them.
    const placements = matchEventPlacements([m("Final", "a", "b", 3, 0), m("Bronze", "a", "b", 1, 0)]);
    expect(placements.a).toBe(1);
  });
});

describe("round-robin placements", () => {
  const pool = (status: MatchStatus = "final") => [
    m("Round Robin", "a", "b", 2, 0, status),
    m("Round Robin", "a", "c", 1, 0, status),
    m("Round Robin", "b", "c", 0, 2, status),
  ];

  it("decides the placings from a completed league", () => {
    // a: 2 wins; c: 1 win; b: 0 wins.
    expect(matchEventPlacements(pool())).toEqual({ a: 1, c: 2, b: 3 });
  });

  it("awards nothing until every pool fixture is played", () => {
    const partial = pool();
    partial[2] = m("Round Robin", "b", "c", 0, 0, "scheduled");
    expect(matchEventPlacements(partial)).toEqual({});
  });

  it("needs more than one fixture to be a league", () => {
    expect(matchEventPlacements([m("Round Robin", "a", "b", 2, 0)])).toEqual({});
  });

  it("a knockout final takes precedence over the pool table", () => {
    const placements = matchEventPlacements([...pool(), m("Final", "c", "a", 2, 0)]);
    expect(placements).toEqual({ c: 1, a: 2 });
  });

  it("never reads a semifinal as a league table", () => {
    // Two semifinals are "other" rounds but must not become a pool.
    expect(matchEventPlacements([m("Semifinal", "a", "b", 2, 0), m("Semifinal", "c", "d", 2, 0)])).toEqual({});
  });

  it("orders a tight league by point differential", () => {
    // a and b both win one; a's differential is better.
    const rows = computeRoundRobin([
      m("Round Robin", "a", "b", 2, 0),
      m("Round Robin", "b", "c", 2, 1),
      m("Round Robin", "a", "c", 1, 0),
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(["a", "b", "c"]);
  });
});
