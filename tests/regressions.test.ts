import { describe, expect, it } from "vitest";
import { toPublicState, toViewerState } from "@/lib/serialize";
import { auditPayload } from "@/lib/data/audit-payload";
import { deriveState } from "@/lib/data/derive";
import type { Command } from "@/lib/data/repo";
import type { CompetitionState, RawSheets, Result } from "@/lib/types";

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
