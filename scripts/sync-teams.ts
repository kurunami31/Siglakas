/**
 * Brings the live `Teams` tab in line with the crew identities in the seed.
 *
 *   npm run sync-teams              preview only, writes nothing
 *   npm run sync-teams -- --apply   write the changes
 *
 * Why this exists: `npm run setup-sheet` deliberately refuses to touch a tab
 * that already holds rows, so it will never update the twelve crews once they
 * are in the sheet — and `--force` would reset Results, Matches and AuditLog
 * along with them. The admin Crews screen can edit them, but only by hand.
 *
 * This goes through the same `upsertTeam` command the admin screen posts, so the
 * result is identical to a Secretariat saving the crews there — including the
 * audit-log entry. Nothing else is touched, and a crew that exists in the sheet
 * but not in the seed is reported, never deleted.
 */
import { loadCredentialsFromEnv } from "../src/lib/data/google";
import { SheetsRepository } from "../src/lib/data/sheets-repo";
import { DEFAULT_CONFIG, TEAMS } from "../src/lib/data/seed";
import type { Team } from "../src/lib/types";

/** The fields a crew identity consists of. `logoUrl` is data, not identity. */
const FIELDS: Array<keyof Team> = ["name", "shortName", "group", "color", "logoFile", "mascot", "motto"];

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const sheetFlag = argv.indexOf("--sheet");
const SHEET_OVERRIDE = sheetFlag >= 0 ? argv[sheetFlag + 1] : undefined;

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
      /* file not present — fine */
    }
  }
}

interface Change {
  id: string;
  current: Team | undefined;
  next: Team;
  fields: Array<keyof Team>;
}

async function main() {
  loadEnvFiles();

  const spreadsheetId = SHEET_OVERRIDE ?? process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    die("GOOGLE_SHEET_ID is not set. Add it to .env.local, or pass --sheet <id>.");
  }
  const creds = loadCredentialsFromEnv();
  if (!creds) {
    die(
      "No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_FILE (path to the .json key)\n" +
        "    or GOOGLE_SERVICE_ACCOUNT_JSON in .env.local.",
    );
  }

  log("");
  log("  Grand Line Tally - crew identity sync");
  log("  ------------------------------------");
  log(`  spreadsheet : ${spreadsheetId}`);
  log(`  service acct: ${creds.client_email}`);
  log(`  mode        : ${APPLY ? "APPLY - writing" : "DRY RUN - nothing will be written"}`);
  log("");

  const repo = new SheetsRepository(spreadsheetId, creds, DEFAULT_CONFIG);
  const raw = await repo.read();
  const live = new Map(raw.teams.map((t) => [t.id, t]));

  // A crew the seed does not know about is somebody's deliberate addition via
  // the admin screen. Report it and leave it alone.
  const strays = raw.teams.filter((t) => !TEAMS.some((s) => s.id === t.id));

  const changes: Change[] = [];
  const missing: Change[] = [];

  for (const seed of TEAMS) {
    const current = live.get(seed.id);
    // `logoUrl` is per-installation (a host URL), so the sheet's value wins and
    // must survive the write — `teamRow` would otherwise blank it.
    const next: Team = { ...seed, logoUrl: current?.logoUrl };
    if (!current) {
      missing.push({ id: seed.id, current, next, fields: FIELDS });
      continue;
    }
    const fields = FIELDS.filter((f) => (current[f] ?? "") !== (next[f] ?? ""));
    if (fields.length) changes.push({ id: seed.id, current, next, fields });
  }

  log(`  ${raw.teams.length} crew(s) in the sheet, ${TEAMS.length} in the seed`);
  if (strays.length) {
    log("");
    log("  ! in the sheet but not in the seed (left untouched):");
    for (const s of strays) log(`      ${s.id.padEnd(9)} ${s.name}`);
  }

  if (missing.length) {
    log("");
    log("  + missing from the sheet entirely (will be appended):");
    for (const c of missing) log(`      ${c.id.padEnd(9)} ${c.next.shortName.padEnd(9)} ${c.next.color}`);
  }

  if (!changes.length && !missing.length) {
    log("");
    log("  Already in sync - nothing to do.");
    log("");
    return;
  }

  log("");
  log("  changes");
  log("  -------");
  for (const c of changes) {
    log(`  ${c.id}`);
    for (const f of c.fields) {
      log(`      ${String(f).padEnd(10)} ${String(c.current?.[f] ?? "(blank)")}  ->  ${String(c.next[f] ?? "(blank)")}`);
    }
  }

  const todo = [...changes, ...missing];
  if (!APPLY) {
    log("");
    log(`  Dry run complete: ${todo.length} crew(s) would change. Re-run with --apply.`);
    log("");
    return;
  }

  log("");
  let done = 0;
  for (const c of todo) {
    // The production command path: atomic padded write + audit entry, exactly as
    // the admin Crews screen produces.
    await repo.apply({ type: "upsertTeam", team: c.next, actor: "sync-teams" });
    done++;
    log(`  saved  ${c.id}`);
  }

  // Read back rather than trusting the writes.
  const after = await repo.read();
  const afterById = new Map(after.teams.map((t) => [t.id, t]));
  const wrong: string[] = [];
  for (const seed of TEAMS) {
    const t = afterById.get(seed.id);
    if (!t) {
      wrong.push(`${seed.id}: missing after write`);
      continue;
    }
    for (const f of FIELDS) {
      if ((t[f] ?? "") !== (seed[f] ?? "")) {
        wrong.push(`${seed.id}.${String(f)}: sheet has "${String(t[f])}", expected "${String(seed[f])}"`);
      }
    }
  }

  log("");
  log(`  ${done} crew(s) written, ${after.teams.length} now in the sheet`);
  if (wrong.length) {
    log("");
    log("  x read-back does not match the seed:");
    for (const w of wrong) log(`      ${w}`);
    log("");
    process.exitCode = 1;
    return;
  }
  log("  read-back OK - every crew matches the seed.");
  log("");
}

main().catch((err) => {
  console.error("\n  x sync-teams failed:", msg(err), "\n");
  process.exit(1);
});
