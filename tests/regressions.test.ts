import { describe, expect, it } from "vitest";
import { toPublicState, toViewerState } from "@/lib/serialize";
import { auditPayload } from "@/lib/data/audit-payload";
import { deriveState } from "@/lib/data/derive";
import { DemoRepository } from "@/lib/data/demo-repo";
import { DEFAULT_CONFIG, EVENTS, TEAMS, generateDemoData } from "@/lib/data/seed";
import { buildEventDetail, buildEventSummaries } from "@/lib/scoring/events";
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
