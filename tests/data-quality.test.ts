import { describe, expect, it } from "vitest";
import { auditResults, summariseIssues } from "@/lib/data/data-quality";
import type { EventItem, Result, Team } from "@/lib/types";

/**
 * The scorer resolves a result's event and team ids by lookup and skips rows it
 * cannot resolve — a mistyped id scores nothing, silently. These checks are the
 * only thing that makes that visible.
 */

const team = (id: string): Team => ({
  id,
  name: `Crew ${id}`,
  shortName: id.toUpperCase(),
  group: "faculty",
  color: "#123456",
  logoFile: id,
  mascot: "Mascot",
});

const event = (id: string): EventItem => ({
  id,
  name: `Event ${id}`,
  division: "sports",
  category: "Cat",
  scoringType: "placement",
  medalWeight: 1,
  gender: "Open",
  multiplier: 1,
  status: "upcoming",
  locked: false,
  verify: false,
});

const row = (eventId: string, teamId: string, placement: number, tie = false, status: Result["status"] = "published"): Result => ({
  eventId,
  teamId,
  placement,
  tie,
  status,
  enteredBy: "tester",
  timestamp: "2026-01-01T00:00:00.000Z",
});

const teams = [team("a"), team("b")];
const events = [event("e1")];

describe("result data quality", () => {
  it("passes a clean tally", () => {
    expect(auditResults(events, teams, [row("e1", "a", 1), row("e1", "b", 2)])).toEqual([]);
    expect(summariseIssues([])).toBeNull();
  });

  it("catches an event id that does not exist", () => {
    const issues = auditResults(events, teams, [row("e1", "a", 1), row("badminton-single", "b", 1)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("unknown_event");
    expect(issues[0].message).toContain("badminton-single");
  });

  it("catches a crew id that does not exist, including wrong case", () => {
    // "A" rather than "a" is the classic spreadsheet slip.
    const issues = auditResults(events, teams, [row("e1", "A", 1)]);
    expect(issues.map((i) => i.kind)).toEqual(["unknown_team"]);
  });

  it("groups repeated bad ids into one message", () => {
    const issues = auditResults(events, teams, [row("nope", "a", 1), row("nope", "b", 2), row("nope", "a", 3)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("3 result rows");
  });

  it("catches an untied placing used twice", () => {
    const issues = auditResults(events, teams, [row("e1", "a", 1), row("e1", "b", 1)]);
    expect(issues.map((i) => i.kind)).toEqual(["duplicate_placement"]);
    expect(issues[0].message).toContain("1st place");
  });

  it("allows a tie to share a placing", () => {
    expect(auditResults(events, teams, [row("e1", "a", 1, true), row("e1", "b", 1, true)])).toEqual([]);
  });

  it("ignores placement 0, which means participation", () => {
    expect(auditResults(events, teams, [row("e1", "a", 0), row("e1", "b", 0)])).toEqual([]);
  });

  it("reports both kinds together", () => {
    const issues = auditResults(events, teams, [row("nope", "a", 1), row("e1", "b", 1), row("e1", "a", 1)]);
    expect(summariseIssues(issues)).toContain("1 result row cannot be matched");
    expect(summariseIssues(issues)).toContain("1 duplicated placing");
  });
});
