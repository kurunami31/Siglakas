import { describe, expect, it } from "vitest";
import { isBoardClosed, stateForViewer, toPublicState, toViewerState } from "@/lib/serialize";
import { configRows } from "@/lib/data/sheets-repo";
import { auditPayload } from "@/lib/data/audit-payload";
import { deriveState, teamResolver } from "@/lib/data/derive";
import { DemoRepository } from "@/lib/data/demo-repo";
import { DEFAULT_CONFIG, EVENTS, TEAMS, buildCriteria, generateDemoData } from "@/lib/data/seed";
import { buildEventDetail, buildEventSummaries } from "@/lib/scoring/events";
import { rankingRuleLabel } from "@/lib/scoring/medals";
import { mergeMatchPlacements } from "@/lib/scoring/match";
import type { Command } from "@/lib/data/repo";
import type { CompetitionState, Criterion, EventItem, JudgeScore, RawSheets, Result, Team } from "@/lib/types";

/**
 * Regression coverage for bugs found and fixed during the SIGLAKAS build. Each
 * case here corresponds to something that was actually broken, so a future
 * refactor cannot quietly reintroduce it.
 */

const result = (status: Result["status"], teamId = "t1"): Result => ({
  eventId: "e1",
  teamId,
  placement: 1,
  tie: false,
  status,
  enteredBy: "tester",
  timestamp: "2026-01-01T00:00:00.000Z",
});

const stateWith = (results: Result[]): CompetitionState =>
  ({ results }) as unknown as CompetitionState;

describe("draft visibility", () => {
  it("withholds drafts from an anonymous viewer", () => {
    const view = toViewerState(stateWith([result("draft"), result("published")]), null);
    expect(view.results).toHaveLength(1);
    expect(view.results.every((r) => r.status === "published")).toBe(true);
  });

  /**
   * The bug: every state endpoint applied the public projection, so a saved
   * draft vanished from the admin grid on reload and could never be finished.
   * Editors must receive their own drafts.
   */
  it.each(["pio", "secretariat", "superadmin"] as const)("gives %s its drafts back", (role) => {
    const view = toViewerState(stateWith([result("draft"), result("published")]), role);
    expect(view.results).toHaveLength(2);
    expect(view.results.some((r) => r.status === "draft")).toBe(true);
  });

  it("still strips drafts from everything else", () => {
    expect(toPublicState(stateWith([result("draft")])).results).toEqual([]);
  });
});

/**
 * The maintenance switch exists because the results were reconciled against the
 * committee's sheets while the site was live, and a half-corrected board is
 * worse than a closed one. Closing has to be total — pages and both live feeds —
 * and must never lock the crew out of the tool they closed the board to use.
 */
describe("maintenance switch", () => {
  const raw = (config: Record<string, unknown>): RawSheets =>
    ({
      config,
      teams: [
        { id: "t1", name: "Crew One", shortName: "T1", group: "faculty", color: "#ffffff", logoFile: "t1", mascot: "" },
      ],
      events: [
        {
          id: "e1",
          name: "Event One",
          division: "sports",
          category: "Team Sports",
          scoringType: "placement",
          medalWeight: 3,
          gender: "Open",
          multiplier: 1,
          status: "finished",
          locked: false,
        },
      ],
      criteria: [],
      matches: [],
      judgeScores: [],
      results: [result("published", "t1")],
      announcements: [],
      auditLog: [],
      users: [],
    }) as unknown as RawSheets;

  const open = deriveState(raw({}));
  const closed = deriveState(raw({ maintenance: true }));

  it("is off by default", () => {
    expect(DEFAULT_CONFIG.maintenance).toBe(false);
    expect(isBoardClosed(open, null)).toBe(false);
    expect(stateForViewer(open, null).standings).toHaveLength(1);
  });

  it("closes for anonymous viewers and stays open for every staff role", () => {
    expect(isBoardClosed(closed, null)).toBe(true);
    for (const role of ["pio", "secretariat", "superadmin"] as const) {
      expect(isBoardClosed(closed, role)).toBe(false);
      expect(stateForViewer(closed, role).results).toHaveLength(1);
      expect(stateForViewer(closed, role).standings).toHaveLength(1);
    }
  });

  /**
   * The public payload carries no scoring at all while closed — not even the
   * standings — but keeps the config, which is how the client knows why it is
   * shut and can reopen itself, and the roster, which is on the programme anyway.
   */
  it("serves a board with no scoring in it", () => {
    const view = stateForViewer(closed, null);
    expect(view.config.maintenance).toBe(true);
    expect(view.results).toEqual([]);
    expect(view.matches).toEqual([]);
    expect(view.standings).toEqual([]);
    expect(view.teams).toHaveLength(1);
  });

  /** A hand-edited Config cell must not be able to shut the site down. */
  it("only accepts a real boolean", () => {
    expect(deriveState(raw({ maintenance: "yes" })).config.maintenance).toBe(false);
    expect(deriveState(raw({ maintenance: "" })).config.maintenance).toBe(false);
  });

  /** Clients discover the switch through the version hash, so it has to change. */
  it("changes the version when it flips", () => {
    expect(closed.version).not.toBe(open.version);
  });

  it("round-trips through the Config tab", () => {
    expect(configRows({ ...DEFAULT_CONFIG, maintenance: true })).toContainEqual(["maintenance", "TRUE"]);
    expect(configRows(DEFAULT_CONFIG)).toContainEqual(["maintenance", "FALSE"]);
  });
});

describe("audit payload redaction", () => {
  const upsert = {
    type: "upsertUser",
    user: { username: "u1", role: "pio", teamId: "", active: true, passwordHash: "$2b$10$SUPERSECRETHASH" },
    actor: "superadmin",
  } as unknown as Command;

  /**
   * The bug: the audit entry was a plain JSON.stringify of the command, so a
   * password reset wrote the bcrypt hash into the sheet for anyone with read
   * access to see.
   */
  it("never writes a bcrypt hash into the audit log", () => {
    const payload = auditPayload(upsert);
    expect(payload).not.toContain("$2b$10$");
    expect(payload).not.toContain("SUPERSECRETHASH");
    expect(payload).toContain("[redacted]");
  });

  it("keeps the fields an audit reader actually needs", () => {
    const payload = auditPayload(upsert);
    expect(payload).toContain("u1");
    expect(payload).toContain("superadmin");
    expect(payload).toContain("upsertUser");
  });

  it("leaves ordinary commands untouched", () => {
    const cmd = { type: "publishResults", eventId: "badminton-singles", actor: "pio" } as Command;
    expect(auditPayload(cmd)).toBe(JSON.stringify(cmd));
  });

  it("honours the length limit", () => {
    expect(auditPayload(upsert, 20)).toHaveLength(20);
  });
});

describe("medals at stake", () => {
  /**
   * An event's medalWeight is how many medals EACH placing wins, not the number
   * of placings. This surprised everyone the first time it was seen, so it is
   * pinned down here: a weight of 3 means a first place takes three golds.
   */
  const rawFor = (medalWeight: number): RawSheets =>
    ({
      config: {},
      teams: [
        { id: "a", name: "Crew A", shortName: "A", group: "faculty", color: "#123456", logoFile: "a", mascot: "Alpha" },
      ],
      events: [
        {
          id: "e1",
          name: "Test Event",
          division: "sports",
          category: "Test",
          scoringType: "placement",
          medalWeight,
          gender: "Open",
          multiplier: 1,
          status: "upcoming",
          locked: false,
          verify: false,
        },
      ],
      criteria: [],
      matches: [],
      judgeScores: [],
      announcements: [],
      auditLog: [],
      users: [],
      results: [result("published", "a")],
    }) as unknown as RawSheets;

  it("awards medalWeight medals for a first place", () => {
    const overall = deriveState(rawFor(3)).standings.find((s) => s.teamId === "a")!.overall;
    expect(overall.gold).toBe(3);
    expect(overall.totalMedals).toBe(3);
  });

  it("does not scale placement points by medalWeight", () => {
    const one = deriveState(rawFor(1)).standings.find((s) => s.teamId === "a")!.overall;
    const five = deriveState(rawFor(5)).standings.find((s) => s.teamId === "a")!.overall;
    // Points come from the placement table and the multiplier only.
    expect(one.points).toBe(five.points);
    expect(five.gold).toBe(5);
  });

  it("ignores unpublished rows in the standings", () => {
    const raw = rawFor(3);
    (raw as unknown as { results: Result[] }).results = [result("draft", "a")];
    expect(deriveState(raw).standings.find((s) => s.teamId === "a")!.overall.totalMedals).toBe(0);
  });
});

describe("participation events", () => {
  /** FUN RUN / FUNEBALL: no placing, one gold per participant. */
  const rawFor = (count: number, weight = 1): RawSheets =>
    ({
      config: {},
      teams: [
        { id: "a", name: "Crew A", shortName: "A", group: "faculty", color: "#123456", logoFile: "a", mascot: "Alpha" },
      ],
      events: [
        {
          id: "e1",
          name: "FUN RUN",
          division: "sports",
          category: "Special Event",
          scoringType: "participation",
          medalWeight: weight,
          gender: "Open",
          multiplier: 1,
          status: "upcoming",
          locked: false,
          verify: false,
        },
      ],
      criteria: [],
      matches: [],
      judgeScores: [],
      announcements: [],
      auditLog: [],
      users: [],
      results: [
        { eventId: "e1", teamId: "a", placement: 0, tie: false, status: "published", enteredBy: "x", timestamp: "t", count },
      ],
    }) as unknown as RawSheets;

  const overall = (count: number, weight = 1) =>
    deriveState(rawFor(count, weight)).standings.find((s) => s.teamId === "a")!.overall;

  it("awards exactly one gold per participant, and nothing else", () => {
    const o = overall(7);
    expect(o.gold).toBe(7);
    expect(o.silver).toBe(0);
    expect(o.bronze).toBe(0);
    expect(o.totalMedals).toBe(7);
  });

  it("awards nothing to a crew that entered nobody", () => {
    expect(overall(0).totalMedals).toBe(0);
  });

  it("gives no placement points, because there is no placing", () => {
    expect(overall(7).points).toBe(0);
  });

  it("multiplies by the weight, which is exactly why it must stay 1", () => {
    // Pinned down so nobody 'helpfully' restores the old 50/10 weights: at 50 a
    // single participant would be worth 50 golds.
    expect(overall(7, 2).gold).toBe(14);
  });

  it("still honours a draft row being unpublished", () => {
    const raw = rawFor(7);
    (raw as unknown as { results: Result[] }).results[0].status = "draft";
    expect(deriveState(raw).standings.find((s) => s.teamId === "a")!.overall.totalMedals).toBe(0);
  });

  it("reports golds on the event page instead of a phantom placing", () => {
    // Was: placement 0, no medal and one placement point per crew — the event
    // page disagreed with the medal board, which showed seven golds.
    const state = deriveState(rawFor(7));
    const summary = buildEventSummaries(state.events, state.results, state.config)[0]!;
    const row = summary.rows.find((r) => r.teamId === "a")!;
    expect(row.placement).toBe(0);
    expect(row.points).toBe(0);
    expect(row.medal).toBe("gold");
    expect(row.count).toBe(7);
    expect(row.golds).toBe(7);
  });

  it("keeps the event page and the medal board in step at any weight", () => {
    const state = deriveState(rawFor(7, 2));
    const summary = buildEventSummaries(state.events, state.results, state.config)[0]!;
    const shown = summary.rows.reduce((n, r) => n + (r.golds ?? 0), 0);
    expect(shown).toBe(state.standings.find((s) => s.teamId === "a")!.overall.gold);
  });

  it("does not award a participation crew a medal it did not earn", () => {
    const state = deriveState(rawFor(0));
    const summary = buildEventSummaries(state.events, state.results, state.config)[0]!;
    const row = summary.rows.find((r) => r.teamId === "a")!;
    expect(row.golds).toBe(0);
    expect(row.medal).toBeNull();
    expect(row.points).toBe(0);
  });

  it("leaves placing events on the placement table", () => {
    const raw = rawFor(7) as unknown as RawSheets & { events: Array<{ scoringType: string }> };
    raw.events[0].scoringType = "placement";
    (raw as unknown as { results: Result[] }).results[0].placement = 1;
    const state = deriveState(raw);
    const summary = buildEventSummaries(state.events, state.results, state.config)[0]!;
    const row = summary.rows.find((r) => r.teamId === "a")!;
    expect(row.placement).toBe(1);
    expect(row.medal).toBe("gold");
    expect(row.points).toBe(10);
    expect(row.golds).toBeUndefined();
    expect(row.count).toBeUndefined();
  });
});

describe("demo data", () => {
  it("enters headcounts for participation events, not invented placings", () => {
    // The generator used to fall through to the placement branch for FUN RUN and
    // FUNEBALL, which produced medallists nobody could have earned because the
    // board only ever counts `count` golds.
    const { results } = generateDemoData(EVENTS, TEAMS, []);
    const participation = new Set(
      EVENTS.filter((e) => e.scoringType === "participation").map((e) => e.id),
    );
    expect(participation.size).toBe(2);

    const rows = results.filter((r) => participation.has(r.eventId));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.placement).toBe(0);
      expect(r.count ?? 0).toBeGreaterThan(0);
    }
    // Every crew fields somebody, so they all pick up at least one gold.
    expect(new Set(rows.map((r) => r.teamId)).size).toBe(TEAMS.length);
  });

  /**
   * The event pages and the medal board are computed by two different modules
   * (`events.ts` and `rank.ts`) from the same rows. They must never disagree:
   * that divergence is exactly what the FUN RUN bug was. This walks the whole
   * demo festival — 98 events, every scoring type — and compares the golds each
   * row displays against the golds the board credits, crew by crew.
   */
  it("the event pages and the medal board agree across the whole festival", async () => {
    const raw = await new DemoRepository().read();
    const state = deriveState(raw);
    const board = new Map(state.standings.map((s) => [s.teamId, s.overall.gold]));

    const merged = mergeMatchPlacements(raw.results, raw.events, raw.matches);
    const pages = new Map<string, number>();
    for (const { event, rows } of buildEventSummaries(raw.events, merged, state.config)) {
      for (const r of rows) {
        if (r.status !== "published") continue;
        const golds =
          event.scoringType === "participation"
            ? (r.golds ?? 0)
            : r.medal === "gold"
              ? event.medalWeight
              : 0;
        pages.set(r.teamId, (pages.get(r.teamId) ?? 0) + golds);
      }
    }

    for (const team of state.teams) {
      expect(pages.get(team.id) ?? 0, `${team.id} golds`).toBe(board.get(team.id) ?? 0);
    }
  });
});

describe("crew references in hand-edited rows", () => {
  it("resolves an id, a short name or a full name", () => {
    const resolve = teamResolver(TEAMS);
    expect(resolve("bec")).toBe("bec");
    expect(resolve("B-LEC")).toBe("bec");
    expect(resolve("b lec")).toBe("bec");
    expect(resolve("blec")).toBe("bec");
    expect(resolve("Banaybanay-Lupon Extension Campus")).toBe("bec");
    expect(resolve("FACET")).toBe("facet");
    expect(resolve("Faculty of Business and Management")).toBe("fbm");
  });

  it("leaves a genuine typo alone rather than guessing a crew", () => {
    const resolve = teamResolver(TEAMS);
    expect(resolve("not a crew")).toBe("not a crew");
    expect(resolve("")).toBe("");
  });

  it("scores a row whose team_id is the short name, where it used to be dropped", () => {
    // The bug: the crew column read "B-LEC" instead of the id `bec`, the scorer
    // looked it up in a Map keyed on the id, missed, and `continue`d — so the
    // medals vanished with nothing anywhere saying so. It happened seven times
    // in one afternoon before anyone noticed.
    const mascot = EVENTS.filter((e) => e.id === "mascot");
    const raw = {
      config: {},
      teams: TEAMS.map((t) => ({ ...t })),
      events: mascot.map((e) => ({ ...e })),
      criteria: buildCriteria(mascot),
      matches: [],
      judgeScores: [],
      announcements: [],
      auditLog: [],
      users: [],
      results: [
        {
          eventId: "mascot",
          teamId: "B-LEC",
          placement: 3,
          tie: false,
          status: "published",
          enteredBy: "super admin",
          timestamp: "",
        },
      ],
    } as unknown as RawSheets;

    const state = deriveState(raw);
    const bec = state.standings.find((s) => s.teamId === "bec")!;
    expect(bec.overall.bronze).toBe(3); // mascot is weight 3
    expect(bec.overall.totalMedals).toBe(3);
    // and the row is normalised, so the UI's byId lookup finds the crew too
    expect(state.results[0].teamId).toBe("bec");
  });
});

describe("ranking rule label", () => {
  const label = (mode: "gold_first" | "total_medals" | "weighted_points") =>
    rankingRuleLabel({ ...DEFAULT_CONFIG, championshipRankBy: mode });

  it("describes the mode that is actually configured", () => {
    expect(label("gold_first")).toBe("Ranked by golds → silvers → bronzes");
    expect(label("total_medals")).toBe("Ranked by total medals → golds → silvers");
    expect(label("weighted_points")).toContain("gold 3 · silver 2 · bronze 1");
  });

  it("never claims total medals while the board sorts gold-first", () => {
    // The medal table hard-coded "total medals → golds → silvers" while the
    // config said gold_first, so it described a rule it was not using — and the
    // live board disproved it: B-LEC had more medals than FTED and ranked below.
    expect(label("gold_first")).not.toMatch(/total medals/i);
  });
});

describe("aggregate events — a placing shared by several crews", () => {
  const rawFor = (
    eventId: string,
    rows: Array<{ teamId: string; placement: number; count?: number }>,
  ): RawSheets => {
    const events = EVENTS.filter((e) => e.id === eventId);
    return {
      config: {},
      teams: TEAMS.map((t) => ({ ...t })),
      events: events.map((e) => ({ ...e })),
      criteria: buildCriteria(events),
      matches: [],
      judgeScores: [],
      announcements: [],
      auditLog: [],
      users: [],
      results: rows.map((r) => ({
        eventId,
        teamId: r.teamId,
        placement: r.placement,
        count: r.count ?? 0,
        tie: false,
        status: "published" as const,
        enteredBy: "tester",
        timestamp: "",
      })),
    } as unknown as RawSheets;
  };
  const goldsOf = (state: CompetitionState, teamId: string) =>
    state.standings.find((s) => s.teamId === teamId)!.overall.gold;

  it("uses the row's count instead of the event's whole weight", () => {
    // Swimming is twelve races in one row, so two crews can both be "1st".
    // Before: each was credited with all twelve golds — 24 from a programme of
    // 24, which is what put BGEC on 78 instead of 68.
    const state = deriveState(
      rawFor("swimming-m", [
        { teamId: "facet", placement: 1, count: 7 },
        { teamId: "fbm", placement: 1, count: 5 },
      ]),
    );
    expect(goldsOf(state, "facet")).toBe(7);
    expect(goldsOf(state, "fbm")).toBe(5);
  });

  it("never awards more than the event actually contains", () => {
    const state = deriveState(
      rawFor("swimming-m", [
        { teamId: "facet", placement: 1, count: 7 },
        { teamId: "fbm", placement: 1, count: 5 },
      ]),
    );
    const total = TEAMS.reduce((n, t) => n + goldsOf(state, t.id), 0);
    expect(total).toBe(12); // swimming-m's medal_weight
  });

  it("keeps the weight when count is blank, so rosters still work", () => {
    // Basketball: five players, each medalling for the team's placing.
    const state = deriveState(rawFor("basketball-m", [{ teamId: "facet", placement: 1 }]));
    expect(goldsOf(state, "facet")).toBe(5);
  });

  it("uses the count for silver and bronze too, but only on that placing", () => {
    const state = deriveState(
      rawFor("swimming-m", [
        { teamId: "facet", placement: 2, count: 3 },
        { teamId: "fbm", placement: 3, count: 4 },
      ]),
    );
    const facet = state.standings.find((s) => s.teamId === "facet")!.overall;
    const fbm = state.standings.find((s) => s.teamId === "fbm")!.overall;
    expect([facet.gold, facet.silver, facet.bronze]).toEqual([0, 3, 0]);
    expect([fbm.gold, fbm.silver, fbm.bronze]).toEqual([0, 0, 4]);
  });
});

describe("judged events", () => {
  const crew = (id: string, name: string): Team => ({
    id,
    name,
    shortName: id.toUpperCase(),
    group: "faculty",
    color: "#123456",
    logoFile: id,
    mascot: `${name} mascot`,
  });
  const crews = [crew("a", "Crew A"), crew("b", "Crew B"), crew("c", "Crew C")];
  const posterEvent: EventItem = {
    id: "e1",
    name: "On the Spot Poster Making",
    division: "cultural",
    category: "Visual Arts",
    scoringType: "judged",
    medalWeight: 1,
    gender: "Open",
    multiplier: 1,
    status: "upcoming",
    locked: false,
  };
  const criteria: Criterion[] = [{ eventId: "e1", criterion: "Creativity", weight: 50, order: 1 }];
  const detail = (scores: JudgeScore[]) =>
    buildEventDetail(posterEvent, crews, [], [], scores, criteria, "first_criterion", DEFAULT_CONFIG);

  it("publishes no ranking before anyone has scored", () => {
    // Was: all three crews ranked 1st-3rd off a board of zeroes, with gold,
    // silver and bronze icons beside the first three alphabetically — on the
    // live site, before a single judge had scored.
    expect(detail([]).judged).toEqual([]);
  });

  it("ranks only the crews the panel has actually scored", () => {
    const scores: JudgeScore[] = [
      { eventId: "e1", teamId: "b", judge: "Judge A", criterion: "Creativity", score: 91 },
    ];
    const judged = detail(scores).judged;
    expect(judged.map((j) => j.teamId)).toEqual(["b"]);
    expect(judged[0].rank).toBe(1);
    expect(judged[0].finalScore).toBe(91);
  });

  it("still ranks every crew once they all have scores", () => {
    const scores: JudgeScore[] = [
      { eventId: "e1", teamId: "a", judge: "Judge A", criterion: "Creativity", score: 80 },
      { eventId: "e1", teamId: "b", judge: "Judge A", criterion: "Creativity", score: 95 },
      { eventId: "e1", teamId: "c", judge: "Judge A", criterion: "Creativity", score: 88 },
    ];
    expect(detail(scores).judged.map((j) => [j.teamId, j.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });
});
