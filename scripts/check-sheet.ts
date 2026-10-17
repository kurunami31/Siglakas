/**
 * Health-check for the Grand Line Tally spreadsheet.
 *
 *   npm run check-sheet
 *
 * Read-only. Verifies the sheet is structurally sane before competition day:
 * every tab present with the right headers, no blank or duplicate event ids,
 * judging criteria that add up to 100, the expected medal totals, and the
 * Championship rule matching the SIGLAKAS manual.
 *
 * Exits non-zero if anything is wrong, so it can gate a deploy.
 */
import { loadCredentialsFromEnv, parseAoa, SheetsClient } from "../src/lib/data/google";
import { HEADERS, TABS } from "../src/lib/data/sheets-repo";

const EXPECTED_EVENTS = 97;
const EXPECTED_TEAMS = 12;
const EXPECTED_MEDALS = 488; // sports 324 + socio-cultural 164

function loadEnvFiles() {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (!loader) return;
  for (const f of [".env.local", ".env"]) {
    try {
      loader(f);
    } catch {
      /* not present */
    }
  }
}

async function main() {
  loadEnvFiles();

  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    console.error("\n  x GOOGLE_SHEET_ID is not set.\n");
    process.exit(1);
  }
  const creds = loadCredentialsFromEnv();
  if (!creds) {
    console.error("\n  x No credentials. Set GOOGLE_SERVICE_ACCOUNT_FILE in .env.local.\n");
    process.exit(1);
  }

  const client = new SheetsClient(id, creds);
  const keys = Object.keys(TABS) as Array<keyof typeof TABS>;
  const read = await client.batchGet(keys.map((k) => `${TABS[k]}!A1:Z`));

  const problems: string[] = [];
  const warnings: string[] = [];

  console.log("");
  console.log("  Grand Line Tally - spreadsheet health check");
  console.log("  -------------------------------------------");

  const tables: Record<string, Record<string, string>[]> = {};
  for (const k of keys) {
    const { headers, rows } = parseAoa(read[TABS[k]] ?? []);
    tables[k] = rows;
    const headerOk = headers.join("|") === HEADERS[k].join("|");
    if (!headerOk) problems.push(`${TABS[k]}: header row does not match (found: ${headers.join(", ")})`);
    console.log(`  ${TABS[k].padEnd(14)} ${String(rows.length).padStart(5)} rows${headerOk ? "" : "   <- HEADER MISMATCH"}`);
  }

  const teams = tables.teams ?? [];
  const events = tables.events ?? [];
  const criteria = tables.criteria ?? [];
  const config = tables.config ?? [];
  const get = (key: string) => config.find((r) => r.key === key)?.value ?? "";

  // events
  if (events.length !== EXPECTED_EVENTS) {
    problems.push(`Events: expected ${EXPECTED_EVENTS} rows, found ${events.length}`);
  }
  const blankIds = events.filter((e) => !e.id || e.id.trim() === "");
  if (blankIds.length) problems.push(`Events: ${blankIds.length} row(s) with a blank id (orphan rows?)`);
  const dupes = events.length - new Set(events.map((e) => e.id)).size;
  if (dupes) problems.push(`Events: ${dupes} duplicate event id(s)`);
  const medals = events.reduce((s, e) => s + Number(e.medal_weight || 0), 0);
  if (medals !== EXPECTED_MEDALS) {
    problems.push(`Events: medal total is ${medals}, expected ${EXPECTED_MEDALS}`);
  }

  // teams
  if (teams.length !== EXPECTED_TEAMS) {
    problems.push(`Teams: expected ${EXPECTED_TEAMS} rows, found ${teams.length}`);
  }

  // criteria
  for (const eventId of [...new Set(criteria.map((c) => c.event_id))]) {
    const sum = criteria
      .filter((c) => c.event_id === eventId)
      .reduce((s, c) => s + Number(c.weight || 0), 0);
    if (Math.abs(sum - 100) > 0.01) warnings.push(`Criteria for "${eventId}" sum to ${sum}, not 100`);
  }
  const judgedNoCriteria = events
    .filter((e) => e.scoring_type === "judged")
    .filter((e) => !criteria.some((c) => c.event_id === e.id));
  if (judgedNoCriteria.length) {
    problems.push(`Judged events with no criteria: ${judgedNoCriteria.map((e) => e.id).join(", ")}`);
  }

  // results + matches reference event/team ids by hand. The scorer resolves
  // them with `continue`, so a mistyped id is dropped *silently* — the most
  // dangerous failure mode during the event, and the reason these are reported
  // as PROBLEMS rather than warnings.
  const results = tables.results ?? [];
  const matches = tables.matches ?? [];
  const teamIds = new Set(teams.map((t) => t.id));
  const eventIds = new Set(events.map((e) => e.id));

  const orphans: string[] = [];
  for (const r of results) {
    if (!eventIds.has(r.event_id)) orphans.push(`Results: unknown event_id "${r.event_id}"`);
    else if (!teamIds.has(r.team_id)) orphans.push(`Results: unknown team_id "${r.team_id}" in ${r.event_id}`);
  }
  for (const m of matches) {
    if (!eventIds.has(m.event_id)) orphans.push(`Matches: unknown event_id "${m.event_id}"`);
    for (const field of ["team_a", "team_b", "winner"]) {
      const value = (m[field] ?? "").trim();
      if (value && !teamIds.has(value)) orphans.push(`Matches: unknown ${field} "${value}" in ${m.id || "(no id)"}`);
    }
  }
  if (orphans.length) {
    problems.push(
      `${orphans.length} row(s) reference an unknown id and would be silently ignored — ` +
        orphans.slice(0, 5).join("; ") +
        (orphans.length > 5 ? ` (+${orphans.length - 5} more)` : ""),
    );
  }

  // Only "published" counts towards the board; anything else is a draft.
  const badStatus = results.filter((r) => !["draft", "published"].includes((r.status ?? "").toLowerCase()));
  if (badStatus.length) {
    problems.push(`${badStatus.length} result row(s) have an unrecognised status (only draft/published count)`);
  }

  // config
  const rankBy = get("championship_rank_by");
  if (rankBy !== "gold_first") {
    warnings.push(`championship_rank_by is "${rankBy}" — both SIGLAKAS manuals award the title on most golds`);
  }
  if (!get("competition_name")) problems.push("Config: competition_name is empty");

  // events flagged for verification
  const flagged = events.filter((e) => (e.verify ?? "").toUpperCase() === "TRUE");
  if (flagged.length) {
    warnings.push(`${flagged.length} event(s) still flagged "verify": ${flagged.map((e) => e.id).join(", ")}`);
  }

  console.log("");
  if (warnings.length) {
    console.log("  warnings");
    for (const w of warnings) console.log(`   - ${w}`);
    console.log("");
  }
  if (problems.length) {
    console.log("  PROBLEMS");
    for (const p of problems) console.log(`   x ${p}`);
    console.log("");
    process.exit(1);
  }

  console.log(`  OK - ${teams.length} crews, ${events.length} events, ${medals} medals at stake`);
  console.log("");
}

main().catch((err) => {
  console.error("\n  x check failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
