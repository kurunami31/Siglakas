/**
 * Nightly backup of the spreadsheet.
 *
 *   npm run backup-sheet                 # writes backups/<date>/*.csv
 *   npm run backup-sheet -- --out <dir>
 *
 * Dumps every RAW tab as CSV, not the derived exports: this is the
 * disaster-recovery copy, so it must be the unprocessed data that
 * `setup-sheet` could restore from. Google's own version history is the only
 * other safety net, and it is not something you want to discover mid-festival.
 *
 * Read-only: it never writes to the spreadsheet.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCredentialsFromEnv, parseAoa, SheetsClient } from "../src/lib/data/google";
import { HEADERS, TABS } from "../src/lib/data/sheets-repo";

function loadEnvFiles() {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (!loader) return;
  for (const f of [".env.local", ".env"]) {
    try {
      loader(f);
    } catch {
      /* absent */
    }
  }
}

/** RFC 4180: quote everything, double any embedded quote. */
const cell = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

async function main() {
  loadEnvFiles();

  const outFlag = process.argv.indexOf("--out");
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : path.join("backups", stamp);

  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    console.error("\n  x GOOGLE_SHEET_ID is not set.\n");
    process.exit(1);
  }
  const creds = loadCredentialsFromEnv();
  if (!creds) {
    console.error("\n  x No credentials (GOOGLE_SERVICE_ACCOUNT_FILE / _JSON).\n");
    process.exit(1);
  }

  const client = new SheetsClient(id, creds);
  const keys = Object.keys(TABS) as Array<keyof typeof TABS>;
  const read = await client.batchGet(keys.map((k) => `${TABS[k]}!A1:Z`));

  await mkdir(outDir, { recursive: true });
  console.log(`\n  Grand Line Tally - spreadsheet backup`);
  console.log(`  ------------------------------------`);
  console.log(`  sheet : ${id}`);
  console.log(`  to    : ${outDir}`);
  console.log("");

  let rows = 0;
  for (const key of keys) {
    const tab = TABS[key];
    const aoa = read[tab] ?? [];
    // Always emit the canonical header, so a restored tab is structurally
    // correct even if the live one lost its header row.
    const lines = [HEADERS[key].map(cell).join(",")];
    for (const row of aoa.slice(1)) {
      if (!row.some((c) => (c ?? "").toString().trim() !== "")) continue;
      lines.push(HEADERS[key].map((_, i) => cell(row[i])).join(","));
    }
    await writeFile(path.join(outDir, `${tab}.csv`), lines.join("\n") + "\n", "utf8");
    const count = lines.length - 1;
    rows += count;
    console.log(`  ${tab.padEnd(15)} ${String(count).padStart(5)} rows -> ${tab}.csv`);
  }

  console.log(`\n  done: ${keys.length} tabs, ${rows} rows backed up.\n`);
}

void main().catch((err) => {
  console.error("\n  x backup failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
