import type { Team } from "./types";

/**
 * Parser for pasted fixtures, e.g. a whole round typed in one go:
 *
 *     FTED 2 - 0 FACET
 *     FBM  1 - 2 FCJE
 *     CEC  vs  SIEC                 (scheduled, no score yet)
 *     B-LEC 3-1 TEC | 11-8, 11-9     (optional per-set detail after a pipe)
 *
 * Crews are resolved by id, short name, mascot or full name, case- and
 * punctuation-insensitive, so "Phoenix", "phoenix" and "fted" all find
 * FTED. Anything unresolvable is reported rather than silently dropped — the
 * whole point of the admin data-quality work is that a fixture which cannot be
 * matched scores nothing and says nothing.
 */

export interface ParsedFixture {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  detail?: string;
  /** True when the line carried no score, i.e. a fixture not played yet. */
  scheduled: boolean;
}

export interface ParseProblem {
  line: number;
  text: string;
  message: string;
}

const norm = (value: string): string => (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function buildResolver(teams: Team[]): (token: string) => string | null {
  const index = new Map<string, string>();
  const add = (key: string, id: string) => {
    const k = norm(key);
    if (k && !index.has(k)) index.set(k, id);
  };
  for (const t of teams) {
    add(t.id, t.id);
    add(t.shortName, t.id);
    add(t.mascot, t.id);
    add(t.name, t.id);
    // The leaderboard renders "The {mascot}", the mascot column does not, so the
    // prefixed form has to resolve too.
    add(`the ${t.mascot}`, t.id);
  }
  return (token: string) => index.get(norm(token)) ?? null;
}

export function parseMatchLines(input: string, teams: Team[]): { fixtures: ParsedFixture[]; problems: ParseProblem[] } {
  const resolve = buildResolver(teams);
  const fixtures: ParsedFixture[] = [];
  const problems: ParseProblem[] = [];
  const seen = new Set<string>();

  input
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      const lineNo = i + 1;

      // Optional per-set detail after a pipe.
      const [mainPart, ...detailParts] = line.split("|");
      const detail = detailParts.join("|").trim() || undefined;

      const parts = mainPart.trim().split(/\s+/);
      if (parts.length < 2) {
        problems.push({ line: lineNo, text: line, message: "Expected two crews on this line." });
        return;
      }

      // Crews are multi-word in practice — "Shark (FaHuSciC Jaws)", "Faculty of
      // Business Management" — so match the LONGEST phrase from each end that resolves to
      // a crew, and treat whatever is left in between as the score. Assuming a
      // single token per crew silently failed on exactly the names people use.
      const MAX_WORDS = 6;
      let aEnd = 0;
      let teamA: string | null = null;
      for (let n = Math.min(MAX_WORDS, parts.length - 1); n >= 1; n--) {
        const hit = resolve(parts.slice(0, n).join(" "));
        if (hit) {
          aEnd = n;
          teamA = hit;
          break;
        }
      }
      let bStart = parts.length;
      let teamB: string | null = null;
      for (let n = Math.min(MAX_WORDS, parts.length - 1); n >= 1; n--) {
        const start = parts.length - n;
        // Longest suffix first, so a phrase that would overlap crew A must be
        // skipped rather than aborting the search — `break` here made multi-word
        // crew names unresolvable.
        if (start < aEnd) continue;
        const hit = resolve(parts.slice(start).join(" "));
        if (hit) {
          bStart = start;
          teamB = hit;
          break;
        }
      }

      if (!teamA) {
        problems.push({ line: lineNo, text: line, message: `"${parts[0]}" is not a crew.` });
        return;
      }
      if (!teamB) {
        problems.push({ line: lineNo, text: line, message: `"${parts[parts.length - 1]}" is not a crew.` });
        return;
      }
      if (bStart <= aEnd) {
        problems.push({ line: lineNo, text: line, message: "Could not tell the two crews apart." });
        return;
      }
      if (teamA === teamB) {
        problems.push({ line: lineNo, text: line, message: "A crew cannot play itself." });
        return;
      }

      const middle = parts.slice(aEnd, bStart);

      let scoreA = 0;
      let scoreB = 0;
      let scheduled = false;
      const scoreText = middle.join(" ").replace(/\s*[-–—:x]\s*/gi, "-").trim();

      if (scoreText === "" || norm(scoreText) === "vs" || norm(scoreText) === "v") {
        scheduled = true;
      } else if (/^\d+-\d+$/.test(scoreText)) {
        const [a, b] = scoreText.split("-").map(Number);
        scoreA = a;
        scoreB = b;
      } else if (/^\d+\s+\d+$/.test(middle.join(" ").trim())) {
        const [a, b] = middle.join(" ").trim().split(/\s+/).map(Number);
        scoreA = a;
        scoreB = b;
      } else {
        problems.push({
          line: lineNo,
          text: line,
          message: `Could not read a score from "${middle.join(" ")}" — write it as 2-0 or 2 0.`,
        });
        return;
      }

      const key = `${teamA}-${teamB}`;
      if (seen.has(key)) {
        problems.push({ line: lineNo, text: line, message: "The same pairing appears twice; only the last would survive." });
        return;
      }
      seen.add(key);

      fixtures.push({ teamA, teamB, scoreA, scoreB, detail, scheduled });
    });

  return { fixtures, problems };
}

/**
 * The key the app uses for a fixture, so re-pasting the same round updates the
 * existing rows instead of creating duplicates.
 */
export function fixtureId(eventId: string, round: string, teamA: string, teamB: string): string {
  const slug = (round || "round").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${eventId}--${slug || "round"}--${teamA}-${teamB}`;
}
