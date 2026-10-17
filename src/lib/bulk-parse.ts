/**
 * Parser for spreadsheet pastes.
 *
 * The Secretariat works in Excel/Sheets and would rather paste a whole event's
 * placements once than retype twelve dropdowns. This module turns that paste
 * into structured rows and reports everything it could not resolve, so nothing
 * is ever saved by guesswork.
 *
 * Pure and dependency-free: the grading rules live in tests/bulk-parse.test.ts.
 */

export interface TeamLite {
  id: string;
  shortName: string;
  name: string;
  mascot: string;
}

export interface ParsedRow {
  /** 1-based line number in the pasted text. */
  line: number;
  raw: string;
  /** Resolved crew, or null when the name could not be matched. */
  teamId: string | null;
  /** 1..30, or 0 for "not placed / participation". */
  placement: number;
  tie: boolean;
  error?: string;
}

export interface ParseSummary {
  rows: ParsedRow[];
  /** Rows that resolved cleanly. */
  ok: ParsedRow[];
  /** Rows with a problem, plus duplicate-placement warnings. */
  problems: ParsedRow[];
}

/** Casefold and strip punctuation so "St. Paul" and "st paul" collide. */
function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const NOT_PLACED = /^(?:[-–—]+|none|nil|dnp|abs|absent|na|n\/a)$/i;
const TIE_MARK = /[*=]|\(\s*tie\s*\)$/i;

/** Lines that are actually a header row get skipped rather than flagged. */
function looksLikeHeader(line: string): boolean {
  return /(?:place|placement|rank|position)/i.test(line) && /(?:crew|team|island|name|faculty|campus)/i.test(line);
}

function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/);
  return line.split(/\s+/);
}

interface PlacementToken {
  placement: number;
  tie: boolean;
  measured: boolean;
}

function readPlacement(raw: string): PlacementToken | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip the tie marker first so "-*" still reads as "not placed".
  const tie = TIE_MARK.test(trimmed);
  const core = trimmed
    .replace(/[*=]\s*$/, "")
    .replace(/\(\s*tie\s*\)\s*$/i, "")
    .trim();
  if (!core) return null;
  if (NOT_PLACED.test(core)) return { placement: 0, tie: false, measured: true };

  const digits = core.match(/\d+/);
  if (!digits) return null;

  const placement = Number(digits[0]);
  if (!Number.isInteger(placement) || placement < 0 || placement > 30) return null;
  return { placement, tie: tie && placement > 0, measured: true };
}

/**
 * Parse a pasted block. Accepts `crew<TAB>place` and `place<TAB>crew` in any
 * order, separated by tabs, commas, double spaces or a single space.
 */
export function parseBulkResults(text: string, teams: TeamLite[]): ParseSummary {
  const lookup = new Map<string, string[]>();
  const add = (key: string, id: string) => {
    const k = norm(key);
    if (!k) return;
    const bucket = lookup.get(k);
    if (bucket) {
      if (!bucket.includes(id)) bucket.push(id);
    } else {
      lookup.set(k, [id]);
    }
  };
  for (const t of teams) {
    add(t.id, t.id);
    add(t.shortName, t.id);
    add(t.name, t.id);
    if (t.mascot) {
      add(t.mascot, t.id);
      add(`the ${t.mascot}`, t.id);
    }
  }

  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    if (looksLikeHeader(raw)) return;

    const lineNo = i + 1;
    // Split the *untrimmed* line so a trailing tab survives as "not placed".
    const rawCells = splitCells(line).map((c) => c.trim());
    const cells = rawCells.filter((c) => c.length > 0);
    // "FACET<TAB>" means "FACET, not placed" — the empty cell is meaningful.
    const emptyPlacement = cells.length === 1 && rawCells.length >= 2;

    let crewPart = "";
    let placePart = "";
    let placement: PlacementToken | null = null;
    let error: string | undefined;

    if (emptyPlacement) {
      crewPart = cells[0];
      placement = { placement: 0, tie: false, measured: true };
    } else if (cells.length >= 2) {
      // Whichever end reads as a placement is the placement; the rest is a name
      // (so both "FBM 1" and "1 FBM" work, as do names containing spaces).
      const head = readPlacement(cells[0]);
      const tail = readPlacement(cells[cells.length - 1]);
      if (head && !tail) {
        placePart = cells[0];
        crewPart = cells.slice(1).join(" ");
      } else if (tail) {
        placePart = cells[cells.length - 1];
        crewPart = cells.slice(0, -1).join(" ");
      } else if (head) {
        placePart = cells[0];
        crewPart = cells.slice(1).join(" ");
      } else {
        crewPart = cells.slice(0, -1).join(" ");
        placePart = cells[cells.length - 1];
      }
    } else {
      // A single cell: try "name place" / "place name", else treat as a name.
      const m = raw.match(/^(.*?)[\s]+([-–—]+|\d{1,2}[*=]?|none|nil|dnp|abs|na|n\/a)$/i);
      if (m) {
        crewPart = m[1];
        placePart = m[2];
      } else {
        crewPart = raw;
        placePart = "";
      }
    }

    placement = placement ?? readPlacement(placePart);
    let teamId: string | null = null;
    let tie = false;

    if (!crewPart.trim()) {
      error = "No crew name in this line.";
    } else {
      const matches = lookup.get(norm(crewPart));
      if (!matches || matches.length === 0) {
        error = `Unknown crew "${crewPart.trim()}".`;
      } else if (matches.length > 1) {
        error = `"${crewPart.trim()}" matches more than one crew.`;
      } else {
        teamId = matches[0];
      }
    }

    if (!error && !placement) {
      error = `Could not read a placement from "${placePart.trim() || raw}".`;
    }

    rows.push({
      line: lineNo,
      raw,
      teamId,
      placement: placement?.placement ?? 0,
      tie: placement?.tie ?? false,
      error,
    });
  });

  const ok = rows.filter((r) => !r.error);

  // The grid only allows one crew per placement unless a tie is declared, so
  // surface clashes here instead of letting the save silently overwrite.
  const seen = new Map<number, ParsedRow>();
  for (const r of ok) {
    if (r.placement < 1 || r.tie) continue;
    const first = seen.get(r.placement);
    if (first) {
      const msg = `Placement ${r.placement} is used twice (line ${first.line} and line ${r.line}) — mark one as a tie.`;
      if (!first.error) first.error = msg;
      r.error = msg;
    } else {
      seen.set(r.placement, r);
    }
  }

  return { rows, ok, problems: rows.filter((r) => r.error) };
}

export interface BulkEntry {
  teamId: string;
  placement: number;
  tie: boolean;
}

/** Collapse parsed rows into the shape `saveResults` expects. */
export function toEntries(rows: ParsedRow[]): BulkEntry[] {
  return rows
    .filter((r): r is ParsedRow & { teamId: string } => Boolean(r.teamId) && !r.error)
    .map((r) => ({ teamId: r.teamId, placement: r.placement, tie: r.tie }));
}

/** Serialise the current grid so it can be pasted into Excel for editing. */
export function toTsv(rows: Array<{ shortName: string; placement: number; tie: boolean }>): string {
  return rows.map((r) => `${r.shortName}\t${r.placement > 0 ? r.placement : ""}${r.tie ? "*" : ""}`).join("\n");
}
