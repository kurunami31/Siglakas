import { describe, expect, it } from "vitest";
import { EVENTS, TEAMS, buildCriteria } from "@/lib/data/seed";
import { deriveState } from "@/lib/data/derive";
import type { Criterion, RawSheets, Result } from "@/lib/types";

/**
 * The Saludo and the Mascot are the first SIGLAKAS 2026 competitions with final
 * results, and the two tallies diverge from how the app scores a judged event —
 * so the figures below are transcribed from the official sheets and the rubric
 * the Secretariat supplied.
 *
 * The ranking order is deliberately NOT hard-coded. It is recomputed here from
 * the raw numbers each sheet records, using the method that sheet documents, and
 * then compared against what `scripts/record-saludo-mascot.ts` entered. That way
 * a mistyped placement in the script fails this test rather than quietly
 * awarding the wrong crew a medal.
 */

/** Official draw: entry number -> crew id. Supplied by the Secretariat. */
const ENTRY: Record<number, string> = {
  1: "fahuscic",
  2: "tec",
  3: "fbm",
  4: "cec",
  5: "fals",
  6: "bec",
  7: "bgec",
  8: "fcje",
  9: "fnahs",
  10: "fted",
  11: "siec",
  12: "facet",
};

/**
 * SALUDO — three judges score out of 100; the mean becomes TOTAL and then a
 * "TOTAL WITH DEDUCTIONS" decides it. Highest wins; ties share a rank.
 */
const SALUDO_WITH_DEDUCTIONS = [
  76.33333333, 84.33333333, 92.44444444, 68, 90, 81.66666667, 79.66666667, 80, 94.61111111, 84.55555556,
  79.66666667, 82.05555556,
];

/**
 * MASCOT — the blank judge sheet scores the five criteria out of 100, but this
 * overall tally records, per judge, the entry's RANK. TOTAL is the sum of those
 * ranks and the LOWEST wins; ties share a rank. Summing ranks is not something
 * `computeJudgedStandings` can express, so the mascot is recorded as a final
 * placement rather than scored in the app.
 */
const MASCOT_JUDGE_RANKS = [
  [2, 6, 6],
  [7, 4, 4],
  [1, 1, 1],
  [9, 9, 6],
  [8, 8, 4],
  [2, 3, 3],
  [5, 7, 3],
  [3, 2, 2],
  [3, 4, 5],
  [4, 4, 7],
  [3, 5, 7],
  [6, 8, 5],
];

/** What the script actually writes, as [entry, placement, tie]. */
const SALUDO_RECORDED: Array<[number, number, boolean]> = [
  [1, 11, false],
  [2, 5, false],
  [3, 2, false],
  [4, 12, false],
  [5, 3, false],
  [6, 7, false],
  [7, 9, true],
  [8, 8, false],
  [9, 1, false],
  [10, 4, false],
  [11, 9, true],
  [12, 6, false],
];

const MASCOT_RECORDED: Array<[number, number, boolean]> = [
  [1, 5, false],
  [2, 6, true],
  [3, 1, false],
  [4, 12, false],
  [5, 11, false],
  [6, 3, false],
  [7, 6, true],
  [8, 2, false],
  [9, 4, false],
  [10, 6, true],
  [11, 6, true],
  [12, 10, false],
];

/**
 * Competition ranks: equal values share the best of their positions, and the
 * next distinct value takes the position after the whole tie group.
 */
function competitionRanks(values: number[], higherWins: boolean): number[] {
  const order = [...values.keys()].sort((a, b) => (higherWins ? values[b] - values[a] : values[a] - values[b]));
  const ranks = new Array<number>(values.length).fill(0);
  let lastValue: number | null = null;
  let lastRank = 0;
  order.forEach((idx, i) => {
    const rank = lastValue !== null && values[idx] === lastValue ? lastRank : i + 1;
    ranks[idx] = rank;
    lastValue = values[idx];
    lastRank = rank;
  });
  return ranks;
}

describe("official Saludo + Mascot results", () => {
  it("derives the Saludo order from the tally's own scores", () => {
    const expected = competitionRanks(SALUDO_WITH_DEDUCTIONS, true);
    expect(SALUDO_RECORDED.map(([, placement]) => placement)).toEqual(expected);
  });

  it("derives the Mascot order from the judges' ranks, lowest first", () => {
    const totals = MASCOT_JUDGE_RANKS.map((r) => r.reduce((a, b) => a + b, 0));
    const expected = competitionRanks(totals, false);
    expect(MASCOT_RECORDED.map(([, placement]) => placement)).toEqual(expected);
  });

  it("marks a tie on exactly the entries that share a rank", () => {
    // Entry numbers are only meaningful inside their own tally — entry 2 is
    // untied in the Saludo and tied in the Mascot — so each draw is checked
    // separately rather than pooled.
    const tidal = (rows: Array<[number, number, boolean]>) => {
      const counts = new Map<number, number>();
      for (const [, p] of rows) counts.set(p, (counts.get(p) ?? 0) + 1);
      return rows.filter(([, p]) => (counts.get(p) ?? 0) > 1).map(([e]) => e);
    };
    const check = (rows: Array<[number, number, boolean]>) => {
      const tied = new Set(tidal(rows));
      for (const [entry, , tie] of rows) {
        expect(tie, `entry ${entry}`).toBe(tied.has(entry));
      }
    };

    expect(tidal(SALUDO_RECORDED)).toEqual([7, 11]);
    expect(tidal(MASCOT_RECORDED)).toEqual([2, 7, 10, 11]);
    check(SALUDO_RECORDED);
    check(MASCOT_RECORDED);
  });

  it("maps every entry number to a distinct crew, in both draws", () => {
    expect(Object.keys(ENTRY)).toHaveLength(12);
    expect(new Set(Object.values(ENTRY)).size).toBe(12);
    expect(new Set(SALUDO_RECORDED.map(([e]) => e)).size).toBe(12);
    expect(new Set(MASCOT_RECORDED.map(([e]) => e)).size).toBe(12);
    // Both tallies are the full field: every crew appears exactly once each.
    const field = [...TEAMS.map((t) => t.id)].sort();
    expect(SALUDO_RECORDED.map(([e]) => ENTRY[e]).sort()).toEqual(field);
    expect(MASCOT_RECORDED.map(([e]) => ENTRY[e]).sort()).toEqual(field);
  });
});

describe("Saludo event and both rubrics", () => {
  const criteria = buildCriteria(EVENTS);
  const weights = (eventId: string) => criteria.filter((c) => c.eventId === eventId);

  it("has the Saludo as its own event, not Cheer Dance", () => {
    const saludo = EVENTS.find((e) => e.id === "saludo");
    expect(saludo).toBeDefined();
    expect(saludo!.name).toBe("Saludo");
    expect(saludo!.division).toBe("cultural");
    expect(saludo!.category).toBe("Special Category");
    expect(saludo!.scoringType).toBe("judged");
    expect(saludo!.medalWeight).toBe(2);
    expect(saludo!.id).not.toBe("cheer-dance");
  });

  it("scores the Saludo on the rubric the Secretariat supplied", () => {
    expect(weights("saludo").map((c) => [c.criterion, c.weight])).toEqual([
      ["Execution & Synchronization", 35],
      ["Energy and Showmanship", 30],
      ["Creativity & Choreography", 25],
      ["Overall Impact", 10],
    ]);
  });

  it("scores the Mascot on the manual's table, not the pageant's", () => {
    expect(weights("mascot").map((c) => [c.criterion, c.weight])).toEqual([
      ["Creativity and Design", 30],
      ["Performance and Animation", 25],
      ["Characterization", 20],
      ["Audience Impact", 15],
      ["Overall Execution", 10],
    ]);
    // The Ginoong/Hiyas rubric it used to inherit — a mascot has no interview.
    const names = weights("mascot").map((c) => c.criterion);
    expect(names).not.toContain("Interview");
    expect(names).not.toContain("Poise & Presence");
    expect(names).not.toContain("Cultural Attire");
  });

  it("still sums every judged event's rubric to 100", () => {
    for (const event of EVENTS.filter((e) => e.scoringType === "judged")) {
      const sum = weights(event.id).reduce((s, c) => s + c.weight, 0);
      expect(sum, `${event.id} criteria`).toBe(100);
    }
  });
});

describe("what the two results put on the medal board", () => {
  const raw = (): RawSheets => {
    const events = EVENTS.filter((e) => e.id === "saludo" || e.id === "mascot");
    const results: Result[] = [];
    for (const [placements, eventId] of [
      [SALUDO_RECORDED, "saludo"],
      [MASCOT_RECORDED, "mascot"],
    ] as const) {
      for (const [entry, placement, tie] of placements) {
        results.push({
          eventId,
          teamId: ENTRY[entry],
          placement,
          tie,
          status: "published",
          enteredBy: "record-saludo-mascot",
          timestamp: "2026-10-20T00:00:00.000Z",
        });
      }
    }
    return {
      config: {},
      teams: TEAMS.map((t) => ({ ...t })),
      events: events.map((e) => ({ ...e, status: "finished" as const })),
      criteria: buildCriteria(events) as Criterion[],
      matches: [],
      judgeScores: [],
      results,
      announcements: [],
      auditLog: [],
      users: [],
    } as unknown as RawSheets;
  };

  const medals = (teamId: string) => {
    const standing = deriveState(raw()).standings.find((s) => s.teamId === teamId);
    return standing ? standing.overall : null;
  };

  it("awards saludo 2 medals per placing and mascot 3", () => {
    // Saludo (weight 2): 1st FNAHS, 2nd FBM, 3rd FALS
    // Mascot (weight 3): 1st FBM, 2nd FCJE, 3rd B-LEC
    expect(medals("fnahs")).toMatchObject({ gold: 2, silver: 0, bronze: 0 });
    expect(medals("fbm")).toMatchObject({ gold: 3, silver: 2, bronze: 0 });
    expect(medals("fcje")).toMatchObject({ gold: 0, silver: 3, bronze: 0 });
    expect(medals("bec")).toMatchObject({ gold: 0, silver: 0, bronze: 3 });
    expect(medals("fals")).toMatchObject({ gold: 0, silver: 0, bronze: 2 });
  });

  it("gives every other crew nothing at all", () => {
    const awarded = new Set(["fnahs", "fbm", "fcje", "bec", "fals"]);
    for (const team of TEAMS.filter((t) => !awarded.has(t.id))) {
      expect(medals(team.id), team.id).toMatchObject({ gold: 0, silver: 0, bronze: 0 });
    }
  });

  it("leaves 4th place and below with no medal tally, as the rules require", () => {
    // FNAHS is 4th in the mascot and FTED is 4th in the saludo.
    expect(medals("fted")).toMatchObject({ gold: 0, silver: 0, bronze: 0 });
  });
});
