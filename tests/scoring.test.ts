import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACEMENT_TABLE,
  placementToPoints,
  placementsFromScores,
} from "@/lib/scoring/placement";
import { computeJudgedStandings } from "@/lib/scoring/judged";
import { classifyRound, computeRoundRobin, matchEventPlacements, mergeMatchPlacements } from "@/lib/scoring/match";
import {
  applyGroupFilter,
  buildMedalTable,
  buildStandings,
  sortStandings,
} from "@/lib/scoring/rank";
import { compareBreakdowns } from "@/lib/scoring/medals";
import { buildCriteria, DEFAULT_CONFIG, EVENTS, TEAMS } from "@/lib/data/seed";
import type { Criterion, EventItem, JudgeScore, Result } from "@/lib/types";

const teams = TEAMS;
/** two synthetic crews (a, b) for isolated scoring tests */
const twoTeams = [{ ...TEAMS[0], id: "a" }, { ...TEAMS[1], id: "b" }];

function ev(partial: Partial<EventItem> & { id: string }): EventItem {
  return {
    name: partial.id,
    division: "sports",
    category: "Individual/Dual Sports",
    scoringType: "placement",
    medalWeight: 3,
    gender: "Open",
    multiplier: 1,
    status: "finished",
    locked: false,
    ...partial,
  };
}

const config = { ...DEFAULT_CONFIG };

describe("placement scoring", () => {
  it("maps placements through the table with a multiplier", () => {
    expect(placementToPoints(1)).toBe(10);
    expect(placementToPoints(2)).toBe(7);
    expect(placementToPoints(3)).toBe(5);
    expect(placementToPoints(4)).toBe(3);
    expect(placementToPoints(0)).toBe(1); // participation
    expect(placementToPoints(1, DEFAULT_PLACEMENT_TABLE, 2)).toBe(20); // 2x major
    expect(placementToPoints(12)).toBe(1); // beyond table → participation
  });

  it("assigns competition ranks (1,2,2,4) on ties", () => {
    const res = placementsFromScores([
      { id: "a", score: 90 },
      { id: "b", score: 90 },
      { id: "c", score: 80 },
      { id: "d", score: 10 },
    ]);
    expect(res.map((r) => `${r.id}:${r.placement}`)).toEqual([
      "a:1",
      "b:1",
      "c:3",
      "d:4",
    ]);
  });
});

describe("judged scoring", () => {
  const criteria: Criterion[] = [
    { eventId: "e1", criterion: "Technique", weight: 40, order: 0 },
    { eventId: "e1", criterion: "Stage Presence", weight: 30, order: 1 },
    { eventId: "e1", criterion: "Creativity", weight: 30, order: 2 },
  ];

  it("computes a weighted average across judges and ranks correctly", () => {
    const scores: JudgeScore[] = [
      // team a: 90 tech, 80 sp, 70 cr  → 90*.4+80*.3+70*.3 = 36+24+21 = 81
      { eventId: "e1", teamId: "a", judge: "J1", criterion: "Technique", score: 90 },
      { eventId: "e1", teamId: "a", judge: "J1", criterion: "Stage Presence", score: 80 },
      { eventId: "e1", teamId: "a", judge: "J1", criterion: "Creativity", score: 70 },
      // team b: all 80 → 80
      { eventId: "e1", teamId: "b", judge: "J1", criterion: "Technique", score: 80 },
      { eventId: "e1", teamId: "b", judge: "J1", criterion: "Stage Presence", score: 80 },
      { eventId: "e1", teamId: "b", judge: "J1", criterion: "Creativity", score: 80 },
    ];
    const rows = computeJudgedStandings("e1", twoTeams, criteria, scores, "first_criterion");
    expect(rows[0].teamId).toBe("a");
    expect(rows[0].finalScore).toBe(81);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].teamId).toBe("b");
    expect(rows[1].rank).toBe(2);
  });

  it("breaks ties on the highest-weighted criterion", () => {
    const scores: JudgeScore[] = [
      // both produce a total of exactly 72, but `a` scores higher on
      // Technique, which carries the greatest weight → `a` is placed 1st.
      { eventId: "e2", teamId: "a", judge: "J1", criterion: "Technique", score: 90 },
      { eventId: "e2", teamId: "a", judge: "J1", criterion: "Stage Presence", score: 60 },
      { eventId: "e2", teamId: "a", judge: "J1", criterion: "Creativity", score: 60 },
      { eventId: "e2", teamId: "b", judge: "J1", criterion: "Technique", score: 72 },
      { eventId: "e2", teamId: "b", judge: "J1", criterion: "Stage Presence", score: 72 },
      { eventId: "e2", teamId: "b", judge: "J1", criterion: "Creativity", score: 72 },
    ];
    const criteriaE2 = criteria.map((c) => ({ ...c, eventId: "e2" }));
    const rows = computeJudgedStandings("e2", twoTeams, criteriaE2, scores, "first_criterion");
    expect(rows[0].finalScore).toBe(72);
    expect(rows[1].finalScore).toBe(72);
    expect(rows[0].teamId).toBe("a");
    expect(rows[1].teamId).toBe("b");
  });

  it("keeps ties flagged in manual mode", () => {
    const scores: JudgeScore[] = [
      { eventId: "e3", teamId: "a", judge: "J1", criterion: "Technique", score: 80 },
      { eventId: "e3", teamId: "b", judge: "J1", criterion: "Technique", score: 80 },
    ];
    const criteriaE3 = criteria.map((c) => ({ ...c, eventId: "e3" }));
    const rows = computeJudgedStandings("e3", twoTeams, criteriaE3, scores, "manual");
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(1);
    expect(rows[0].tied).toBe(true);
    expect(rows[0].finalScore).toBe(80);
  });
});

describe("match scoring", () => {
  it("builds round-robin standings", () => {
    const rows = computeRoundRobin([
      { id: "m1", eventId: "s", round: "R1", teamA: "a", teamB: "b", scoreA: 3, scoreB: 0, winner: "a", status: "final" },
      { id: "m2", eventId: "s", round: "R1", teamA: "c", teamB: "d", scoreA: 1, scoreB: 3, winner: "d", status: "final" },
    ]);
    expect(rows[0].teamId).toBe("a");
    expect(rows[0].wins).toBe(1);
    expect(rows.find((r) => r.teamId === "d")!.wins).toBe(1);
    expect(rows.find((r) => r.teamId === "b")!.losses).toBe(1);
  });

  it("derives final placements from the final match", () => {
    const p = matchEventPlacements([
      { id: "f", eventId: "s", round: "Final", teamA: "a", teamB: "b", scoreA: 3, scoreB: 2, winner: "a", status: "final" },
    ]);
    expect(p).toEqual({ a: 1, b: 2 });
  });

  it("awards bronze from the bronze-medal match", () => {
    const p = matchEventPlacements([
      { id: "sf1", eventId: "s", round: "Semifinal", teamA: "a", teamB: "b", scoreA: 3, scoreB: 1, winner: "a", status: "final" },
      { id: "sf2", eventId: "s", round: "Semifinal", teamA: "c", teamB: "d", scoreA: 3, scoreB: 0, winner: "c", status: "final" },
      { id: "bm", eventId: "s", round: "Bronze Medal Match", teamA: "b", teamB: "d", scoreA: 3, scoreB: 2, winner: "b", status: "final" },
      { id: "f", eventId: "s", round: "Final", teamA: "a", teamB: "c", scoreA: 3, scoreB: 1, winner: "a", status: "final" },
    ]);
    expect(p).toEqual({ a: 1, c: 2, b: 3 });
  });

  it("never mistakes a semifinal for the final", () => {
    // Regression: "semifinal".includes("final") is true, which used to crown a
    // semifinal winner as champion.
    const p = matchEventPlacements([
      { id: "sf", eventId: "s", round: "Semifinal", teamA: "a", teamB: "b", scoreA: 3, scoreB: 0, winner: "a", status: "final" },
    ]);
    expect(p).toEqual({});
  });

  it("takes the last final when double elimination forces a bracket reset", () => {
    const p = matchEventPlacements([
      { id: "f1", eventId: "s", round: "Final", teamA: "a", teamB: "b", scoreA: 3, scoreB: 2, winner: "a", status: "final" },
      { id: "f2", eventId: "s", round: "Grand Final", teamA: "a", teamB: "b", scoreA: 1, scoreB: 3, winner: "b", status: "final" },
    ]);
    expect(p).toEqual({ b: 1, a: 2 });
  });

  it("ignores brackets that are not finished", () => {
    const p = matchEventPlacements([
      { id: "f", eventId: "s", round: "Final", teamA: "a", teamB: "b", scoreA: 3, scoreB: 2, winner: "a", status: "live" },
    ]);
    expect(p).toEqual({});
  });

  it("classifies round labels", () => {
    expect(classifyRound("Final")).toBe("final");
    expect(classifyRound("Grand Final")).toBe("final");
    expect(classifyRound("Semifinal")).toBe("other");
    expect(classifyRound("Quarterfinal")).toBe("other");
    expect(classifyRound("Round 1")).toBe("other");
    expect(classifyRound("Bronze Medal Match")).toBe("bronze");
    expect(classifyRound("3rd Place")).toBe("bronze");
    expect(classifyRound("")).toBe("other");
  });

  it("folds a completed bracket into results, but a hand-entered result wins", () => {
    const matchEvents = [ev({ id: "volley-m", medalWeight: 6, division: "sports", scoringType: "match" })];
    const matches = [
      { id: "f", eventId: "volley-m", round: "Final", teamA: "fbm", teamB: "facet", scoreA: 3, scoreB: 1, winner: "fbm", status: "final" as const },
      { id: "bm", eventId: "volley-m", round: "Bronze Medal Match", teamA: "fted", teamB: "tec", scoreA: 3, scoreB: 0, winner: "fted", status: "final" as const },
    ];

    const merged = mergeMatchPlacements([], matchEvents, matches);
    expect(merged.map((r) => [r.teamId, r.placement, r.status])).toEqual([
      ["fbm", 1, "published"],
      ["facet", 2, "published"],
      ["fted", 3, "published"],
    ]);

    // The Secretariat's own entry for that event is never overridden.
    const manual: Result[] = [
      { eventId: "volley-m", teamId: "bec", placement: 1, tie: false, status: "published", enteredBy: "x", timestamp: "" },
    ];
    expect(mergeMatchPlacements(manual, matchEvents, matches)).toBe(manual);
  });
});

describe("standings, medals and ranking across all 12 crews", () => {
  const events: EventItem[] = [
    ev({ id: "s1", medalWeight: 10, division: "sports" }),
    ev({ id: "s2", medalWeight: 5, division: "sports" }),
    ev({ id: "c1", medalWeight: 10, division: "cultural" }),
  ];
  const results: Result[] = [
    // fbm: gold in s1 (10) + gold c1 (10) = 2 gold, 20 medals
    { eventId: "s1", teamId: "fbm", placement: 1, tie: false, status: "published", enteredBy: "x", timestamp: "" },
    { eventId: "c1", teamId: "fbm", placement: 1, tie: false, status: "published", enteredBy: "x", timestamp: "" },
    // facet: silver s1 (10)
    { eventId: "s1", teamId: "facet", placement: 2, tie: false, status: "published", enteredBy: "x", timestamp: "" },
    // fted: gold s2 (5)
    { eventId: "s2", teamId: "fted", placement: 1, tie: false, status: "published", enteredBy: "x", timestamp: "" },
    // draft must be ignored on public
    { eventId: "c1", teamId: "tec", placement: 2, tie: false, status: "draft", enteredBy: "x", timestamp: "" },
  ];

  const standings = buildStandings({ teams, events, results, config, onlyPublished: true });

  it("counts medals weighted by the event weight", () => {
    const fbm = standings.find((s) => s.teamId === "fbm")!;
    expect(fbm.overall.gold).toBe(20);
    expect(fbm.overall.totalMedals).toBe(20);
    expect(fbm.overall.points).toBe(20); // 10 + 10 points
  });

  it("ranks by gold medals first, then silvers (the manual's rule)", () => {
    const fbm = standings.find((s) => s.teamId === "fbm")!;
    const fted = standings.find((s) => s.teamId === "fted")!;
    const facet = standings.find((s) => s.teamId === "facet")!;
    expect(fbm.ranks.overall).toBe(1); // 20 golds
    expect(fted.ranks.overall).toBe(2); // 5 golds outranks 0 golds
    // facet has more total medals (10) than fted (5) but no gold, so ranks below.
    expect(facet.ranks.overall).toBe(3);
  });

  it("excludes drafts from the public standings", () => {
    expect(standings.find((s) => s.teamId === "tec")!.overall.totalMedals).toBe(0);
  });

  it("keeps rank unchanged when filtering by group", () => {
    const sorted = sortStandings(standings, "overall");
    const onlyFaculties = applyGroupFilter(sorted, teams, "faculty");
    const onlyCampuses = applyGroupFilter(sorted, teams, "extension_campus");
    expect(onlyFaculties).toHaveLength(7);
    expect(onlyCampuses).toHaveLength(5);
    // ranks are identical to the full board
    for (const row of [...onlyFaculties, ...onlyCampuses]) {
      expect(row.ranks.overall).toBe(standings.find((s) => s.teamId === row.teamId)!.ranks.overall);
    }
  });

  it("builds a medal table ordered by rank", () => {
    const table = buildMedalTable(sortStandings(standings, "overall"));
    expect(table[0].teamId).toBe("fbm");
    expect(table[0].gold).toBe(20);
  });

  it("compares breakdowns for every championship mode", () => {
    const a = { points: 10, gold: 1, silver: 0, bronze: 0, totalMedals: 1, medalPoints: 3 };
    const b = { points: 7, gold: 0, silver: 5, bronze: 0, totalMedals: 5, medalPoints: 10 };
    expect(compareBreakdowns(b, a, "total_medals")).toBeLessThan(0); // b has more medals
    expect(compareBreakdowns(a, b, "gold_first")).toBeLessThan(0); // a has more gold
    expect(compareBreakdowns(a, b, "weighted_points")).toBeGreaterThan(0); // b has more medal points
  });
});

describe("seed catalogue integrity", () => {
  it("has 12 crews split 7 faculties / 5 campuses", () => {
    expect(teams).toHaveLength(12);
    expect(teams.filter((t) => t.group === "faculty")).toHaveLength(7);
    expect(teams.filter((t) => t.group === "extension_campus")).toHaveLength(5);
  });

  it("has the full 97-event catalogue totalling 488 medals per colour", () => {
    expect(EVENTS).toHaveLength(97);
    const total = EVENTS.reduce((sum, e) => sum + e.medalWeight, 0);
    expect(total).toBe(488);
  });

  it("matches the printed section subtotals", () => {
    const sum = (category: string) =>
      EVENTS.filter((e) => e.category === category).reduce((s, e) => s + e.medalWeight, 0);
    expect(sum("Team Sports")).toBe(65);
    expect(sum("E-Sports")).toBe(14);
    expect(sum("Individual/Dual Sports")).toBe(159);
    expect(sum("Traditional Games")).toBe(18);
    expect(sum("Mind Games")).toBe(8);
    expect(sum("Visual Arts")).toBe(5);
    expect(sum("Music Arts")).toBe(43);
    expect(sum("Dance Arts")).toBe(46);
    expect(sum("Dramatic Arts")).toBe(19);
    expect(sum("Literary Arts")).toBe(13);
    expect(sum("Special Category")).toBe(38);
  });

  it("splits 324 sports / 164 cultural", () => {
    const sports = EVENTS.filter((e) => e.division === "sports").reduce((s, e) => s + e.medalWeight, 0);
    const cultural = EVENTS.filter((e) => e.division === "cultural").reduce((s, e) => s + e.medalWeight, 0);
    expect(sports).toBe(324);
    expect(cultural).toBe(164);
  });

  it("gives every judged event weighted criteria", () => {
    const criteria = buildCriteria(EVENTS);
    const judged = EVENTS.filter((e) => e.scoringType === "judged");
    for (const e of judged) {
      const cs = criteria.filter((c) => c.eventId === e.id);
      expect(cs.length).toBeGreaterThan(0);
      expect(cs.reduce((s, c) => s + c.weight, 0)).toBe(100);
    }
  });

  it("flags the remaining weight discrepancy for verification", () => {
    // Pandalawahang Pag-Arte was resolved from the manual (2, not 5);
    // Live Band still disagrees with its own printed sub-total.
    const flagged = EVENTS.filter((e) => e.verify).map((e) => e.id).sort();
    expect(flagged).toEqual(["live-band"]);
  });
});
