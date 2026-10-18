import { describe, expect, it } from "vitest";
import { fixtureId, parseMatchLines } from "@/lib/match-parse";
import type { Team } from "@/lib/types";

const team = (id: string, shortName: string, mascot: string, name: string): Team => ({
  id,
  name,
  shortName,
  group: "faculty",
  color: "#123456",
  logoFile: id,
  mascot,
});

const teams = [
  team("fted", "FTED", "Blue Phoenix", "Faculty of Teacher Education"),
  team("facet", "FACET", "Orange Stallion", "Faculty of Computing, Engineering"),
  team("fbm", "FBM", "Yellow Eagle", "Faculty of Business Management"),
  team("fcje", "FCJE", "Red Eagle", "Faculty of Criminal Justice"),
];

describe("fixture paste parsing", () => {
  it("reads a whole round typed with dashes", () => {
    const { fixtures, problems } = parseMatchLines("FTED 2 - 0 FACET\nFBM 1-2 FCJE", teams);
    expect(problems).toEqual([]);
    expect(fixtures).toEqual([
      { teamA: "fted", teamB: "facet", scoreA: 2, scoreB: 0, detail: undefined, scheduled: false },
      { teamA: "fbm", teamB: "fcje", scoreA: 1, scoreB: 2, detail: undefined, scheduled: false },
    ]);
  });

  it("accepts space-separated scores and other separators", () => {
    for (const line of ["FTED 2 0 FACET", "FTED 2:0 FACET", "FTED 2x0 FACET", "FTED 2 – 0 FACET"]) {
      const { fixtures, problems } = parseMatchLines(line, teams);
      expect(problems, line).toEqual([]);
      expect(fixtures[0], line).toMatchObject({ scoreA: 2, scoreB: 0 });
    }
  });

  it("treats 'vs' as a fixture that has not been played", () => {
    const { fixtures } = parseMatchLines("FTED vs FACET", teams);
    expect(fixtures[0]).toMatchObject({ scoreA: 0, scoreB: 0, scheduled: true });
  });

  it("resolves a crew by mascot, and by full name, regardless of case", () => {
    const { fixtures, problems } = parseMatchLines(
      "blue phoenix 2-0 Orange Stallion\nFaculty of Business Management 1-2 red eagle",
      teams,
    );
    expect(problems).toEqual([]);
    expect(fixtures.map((f) => [f.teamA, f.teamB])).toEqual([
      ["fted", "facet"],
      ["fbm", "fcje"],
    ]);
  });

  it("keeps per-set detail after a pipe", () => {
    const { fixtures } = parseMatchLines("FTED 3-1 FACET | 11-8, 11-9", teams);
    expect(fixtures[0].detail).toBe("11-8, 11-9");
  });

  it("skips blank lines and comments", () => {
    const { fixtures, problems } = parseMatchLines("\n# semifinals\nFTED 2-0 FACET\n", teams);
    expect(fixtures).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  it("reports an unknown crew instead of dropping the line", () => {
    const { problems } = parseMatchLines("FTED 2-0 NOPE", teams);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("NOPE");
    expect(problems[0].line).toBe(1);
  });

  it("refuses a crew against itself", () => {
    const { problems } = parseMatchLines("FTED 2-0 FTED", teams);
    expect(problems[0].message).toContain("cannot play itself");
  });

  it("reports an unreadable score", () => {
    const { problems } = parseMatchLines("FTED beat FACET", teams);
    expect(problems[0].message).toContain("Could not read a score");
  });

  it("flags the same pairing twice", () => {
    const { fixtures, problems } = parseMatchLines("FTED 2-0 FACET\nFTED 3-0 FACET", teams);
    expect(fixtures).toHaveLength(1);
    expect(problems[0].message).toContain("appears twice");
  });
});

describe("fixture ids", () => {
  it("matches the shape the app has always used", () => {
    expect(fixtureId("sepak-m", "Final", "fted", "facet")).toBe("sepak-m--final--fted-facet");
  });

  it("slugifies a multi-word round", () => {
    expect(fixtureId("sepak-m", "Bronze medal match", "fted", "fbm")).toBe(
      "sepak-m--bronze-medal-match--fted-fbm",
    );
  });
});
