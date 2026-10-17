import { describe, expect, it } from "vitest";
import { parseBulkResults, toEntries, toTsv, type TeamLite } from "@/lib/bulk-parse";

const teams: TeamLite[] = [
  { id: "fbm", shortName: "FBM", name: "Faculty of Business and Management", mascot: "Buccaneers" },
  { id: "facet", shortName: "FACET", name: "Faculty of Applied Computing and Emerging Technologies", mascot: "Navigators" },
  { id: "fals", shortName: "FALS", name: "Faculty of Arts and Letters", mascot: "Sirens" },
  { id: "cie", shortName: "CEC", name: "College of Engineering and Computing", mascot: "Anchors" },
];

describe("parseBulkResults — shape", () => {
  it("reads crew<TAB>placement pasted straight from a spreadsheet", () => {
    const { ok, problems } = parseBulkResults("FBM\t1\nFACET\t2\nFALS\t3", teams);
    expect(problems).toHaveLength(0);
    expect(ok.map((r) => [r.teamId, r.placement, r.tie])).toEqual([
      ["fbm", 1, false],
      ["facet", 2, false],
      ["fals", 3, false],
    ]);
  });

  it("accepts the reverse order, commas, double spaces and a single space", () => {
    const text = ["1, FBM", "2   FACET", "3 FALS", "4\tCEC"].join("\n");
    const { ok, problems } = parseBulkResults(text, teams);
    expect(problems).toHaveLength(0);
    expect(ok.map((r) => r.teamId)).toEqual(["fbm", "facet", "fals", "cie"]);
  });

  it("skips a header row instead of reporting it as an error", () => {
    const { rows } = parseBulkResults("Crew\tPlacement\nFBM\t1", teams);
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(2);
  });

  it("ignores blank lines but keeps the true line numbers", () => {
    const { rows } = parseBulkResults("FBM\t1\n\n\nFACET\t2", teams);
    expect(rows.map((r) => r.line)).toEqual([1, 4]);
  });
});

describe("parseBulkResults — names", () => {
  it("matches full names, mascots and the mascot with a leading 'The'", () => {
    const text = ["Faculty of Business and Management\t1", "Navigators\t2", "The Sirens\t3"].join("\n");
    const { ok, problems } = parseBulkResults(text, teams);
    expect(problems).toHaveLength(0);
    expect(ok.map((r) => r.teamId)).toEqual(["fbm", "facet", "fals"]);
  });

  it("is case- and punctuation-insensitive", () => {
    const { ok } = parseBulkResults("f.b.m\t1\nfacet\t2", teams);
    expect(ok.map((r) => r.teamId)).toEqual(["fbm", "facet"]);
  });

  it("reports an unknown crew rather than guessing", () => {
    const { problems } = parseBulkResults("FBM\t1\nHufflepuff\t2", teams);
    expect(problems).toHaveLength(1);
    expect(problems[0].line).toBe(2);
    expect(problems[0].error).toMatch(/Unknown crew/);
  });
});

describe("parseBulkResults — placements", () => {
  it("treats dashes and 'none' as participation (placement 0)", () => {
    const { ok } = parseBulkResults("FBM\t-\nFACET\tnone\nFALS\tDNP", teams);
    expect(ok.map((r) => r.placement)).toEqual([0, 0, 0]);
  });

  it("reads a tie marker as a tie", () => {
    const { ok } = parseBulkResults("FBM\t1*\nFACET\t1*", teams);
    expect(ok.map((r) => r.tie)).toEqual([true, true]);
    expect(ok.map((r) => r.placement)).toEqual([1, 1]);
  });

  it("never marks placement 0 as a tie, even with a star", () => {
    const { ok } = parseBulkResults("FBM\t-*", teams);
    expect(ok[0].tie).toBe(false);
  });

  it("flags a placement outside the allowed range", () => {
    const { problems } = parseBulkResults("FBM\t99", teams);
    expect(problems).toHaveLength(1);
    expect(problems[0].error).toMatch(/Could not read a placement/);
  });

  it("flags a line with no placement at all", () => {
    const { problems } = parseBulkResults("FBM", teams);
    expect(problems).toHaveLength(1);
  });
});

describe("parseBulkResults — duplicate placements", () => {
  it("flags the same placement given to two crews that are not tied", () => {
    const { problems } = parseBulkResults("FBM\t1\nFACET\t1", teams);
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => /used twice/.test(p.error ?? ""))).toBe(true);
    expect(toEntries(problems)).toHaveLength(0);
  });

  it("allows a shared placement when both crews are tied", () => {
    const { problems } = parseBulkResults("FBM\t1*\nFACET\t1*", teams);
    expect(problems).toHaveLength(0);
  });
});

describe("toEntries / toTsv", () => {
  it("emits only resolved rows, in the saveResults shape", () => {
    const { rows } = parseBulkResults("FBM\t1\nNope\t2\nFACET\t-*", teams);
    expect(toEntries(rows)).toEqual([
      { teamId: "fbm", placement: 1, tie: false },
      { teamId: "facet", placement: 0, tie: false },
    ]);
  });

  it("round-trips a grid through TSV", () => {
    const tsv = toTsv([
      { shortName: "FBM", placement: 1, tie: false },
      { shortName: "FACET", placement: 0, tie: false },
      { shortName: "FALS", placement: 2, tie: true },
    ]);
    expect(tsv).toBe("FBM\t1\nFACET\t\nFALS\t2*");
    const { ok } = parseBulkResults(tsv, teams);
    expect(ok.map((r) => [r.teamId, r.placement, r.tie])).toEqual([
      ["fbm", 1, false],
      ["facet", 0, false],
      ["fals", 2, true],
    ]);
  });
});
