import { describe, expect, it } from "vitest";
import { TEAMS } from "@/lib/data/seed";
import { accentFor, contrastRatio, hexToHsl, PANEL_INK } from "@/lib/format";

/**
 * The crews' colours and mascots are not ours to invent — they come from the
 * festival's official "SIGLAKAS 2026 TEAM IDENTITIES" sheet. These lock the
 * agreed values in, so a later refactor cannot quietly drift a crew's identity.
 *
 * FALS is the one exception: the identity sheet leaves BOTH of its colour fields
 * blank, so we keep the green its artwork already uses.
 */
const OFFICIAL: Record<string, { color: string; mascot: string }> = {
  fted: { color: "#1a22a8", mascot: "Phoenix" },
  facet: { color: "#FF5C00", mascot: "Stallion" },
  fahuscic: { color: "#3FC7DD", mascot: "Shark (FaHuSciC Jaws)" },
  fals: { color: "#6FBF5C", mascot: "Python" },
  fbm: { color: "#FFDF00", mascot: "Griffins" },
  fcje: { color: "#FF2C2C", mascot: "Eagle" },
  fnahs: { color: "#C29320", mascot: "Pegasus" },
  siec: { color: "#FFDF22", mascot: "Hornets" },
  tec: { color: "#000000", mascot: "Direwolves" },
  bec: { color: "#8b0000", mascot: "Bulls" },
  bgec: { color: "#59c9ae", mascot: "Bakunawa" },
  cec: { color: "#080d61", mascot: "Kraken" },
};

describe("crew identities", () => {
  it("matches the official identity sheet, crew for crew", () => {
    for (const team of TEAMS) {
      expect({ id: team.id, ...OFFICIAL[team.id] }).toEqual(
        expect.objectContaining({ color: team.color, mascot: team.mascot }),
      );
    }
  });

  it("covers exactly the twelve crews on the sheet", () => {
    expect(TEAMS.map((t) => t.id).sort()).toEqual(Object.keys(OFFICIAL).sort());
  });

  it("corrects the sheet's typo rather than copying it", () => {
    // The sheet prints "Phyton" for FALS. That is a misspelling of Python, not
    // an identity, so it is the one string we deliberately do not reproduce.
    expect(TEAMS.every((t) => !/phyton/i.test(t.mascot))).toBe(true);
    expect(TEAMS.find((t) => t.id === "fals")?.mascot).toBe("Python");
  });

  it("fixes the faculty name typo", () => {
    expect(TEAMS.find((t) => t.id === "fted")?.name).toBe("Faculty of Teacher Education");
  });

  it("stores a valid hex colour for every crew", () => {
    for (const team of TEAMS) {
      expect(team.color, team.id).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    }
  });
});

describe("accent legibility", () => {
  it("makes every crew accent readable on the panel it is drawn on", () => {
    // Three official colours are darker than the navy they sit on, so a 2px
    // border in them would be invisible. Nothing in TEAMS may be left that way.
    for (const team of TEAMS) {
      expect(contrastRatio(accentFor(team.color), PANEL_INK), team.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves a colour that already reads completely alone", () => {
    // Byte-for-byte, so the common case cannot regress by so much as a digit.
    for (const hex of ["#FFDF00", "#59c9ae", "#3FC7DD", "#FF2C2C"]) {
      expect(accentFor(hex)).toBe(hex);
    }
  });

  it("lifts the official colours that would vanish, and only as far as needed", () => {
    for (const hex of ["#000000", "#1a22a8", "#080d61"]) {
      const lifted = accentFor(hex);
      expect(lifted, hex).not.toBe(hex);
      expect(contrastRatio(lifted, PANEL_INK), hex).toBeGreaterThanOrEqual(3);
      // Still just over the bar, not bleached towards white.
      expect(contrastRatio(lifted, PANEL_INK), hex).toBeLessThan(3.6);
    }
  });

  it("keeps the crew's hue, so a lifted colour is still recognisably theirs", () => {
    // Saturation survives the lift too; only lightness is touched.
    const [h0] = hexToHsl("#1a22a8");
    const [h1] = hexToHsl(accentFor("#1a22a8"));
    expect(Math.abs(h1 - h0)).toBeLessThan(2);
  });

  it("returns a colour name unchanged rather than darkening it to white", () => {
    // The identity sheet writes TARRAGONA's secondary as the word "Dim Gray",
    // and a spreadsheet can be hand-typed with anything at all.
    expect(accentFor("Black")).toBe("Black");
    expect(accentFor("")).toBe("");
    expect(accentFor("#12345")).toBe("#12345");
  });
});

describe("hexToHsl", () => {
  it("reads the primaries exactly", () => {
    expect(hexToHsl("#FF0000")).toEqual([0, 1, 0.5]);
    expect(hexToHsl("#00FF00")).toEqual([120, 1, 0.5]);
    expect(hexToHsl("#0000FF")).toEqual([240, 1, 0.5]);
  });

  it("reports pure grey without a hue, and never divides by zero", () => {
    expect(hexToHsl("#000000")).toEqual([0, 0, 0]);
    expect(hexToHsl("#FFFFFF")).toEqual([0, 0, 1]);
    expect(hexToHsl("#808080")).toEqual([0, 0, expect.closeTo(0.502, 2)]);
  });

  it("agrees with the hue the lift preserves", () => {
    // #1a22a8 is a blue at roughly 237 degrees.
    const [h, s, l] = hexToHsl("#1a22a8");
    expect(h).toBeCloseTo(237, 0);
    expect(s).toBeCloseTo(0.73, 1);
    expect(l).toBeCloseTo(0.38, 1);
  });
});
