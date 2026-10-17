/**
 * Creates (or repairs) the Grand Line Tally spreadsheet.
 *
 *   npm run setup-sheet -- --dry-run        preview only, writes nothing
 *   npm run setup-sheet                     create tabs / headers / seed data
 *   npm run setup-sheet -- --force          also overwrite tabs that already hold data
 *   npm run setup-sheet -- --sheet <id>     override GOOGLE_SHEET_ID
 *
 * Safety: by default a tab that already contains data rows is left completely
 * alone, so re-running this can never wipe live festival scores. Use --force
 * only when you genuinely want to reset a tab.
 */
import { loadCredentialsFromEnv, SheetsClient } from "../src/lib/data/google";
import { HEADERS, TABS, configRows, eventRow, teamRow } from "../src/lib/data/sheets-repo";
import { DEFAULT_CONFIG, EVENTS, TEAMS, buildCriteria } from "../src/lib/data/seed";

type TabKey = keyof typeof TABS;
type Aoa = Array<Array<string | number>>;

const TAB_ORDER = Object.values(TABS) as string[];
const TAB_KEY_BY_TITLE = new Map<string, TabKey>(
  (Object.keys(TABS) as TabKey[]).map((k) => [TABS[k], k]),
);

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const FORCE = argv.includes("--force");
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

/* ------------------------------- validation ------------------------------- */

const listRule = (values: string[]) => ({
  condition: { type: "ONE_OF_LIST", values: values.map((v) => ({ userEnteredValue: v })) },
  showCustomUi: true,
  strict: false,
});

const numberRule = (min: number, max: number) => ({
  condition: {
    type: "NUMBER_BETWEEN",
    values: [{ userEnteredValue: String(min) }, { userEnteredValue: String(max) }],
  },
  strict: false,
});

const boolRule = () => {
  // NOTE: do NOT use the BOOLEAN condition type here — Sheets writes a default
  // `FALSE` into every cell in the range, which makes an empty tab look full and
  // would create hundreds of phantom rows. A TRUE/FALSE dropdown behaves
  // correctly and stores exactly what `bool()` in sheets-repo expects.
  return listRule(["TRUE", "FALSE"]);
};

const VALIDATION: Array<{
  tab: TabKey;
  field: string;
  rule: () => Record<string, unknown>;
  hint: string;
}> = [
  { tab: "teams", field: "group", rule: () => listRule(["faculty", "extension_campus"]), hint: "faculty or extension_campus" },
  { tab: "events", field: "division", rule: () => listRule(["sports", "cultural"]), hint: "sports or cultural" },
  { tab: "events", field: "scoring_type", rule: () => listRule(["placement", "judged", "match"]), hint: "placement, judged or match" },
  { tab: "events", field: "status", rule: () => listRule(["upcoming", "live", "finished"]), hint: "upcoming, live or finished" },
  { tab: "events", field: "medal_weight", rule: () => numberRule(0, 100), hint: "Medals at stake (0-100)" },
  { tab: "events", field: "multiplier", rule: () => numberRule(0, 10), hint: "Multiplier (0-10)" },
  { tab: "events", field: "locked", rule: boolRule, hint: "TRUE / FALSE" },
  { tab: "events", field: "verify", rule: boolRule, hint: "TRUE / FALSE" },
  { tab: "criteria", field: "weight", rule: () => numberRule(0, 100), hint: "Weight (0-100)" },
  { tab: "matches", field: "score_a", rule: () => numberRule(0, 999), hint: "Score (0-999)" },
  { tab: "matches", field: "score_b", rule: () => numberRule(0, 999), hint: "Score (0-999)" },
  { tab: "matches", field: "status", rule: () => listRule(["scheduled", "live", "final"]), hint: "scheduled, live or final" },
  { tab: "judgeScores", field: "score", rule: () => numberRule(0, 1000), hint: "Score (0-1000)" },
  // The tally tabs are edited by hand during the festival, so every id column
  // gets a dropdown. A typo here is the worst failure mode in the whole system:
  // the scorer cannot resolve the row and drops it *silently*, with no error on
  // the site and no clue in the sheet.
  { tab: "results", field: "event_id", rule: () => listRule(EVENTS.map((e) => e.id)), hint: "Pick an island id from the Events tab" },
  { tab: "results", field: "team_id", rule: () => listRule(TEAMS.map((t) => t.id)), hint: "Pick a crew id from the Teams tab" },
  { tab: "results", field: "placement", rule: () => numberRule(0, 12), hint: "1-12, or 0 for participation" },
  { tab: "results", field: "tie", rule: boolRule, hint: "TRUE / FALSE" },
  { tab: "results", field: "status", rule: () => listRule(["draft", "published"]), hint: "draft or published - only published counts" },
  { tab: "matches", field: "event_id", rule: () => listRule(EVENTS.map((e) => e.id)), hint: "Pick an island id from the Events tab" },
  { tab: "matches", field: "team_a", rule: () => listRule(TEAMS.map((t) => t.id)), hint: "Pick a crew id from the Teams tab" },
  { tab: "matches", field: "team_b", rule: () => listRule(TEAMS.map((t) => t.id)), hint: "Pick a crew id from the Teams tab" },
  { tab: "matches", field: "winner", rule: () => listRule(TEAMS.map((t) => t.id)), hint: "Crew id of the winner, or blank" },
  { tab: "users", field: "role", rule: () => listRule(["pio", "secretariat", "superadmin"]), hint: "pio, secretariat or superadmin" },
  { tab: "users", field: "active", rule: boolRule, hint: "TRUE / FALSE" },
];

const HEADER_RANGE_ROWS = 20000;

/**
 * Grid height per tab. `values.update` fails outright if a write is taller than
 * the grid, and JudgeScores reaches ~6,000 rows over a full festival, so the
 * default 1,000 rows is not enough.
 */
const GRID_ROWS: Record<TabKey, number> = {
  config: 200,
  teams: 200,
  events: 500,
  criteria: 1000,
  matches: 2000,
  judgeScores: 12000,
  results: 4000,
  announcements: 1000,
  auditLog: 20000,
  users: 200,
};

function structuralRequests(sheetId: number, key: TabKey): unknown[] {
  return [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1, rowCount: GRID_ROWS[key] ?? 1000 },
        },
        fields: "gridProperties.frozenRowCount,gridProperties.rowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.05, green: 0.12, blue: 0.2 },
            horizontalAlignment: "LEFT",
          },
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)",
      },
    },
  ];
}

function validationRequests(sheetId: number, tab: TabKey): unknown[] {
  const requests: unknown[] = [];
  for (const spec of VALIDATION) {
    // Only this tab's rules — applying every rule to every sheet writes values
    // into unrelated columns.
    if (spec.tab !== tab) continue;
    const col = HEADERS[tab].indexOf(spec.field);
    if (col < 0) continue;
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: HEADER_RANGE_ROWS,
          startColumnIndex: col,
          endColumnIndex: col + 1,
        },
        rule: { ...spec.rule(), inputMessage: spec.hint },
      },
    });
  }
  return requests;
}

/* --------------------------------- seeding -------------------------------- */

function seedFor(tab: TabKey): Aoa | null {
  switch (tab) {
    case "config":
      return configRows(DEFAULT_CONFIG);
    case "teams":
      return TEAMS.map((t) => teamRow(t));
    case "events":
      return EVENTS.map((e) => eventRow(e));
    case "criteria":
      return buildCriteria(EVENTS).map((c) => [c.eventId, c.criterion, c.weight, c.order]);
    default:
      return null;
  }
}

/* ---------------------------------- main ---------------------------------- */

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
  log("  Grand Line Tally - spreadsheet setup");
  log("  -----------------------------------");
  log(`  spreadsheet : ${spreadsheetId}`);
  log(`  service acct: ${creds.client_email}`);
  log(`  key source  : ${process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "(inline JSON)"}`);
  log(`  mode        : ${DRY ? "DRY RUN - nothing will be written" : FORCE ? "APPLY (--force)" : "APPLY"}`);
  log("");

  const client = new SheetsClient(spreadsheetId, creds);

  let meta: Awaited<ReturnType<SheetsClient["getMeta"]>>;
  try {
    meta = await client.getMeta();
  } catch (err) {
    die(
      `Could not open the spreadsheet.\n` +
        `    Check that it is shared with ${creds.client_email} as Editor,\n` +
        `    that the Google Sheets API is enabled, and that the id is right.\n` +
        `    Detail: ${msg(err)}`,
    );
  }

  log(`  title       : ${meta.title}`);

  const ourTitles = new Set(TAB_ORDER);
  const idByTitle = new Map(meta.sheets.map((s) => [s.title, s.sheetId]));
  const strays = meta.sheets.filter((s) => !ourTitles.has(s.title));

  // Reuse a single leftover default tab instead of leaving an orphan.
  const plans: string[] = [];
  const rename: { sheetId: number; title: string } | null =
    !idByTitle.has(TAB_ORDER[0]) && strays.length === 1 && /^sheet1$/i.test(strays[0].title)
      ? { sheetId: strays[0].sheetId, title: TAB_ORDER[0] }
      : null;
  if (rename) plans.push(`rename tab "${strays[0].title}" -> "${rename.title}"`);

  const toCreate = TAB_ORDER.filter((t) => !idByTitle.has(t) && t !== rename?.title);
  for (const t of toCreate) plans.push(`create tab "${t}"`);
  if (strays.length && !rename) {
    for (const s of strays) plans.push(`leave existing tab "${s.title}" untouched (not ours)`);
  }

  log("");
  log("  plan");
  log("  ----");
  if (plans.length === 0) log("  (no structural changes needed)");
  for (const p of plans) log(`  - ${p}`);

  if (DRY) {
    log("");
    log("  seed rows (written only into empty tabs)");
    log("  -------------------------------------");
    for (const title of TAB_ORDER) {
      const key = TAB_KEY_BY_TITLE.get(title);
      if (!key) continue;
      const rows = seedFor(key) ?? [];
      log(`  - ${title.padEnd(13)} ${rows.length === 0 ? "headers only" : `${rows.length} rows`}`);
    }
    log("");
    log("  Dry run complete - nothing was written.");
    log("  Re-run without --dry-run to apply.");
    log("");
    return;
  }

  // 1. structure: rename + create
  const struct: unknown[] = [];
  if (rename) {
    struct.push({
      updateSheetProperties: {
        properties: { sheetId: rename.sheetId, title: rename.title },
        fields: "title",
      },
    });
  }
  for (const title of toCreate) struct.push({ addSheet: { properties: { title } } });
  if (struct.length) {
    await client.batchUpdate(struct);
    meta = await client.getMeta();
    idByTitle.clear();
    for (const s of meta.sheets) idByTitle.set(s.title, s.sheetId);
  }

  // 2. freeze + header styling + validation
  const fmt: unknown[] = [];
  for (const title of TAB_ORDER) {
    const sheetId = idByTitle.get(title);
    if (sheetId === undefined) continue;
    const key = TAB_KEY_BY_TITLE.get(title);
    if (!key) continue;
    fmt.push(
      // Clear every validation rule first so re-running is idempotent and a
      // rule from an earlier run can never linger in the wrong column.
      {
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: HEADER_RANGE_ROWS,
            startColumnIndex: 0,
            endColumnIndex: 26,
          },
        },
      },
      ...structuralRequests(sheetId, key),
      ...validationRequests(sheetId, key),
    );
  }
  if (fmt.length) await client.batchUpdate(fmt);
  log("");
  log(`  formatted ${TAB_ORDER.length} tabs (frozen header, dropdowns, numeric limits)`);

  // 3. headers + seed data (never clobber populated tabs unless --force)
  const read = await client.batchGet(TAB_ORDER.map((t) => `${t}!A1:Z`));
  let seeded = 0;
  let skipped = 0;

  for (const title of TAB_ORDER) {
    const key = TAB_KEY_BY_TITLE.get(title);
    if (!key) continue;
    const headers = HEADERS[key];
    const existing = read[title] ?? [];
    const dataRows = existing.filter((r, i) => i > 0 && r.some((c) => (c ?? "").trim() !== "")).length;

    // A tab holding data we did not write is left completely untouched unless
    // --force is given, so a re-run can never destroy live festival scores.
    if (dataRows > 0 && !FORCE) {
      log(`  keep   ${title.padEnd(13)} ${dataRows} existing row(s) - untouched`);
      skipped++;
      continue;
    }

    const rows = seedFor(key) ?? [];
    if (FORCE) await client.clear(`${title}!A1:Z`);
    await client.update(`${title}!A1`, [headers, ...rows]);
    log(`  ${dataRows > 0 ? "reset" : "write"}  ${title.padEnd(13)} ${rows.length} row(s)`);
    seeded++;
  }

  log("");
  log(`  done: ${seeded} tab(s) written, ${skipped} left untouched`);
  log("");
  log("  Next:");
  log("    1. npm run create-admin -- <username> <password> secretariat");
  log("    2. restart `npm run dev` and open http://localhost:3000");
  log("");
}

main().catch((err) => {
  console.error("\n  x setup failed:", msg(err), "\n");
  process.exit(1);
});
