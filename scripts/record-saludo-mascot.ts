/**
 * Records the official results of the two SIGLAKAS 2026 competitions whose
 * tallies are final: the SALUDO and the MASCOT.
 *
 *   npm run record-saludo-mascot              preview only, writes nothing
 *   npm run record-saludo-mascot -- --apply   write the changes
 *
 * Sources (both in the repo root, deliberately gitignored):
 *   OVERALL-SALUDO.pdf         3 judges, points out of 100. TOTAL is their mean,
 *                              "TOTAL WITH DEDUCTIONS" decides the rank, highest
 *                              wins, ties share a rank.
 *   OVERALL-MASCOT.pdf         3 judges, RANKS. TOTAL is their sum and the
 *                              LOWEST wins, ties share a rank.
 *
 * The blank judge sheet for the Mascot (the photographed form) scores the five
 * criteria out of 100, which is exactly what `computeJudgedStandings` would do —
 * but the official overall tally aggregates the three judges by SUMMING THEIR
 * RANKS, lowest first, which the app has no equivalent for. The Saludo's tally
 * has the same gap in reverse: it is a mean of the judges' points, but with a
 * "TOTAL WITH DEDUCTIONS" step the app cannot express.
 *
 * That is why both are recorded here as final placements rather than scored in
 * the app: the published result is authoritative, and reproducing either
 * aggregation would be a change to the scoring engine, not a data load.
 *
 * The tallies carry no names, only "ENTRY NO", so the mapping below had to come
 * from the Secretariat. It is a single shared draw and applies to both.
 *
 * This records RESULTS ONLY. It does not build judge entry, rank-sum scoring or
 * the Saludo's deduction column; those are not needed to publish a final result.
 */
import { loadCredentialsFromEnv } from "../src/lib/data/google";
import { SheetsRepository } from "../src/lib/data/sheets-repo";
import { DEFAULT_CONFIG } from "../src/lib/data/seed";
import { deriveState } from "../src/lib/data/derive";
import type { Command, ResultRowInput } from "../src/lib/data/repo";
import type { Criterion, EventItem } from "../src/lib/types";

const APPLY = process.argv.includes("--apply");
const actor = "record-saludo-mascot";

const log = (msg = "") => console.log(msg);
const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

function die(message: string): never {
  console.error(`\n  x ${message}\n`);
  process.exit(1);
}

/** Standalone scripts don't get Next's automatic .env loading. */
function loadEnvFiles() {
  const loader = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (!loader) return;
  for (const file of [".env.local", ".env"]) {
    try {
      loader(file);
    } catch {
      /* not present — fine */
    }
  }
}

/** Official draw: entry number -> crew id. Supplied by the Secretariat. */
const ENTRY: Record<number, string> = {
  1: "fahuscic",
  2: "tec",
  3: "fbm",
  4: "cec",
  5: "fals",
  6: "bec",
  7: "bgec",
  8: "fcje",
  9: "fnahs",
  10: "fted",
  11: "siec",
  12: "facet",
};

/** [entry, placement, declared tie] — transcribed from each tally's RANKS column. */
const SALUDO_PLACEMENTS: Array<[number, number, boolean]> = [
  [1, 11, false],
  [2, 5, false],
  [3, 2, false],
  [4, 12, false],
  [5, 3, false],
  [6, 7, false],
  [7, 9, true], // 79.6667, shared with entry 11
  [8, 8, false],
  [9, 1, false],
  [10, 4, false],
  [11, 9, true],
  [12, 6, false],
];

const MASCOT_PLACEMENTS: Array<[number, number, boolean]> = [
  [1, 5, false],
  [2, 6, true], // total 15, shared with entries 7, 10 and 11
  [3, 1, false],
  [4, 12, false],
  [5, 11, false],
  [6, 3, false],
  [7, 6, true],
  [8, 2, false],
  [9, 4, false],
  [10, 6, true],
  [11, 6, true],
  [12, 10, false],
];

const SALUDO_EVENT: EventItem = {
  id: "saludo",
  name: "Saludo",
  division: "cultural",
  category: "Special Category",
  scoringType: "judged",
  medalWeight: 2,
  gender: "Open",
  multiplier: 1,
  status: "finished",
  locked: false,
};

const SALUDO_CRITERIA: Array<[string, number]> = [
  ["Execution & Synchronization", 35],
  ["Energy and Showmanship", 30],
  ["Creativity & Choreography", 25],
  ["Overall Impact", 10],
];

const MASCOT_CRITERIA: Array<[string, number]> = [
  ["Creativity and Design", 30],
  ["Performance and Animation", 25],
  ["Characterization", 20],
  ["Audience Impact", 15],
  ["Overall Execution", 10],
];

/** Medals these two events should put on the board, and nothing else. */
const EXPECTED_MEDALS: Record<string, { gold: number; silver: number; bronze: number }> = {
  fbm: { gold: 3, silver: 2, bronze: 0 },
  fnahs: { gold: 2, silver: 0, bronze: 0 },
  fcje: { gold: 0, silver: 3, bronze: 0 },
  bec: { gold: 0, silver: 0, bronze: 3 },
  fals: { gold: 0, silver: 0, bronze: 2 },
};

const rowsFor = (placements: Array<[number, number, boolean]>): ResultRowInput[] =>
  placements.map(([entry, placement, tie]) => ({
    teamId: ENTRY[entry],
    placement,
    tie,
    status: "published" as const,
  }));

const criteriaFor = (eventId: string, pairs: Array<[string, number]>): Criterion[] =>
  pairs.map(([criterion, weight], order) => ({ eventId, criterion, weight, order }));

function loadEnvAndRepo(): SheetsRepository {
  loadEnvFiles();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) die("GOOGLE_SHEET_ID is not set. Add it to .env.local.");
  const creds = loadCredentialsFromEnv();
  if (!creds) die("No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_FILE or _JSON.");
  log(`  spreadsheet : ${spreadsheetId}`);
  log(`  service acct: ${creds.client_email}`);
  return new SheetsRepository(spreadsheetId, creds, DEFAULT_CONFIG);
}

async function main() {
  log("");
  log("  Grand Line Tally - record official Saludo + Mascot results");
  log("  --------------------------------------------------------");
  const repo = loadEnvAndRepo();
  log(`  mode        : ${APPLY ? "APPLY - writing" : "DRY RUN - nothing will be written"}`);
  log("");

  const raw = await repo.read();
  const commands: Array<{ label: string; command: Command }> = [];

  /* 1. the Saludo event itself */
  const live = raw.events.find((e) => e.id === SALUDO_EVENT.id);
  if (!live) {
    commands.push({ label: "create the Saludo event", command: { type: "upsertEvent", event: SALUDO_EVENT, actor } });
  } else {
    const diffs = (["name", "division", "category", "scoringType", "medalWeight", "gender", "multiplier"] as const)
      .filter((f) => live[f] !== SALUDO_EVENT[f])
      .map((f) => `${f}: ${String(live[f])} -> ${String(SALUDO_EVENT[f])}`);
    if (diffs.length) {
      commands.push({ label: `update the Saludo event (${diffs.join("; ")})`, command: { type: "upsertEvent", event: { ...live, ...SALUDO_EVENT }, actor } });
    }
  }

  /* 2. both events are finished — the tallies are final */
  for (const id of ["saludo", "mascot"]) {
    const ev = id === "saludo" ? (live ?? SALUDO_EVENT) : raw.events.find((e) => e.id === id);
    if (ev && ev.status !== "finished") {
      commands.push({ label: `mark ${id} finished`, command: { type: "updateEvent", id, patch: { status: "finished" }, actor } });
    }
  }

  /* 3. criteria */
  const criteriaPlan: Array<[string, Array<[string, number]>]> = [
    ["saludo", SALUDO_CRITERIA],
    ["mascot", MASCOT_CRITERIA],
  ];
  for (const [eventId, pairs] of criteriaPlan) {
    const want = criteriaFor(eventId, pairs);
    const have = raw.criteria
      .filter((c) => c.eventId === eventId)
      .sort((a, b) => a.order - b.order);
    const same =
      have.length === want.length &&
      have.every((c, i) => c.criterion === want[i].criterion && c.weight === want[i].weight);
    if (!same) {
      commands.push({
        label:
          `set ${eventId} criteria (${have.map((c) => `${c.criterion} ${c.weight}`).join(", ") || "none"}` +
          ` -> ${want.map((c) => `${c.criterion} ${c.weight}`).join(", ")})`,
        command: { type: "saveCriteria", eventId, rows: want, actor },
      });
    }
  }

  /* 4. results */
  const resultsPlan: Array<[string, ResultRowInput[]]> = [
    ["saludo", rowsFor(SALUDO_PLACEMENTS)],
    ["mascot", rowsFor(MASCOT_PLACEMENTS)],
  ];
  for (const [eventId, rows] of resultsPlan) {
    const have = raw.results.filter((r) => r.eventId === eventId);
    const same =
      have.length === rows.length &&
      rows.every((w) => {
        const h = have.find((r) => r.teamId === w.teamId);
        return h && h.placement === w.placement && h.tie === w.tie && h.status === w.status;
      });
    if (!same) {
      commands.push({
        label: `record ${eventId} results (${have.length} row(s) -> ${rows.length})`,
        command: { type: "saveResults", eventId, rows, actor },
      });
    }
  }

  /* 5. report */
  if (!commands.length) {
    log("  Already recorded - nothing to do.");
    log("");
    return;
  }

  log("  planned changes");
  log("  ---------------");
  for (const { label } of commands) log(`    ${label}`);
  log("");

  if (!APPLY) {
    log("  Dry run complete. Re-run with --apply to write.");
    log("");
    return;
  }

  for (const { label, command } of commands) {
    await repo.apply(command);
    log(`  applied  ${label}`);
  }

  /* 6. read back and verify — including what lands on the medal board */
  const after = await repo.read();
  const problems: string[] = [];

  const ev = after.events.find((e) => e.id === "saludo");
  if (!ev) problems.push("saludo event is missing after the write");
  else if (ev.medalWeight !== 2) problems.push(`saludo medalWeight is ${ev.medalWeight}, expected 2`);

  for (const id of ["saludo", "mascot"]) {
    const e = after.events.find((x) => x.id === id);
    if (e && e.status !== "finished") problems.push(`${id} status is ${e.status}, expected finished`);
  }

  for (const [eventId, rows] of resultsPlan) {
    for (const w of rows) {
      const h = after.results.find((r) => r.eventId === eventId && r.teamId === w.teamId);
      if (!h) problems.push(`${eventId}: no result recorded for ${w.teamId}`);
      else if (h.placement !== w.placement || h.tie !== w.tie) {
        problems.push(`${eventId}/${w.teamId}: sheet has ${h.placement}${h.tie ? "*" : ""}, expected ${w.placement}${w.tie ? "*" : ""}`);
      }
    }
  }

  const standings = deriveState(after).standings;
  for (const team of after.teams) {
    const want = EXPECTED_MEDALS[team.id] ?? { gold: 0, silver: 0, bronze: 0 };
    const got = standings.find((s) => s.teamId === team.id)?.overall ?? { gold: 0, silver: 0, bronze: 0 };
    if (got.gold !== want.gold || got.silver !== want.silver || got.bronze !== want.bronze) {
      problems.push(
        `${team.id} medals: board says ${got.gold}g/${got.silver}s/${got.bronze}b, expected ${want.gold}g/${want.silver}s/${want.bronze}b`,
      );
    }
  }

  log("");
  if (problems.length) {
    log("  x read-back does not match:");
    for (const p of problems) log(`      ${p}`);
    log("");
    process.exitCode = 1;
    return;
  }
  log("  read-back OK - events, criteria, results and the medal board all match.");
  log("");
}

main().catch((err) => {
  console.error("\n  x record-saludo-mascot failed:", msg(err), "\n");
  process.exit(1);
});
