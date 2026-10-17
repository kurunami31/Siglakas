/**
 * Account manager for the spreadsheet's Users tab.
 *
 * The day-to-day path is the Super Admin screen inside the app
 * (`/admin/users`). This script is for two things the UI cannot do:
 *   1. create the very first Super Admin, and
 *   2. get you back in if every login is ever lost.
 *
 *   npm run create-admin -- --list
 *   npm run create-admin -- <username> <password> [role]
 *   npm run create-admin -- <username> --generate [role]
 *   npm run create-admin -- --enable|--disable <username>
 *   npm run create-admin -- --remove <username>
 *
 * `role` is `pio`, `secretariat` or `superadmin` and defaults to `secretariat`.
 * Only the bcrypt hash is stored — a plaintext password is never written to the
 * sheet. Passwords are never printed back except when `--generate` makes one.
 *
 * Lockout protection: the last active Super Admin can never be demoted,
 * disabled or removed, whichever way you try it.
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { loadCredentialsFromEnv, SheetsClient } from "../src/lib/data/google";
import { HEADERS, TABS } from "../src/lib/data/sheets-repo";
import type { Role } from "../src/lib/types";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i;
const ROLES: Role[] = ["pio", "secretariat", "superadmin"];
/** Kept in step with the command schema the UI posts through. */
const MIN_PASSWORD = 8;

function log(msg = "") {
  console.log(msg);
}

function die(message: string): never {
  console.error(`\n  x ${message}\n`);
  process.exit(1);
}

function loadEnvFiles() {
  const loader = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (!loader) return;
  for (const file of [".env.local", ".env"]) {
    try {
      loader(file);
    } catch {
      /* not present */
    }
  }
}

/** Strong password with no 0/O/1/l look-alikes, so it can be read aloud. */
function generatePassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

function isLastActiveSuperAdmin(rows: string[][], roleIdx: number, activeIdx: number, username: string): boolean {
  const target = username.toLowerCase();
  const supers = rows.filter(
    (r) => (r[roleIdx] ?? "").toLowerCase() === "superadmin" && (r[activeIdx] ?? "TRUE").toUpperCase() !== "FALSE",
  );
  return supers.length === 1 && (supers[0][0] ?? "").toLowerCase() === target;
}

async function main() {
  loadEnvFiles();

  const args = process.argv.slice(2);

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) die("GOOGLE_SHEET_ID is not set. Add it to .env.local.");
  const creds = loadCredentialsFromEnv();
  if (!creds) die("No credentials. Set GOOGLE_SERVICE_ACCOUNT_FILE in .env.local.");

  const client = new SheetsClient(spreadsheetId, creds);

  let table: string[][];
  try {
    const read = await client.batchGet([`${TABS.users}!A1:Z`]);
    table = read[TABS.users] ?? [];
  } catch (err) {
    die(
      `Could not read the Users tab. Is the sheet shared with ${creds.client_email} as Editor?\n` +
        `    Detail: ${err instanceof Error ? err.message : err}`,
    );
  }

  const header = table[0] ?? HEADERS.users;
  if (header.join("|") !== HEADERS.users.join("|")) {
    die(`The Users tab header does not match. Expected: ${HEADERS.users.join(", ")}`);
  }

  const idx = (name: string) => HEADERS.users.indexOf(name);
  const roleIdx = idx("role");
  const activeIdx = idx("active");
  const teamIdx = idx("team_id");
  const rows = table.slice(1).filter((r) => (r[0] ?? "").trim() !== "");
  const find = (name: string) => rows.findIndex((r) => (r[0] ?? "").toLowerCase() === name.toLowerCase());

  const persist = async () => {
    // Clear the body first so a shrinking list can't leave orphan rows behind.
    await client.clear(`${TABS.users}!A2:Z`);
    await client.update(`${TABS.users}!A1`, [HEADERS.users, ...rows]);
  };

  /* ------------------------------- list ------------------------------- */
  if (args[0] === "--list" || args.length === 0) {
    log("");
    log(`  Accounts in "${TABS.users}" (${rows.length})`);
    log("  ------------------------------");
    if (rows.length === 0) log("  (none yet)");
    for (const r of rows) {
      const active = (r[activeIdx] ?? "TRUE").toUpperCase();
      const role = r[roleIdx] ?? "?";
      const star = role === "superadmin" ? "*" : " ";
      log(`  ${star} ${r[0].padEnd(20)} ${role.padEnd(12)} ${active === "FALSE" ? "disabled" : "active"}`);
    }
    log("");
    if (args.length === 0) {
      log("  usage: npm run create-admin -- <username> <password> [role]");
      log("         npm run create-admin -- <username> --generate [role]");
      log("         npm run create-admin -- --enable|--disable|--remove <username>");
      log("");
    }
    return;
  }

  /* --------------------- enable / disable / remove --------------------- */
  if (args[0] === "--enable" || args[0] === "--disable" || args[0] === "--remove") {
    const username = args[1];
    if (!username) die(`--${args[0].slice(2)} needs a username.`);
    const at = find(username);
    if (at < 0) die(`No account named "${username}".`);

    if (args[0] === "--remove") {
      if (isLastActiveSuperAdmin(rows, roleIdx, activeIdx, username)) {
        die("Lockout protection: that is the last active Super Admin.");
      }
      rows.splice(at, 1);
      await persist();
      log(`\n  Removed ${username}.\n`);
      return;
    }

    const active = args[0] === "--enable";
    if (!active && isLastActiveSuperAdmin(rows, roleIdx, activeIdx, username)) {
      die("Lockout protection: that is the last active Super Admin.");
    }
    rows[at][activeIdx] = active ? "TRUE" : "FALSE";
    await persist();
    log(`\n  ${username} is now ${active ? "active" : "disabled"}.\n`);
    return;
  }

  /* --------------------------- create / reset --------------------------- */
  const generate = args.includes("--generate");
  const positional = args.filter((a) => !a.startsWith("--"));
  // With --generate there is no password argument, so the second positional is
  // the role; without it the role is the third.
  const username = positional[0];
  const passwordArg = generate ? undefined : positional[1];
  const roleArg = (generate ? positional[1] : positional[2]) ?? "secretariat";
  const role = roleArg as Role;

  if (!USERNAME_RE.test(username ?? "")) {
    die("Username must be 3-32 characters: letters, numbers, dot, dash or underscore.");
  }
  if (!ROLES.includes(role)) {
    die(`Role must be one of: ${ROLES.join(", ")}.`);
  }

  const password = generate ? generatePassword() : passwordArg;
  if (!password || password.length < MIN_PASSWORD) {
    die(`Password must be at least ${MIN_PASSWORD} characters (or pass --generate).`);
  }

  // Demoting the only Super Admin would lock everyone out of account management.
  const existing = find(username);
  if (existing >= 0 && role !== "superadmin" && isLastActiveSuperAdmin(rows, roleIdx, activeIdx, username)) {
    die("Lockout protection: that is the last active Super Admin. Create another one first.");
  }

  log("");
  log(`  Hashing password for "${username}"...`);
  const hash = await bcrypt.hash(password, 10);

  const row: string[] = [];
  row[0] = username;
  row[idx("password_hash")] = hash;
  row[roleIdx] = role;
  row[teamIdx] = existing >= 0 ? (rows[existing][teamIdx] ?? "") : "";
  row[activeIdx] = "TRUE";

  if (existing >= 0) {
    rows[existing] = row;
    log("  Updating existing account.");
  } else {
    rows.push(row);
    log("  Creating new account.");
  }

  await persist();

  log("");
  log(`  done: ${username} (${role}) written to "${TABS.users}"`);
  if (generate) log(`  password: ${password}`);
  else log("  (uses the password you supplied)");
  log("  Sign in at http://localhost:3000/login");
  log("");
}

main().catch((err) => {
  console.error("\n  x create-admin failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
