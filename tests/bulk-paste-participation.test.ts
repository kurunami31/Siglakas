import { describe, expect, it } from "vitest";
import { parseBulkResults } from "@/lib/bulk-parse";

/**
 * Participation events (FUN RUN, FUNEBALL) paste a HEADCOUNT, not a placing.
 * The parser is shared, so these pin down that the per-call limits actually
 * change behaviour — the same text must be valid for one event type and invalid
 * for the other.
 */

const teams = [
  { id: "fted", shortName: "FTED", name: "Faculty of Teacher Education", mascot: "Blue Phoenix" },
  { id: "facet", shortName: "FACET", name: "Faculty of Computing", mascot: "Orange Stallion" },
];

const asParticipation = { maxPlacement: 500, allowDuplicates: true };

describe("participation counts in bulk paste", () => {
  it("accepts a headcount above the placement ceiling", () => {
    const { ok, problems } = parseBulkResults("FTED 40\nFACET 52", teams, asParticipation);
    expect(problems).toEqual([]);
    expect(ok.map((r) => r.placement)).toEqual([40, 52]);
  });

  it("does not treat a shared headcount as a duplicate placing", () => {
    // Two crews with eight runners is normal; it used to be reported as a clash
    // and blocked the whole paste.
    const { problems } = parseBulkResults("FTED 8\nFACET 8", teams, asParticipation);
    expect(problems).toEqual([]);
  });
});

describe("normal placement paste is unchanged", () => {
  it("still refuses a placing that is out of range", () => {
    const { ok, problems } = parseBulkResults("FTED 100", teams);
    expect(ok).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0].error).toContain("out of range");
  });

  it("still flags a genuine duplicate placing", () => {
    const { problems } = parseBulkResults("FTED 1\nFACET 1", teams);
    expect(problems).toHaveLength(2);
    expect(problems[0].error).toContain("used twice");
  });

  it("still accepts an ordinary placing", () => {
    const { ok, problems } = parseBulkResults("FTED 1\nFACET 2", teams);
    expect(problems).toEqual([]);
    expect(ok).toHaveLength(2);
  });

  it("keeps reporting rows that passed even when a duplicate is flagged", () => {
    // `ok` must be recomputed AFTER the duplicate pass, or a row carrying an
    // error would still be offered as clean.
    const { ok, problems } = parseBulkResults("FTED 1\nFACET 1\nBEC 3", teams);
    expect(ok.some((r) => r.error)).toBe(false);
    expect(problems.length).toBeGreaterThan(0);
  });
});
