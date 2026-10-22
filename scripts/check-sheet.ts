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
import { teamResolver } from "../src/lib/data/derive";

const EXPECTED_EVENTS = 109;
const EXPECTED_TEAMS = 12;
// sports 266 + socio-cultural 160. Four changes from the original manual figures:
// Live Band's weight was confirmed at 5 (was 9); FUN RUN / FUNEBALL became
// participation events whose weight is 1 (they were 50 and 10), because their
// golds come from each crew's participant count rather than a fixed weight; the
// Saludo (2) was added as a competition of its own, which the printed
// socio-cultural point system predates; and Dance Sports became twelve
// disciplines at weight 1 rather than one event at 14, matching the committee's
// own result sheet. Changing a weight means keeping the Guide text in
// beautify-sheet.ts and the docs in step too.
const EXPECTED_MEDALS = 426;

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
    // The app's own columns must match, in order — but the sheet is allowed
    // extra TRAILING columns the app does not manage, e.g. the `note` column the
    // Secretariat added to Results to annotate rows. Those are reported, not
    // treated as a fault, and app writes only ever touch the columns before them.
    const missing = HEADERS[k].filter((h, i) => headers[i] !== h);
    const headerOk = missing.length === 0;
    const extra = headers.slice(HEADERS[k].length).filter((h) => h && h.trim() !== "");
    if (!headerOk) problems.push(`${TABS[k]}: header row does not match (found: ${headers.join(", ")})`);
    console.log(
      `  ${TABS[k].padEnd(14)} ${String(rows.length).padStart(5)} rows` +
        (extra.length ? `   (+${extra.length} extra: ${extra.join(", ")})` : ""),
    );
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
  // A WARNING, not a problem. This figure legitimately changes whenever the
  // Secretariat confirms an event weight, so failing the gate on it produced
  // false alarms — but it is still worth surfacing, because a silently truncated
  // Events tab would show up here as a collapse in the total.
  if (medals !== EXPECTED_MEDALS) {
    warnings.push(
      `Events: medal total is ${medals}; the documented figure is ${EXPECTED_MEDALS}. ` +
        "If a weight changed deliberately, update EXPECTED_MEDALS and the docs.",
    );
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

  // A crew may be named by id, short name or full name — the app resolves all
  // three (see `teamResolver` in derive.ts), so `B-LEC` in the team_id column is
  // legitimate and must not be reported. Only a value that resolves to no crew
  // is a problem, and a blank one still is.
  const teamLookup = teamResolver(
    teams.map((t) => ({ id: t.id, shortName: t.short_name, name: t.name, mascot: t.mascot })),
  );
  const resolves = (value: string) => teamIds.has(teamLookup((value ?? "").trim()));

  const orphans: string[] = [];
  for (const r of results) {
    if (!eventIds.has(r.event_id)) {
      orphans.push(`Results: unknown event_id "${r.event_id}"`);
      continue;
    }
    if (!(r.team_id ?? "").trim()) orphans.push(`Results: blank team_id in ${r.event_id}`);
    else if (!resolves(r.team_id)) orphans.push(`Results: unknown team_id "${r.team_id}" in ${r.event_id}`);
  }
  for (const m of matches) {
    if (!eventIds.has(m.event_id)) orphans.push(`Matches: unknown event_id "${m.event_id}"`);
    for (const field of ["team_a", "team_b", "winner"]) {
      const value = (m[field] ?? "").trim();
      if (value && !resolves(value)) orphans.push(`Matches: unknown ${field} "${value}" in ${m.id || "(no id)"}`);
    }
  }
  if (orphans.length) {
    problems.push(
      `${orphans.length} row(s) reference an unknown id and would be silently ignored — ` +
        orphans.slice(0, 5).join("; ") +
        (orphans.length > 5 ? ` (+${orphans.length - 5} more)` : ""),
    );
  }

  /**
   * No event can award more medals of a colour than it has.
   *
   * Several crews sharing a placing is legitimate ONLY for the count-based
   * aggregates — swimming is twelve races in one row, Chinese Garter and the
   * badminton draws are two categories each — and there each row's `count` says
   * how many that crew actually won. Without a count the whole weight goes to
   * every crew at that placing, which is how swimming once awarded 60 golds from
   * a programme containing 24. Reported as a problem, not a warning: this is the
   * silent inflation of the column the championship is decided on.
   */
  const weightOf = new Map(events.map((e) => [e.id, Number(e.medal_weight || 0)]));
  const typeOf = new Map(events.map((e) => [e.id, (e.scoring_type ?? "").trim().toLowerCase()]));
  const rowsByEvent = new Map<string, Array<Record<string, string>>>();
  for (const r of results) {
    const list = rowsByEvent.get(r.event_id);
    if (list) list.push(r);
    else rowsByEvent.set(r.event_id, [r]);
  }
  for (const [eventId, rows] of rowsByEvent) {
    // Participation pays per entrant by definition, so "more than exist" is the
    // whole point there.
    if (typeOf.get(eventId) === "participation") continue;
    const available = weightOf.get(eventId) ?? 0;
    if (available === 0) continue;
    for (const [place, colour] of [[1, "gold"], [2, "silver"], [3, "bronze"]] as const) {
      const atPlace = rows.filter((r) => Number(r.placement) === place);
      if (atPlace.length < 2) continue;
      /**
       * A shared placing is only suspicious when a row says NOTHING about how
       * much it won. A `count` is the crew's actual haul, and a declared tie (or
       * the manual's "double bronze", where two crews share third) is a
       * legitimate result — neither is the bug this guards. A blank is: the
       * event's whole weight then goes to every row at that placing, which is how
       * swimming awarded 60 golds from a programme containing 24.
       */
      const explained = atPlace.every(
        (r) => Number(r.count || 0) > 0 || String(r.tie ?? "").toUpperCase() === "TRUE",
      );
      if (explained) continue;
      const awarded = atPlace.reduce(
        (n, r) => n + (Number(r.count || 0) > 0 ? Number(r.count) : available),
        0,
      );
      if (awarded > available) {
        problems.push(
          `Events: "${eventId}" awards ${awarded} ${colour} but only ${available} exist — ` +
            `${atPlace.length} rows share placing ${place}` +
            (atPlace.some((r) => Number(r.count || 0) > 0)
              ? ", so check the `count` column adds up"
              : ", which needs a `count` on each row (aggregate event?)"),
        );
      }
    }
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
