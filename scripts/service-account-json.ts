/**
 * Produce the single-line value for GOOGLE_SERVICE_ACCOUNT_JSON.
 *
 *   npm run service-account-json           # write .secrets/service-account.oneline.json
 *   npm run service-account-json -- --print  # also echo it to the terminal
 *
 * Vercel has no disk, so the key has to travel as an environment variable.
 * This minifies the key file to a single line and writes it to a gitignored
 * path, so you can copy it into the dashboard without the private key passing
 * through your shell history or a log file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseServiceAccountJson } from "../src/lib/data/google";

const OUT = resolve(".secrets/service-account.oneline.json");

function loadEnv() {
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

function rawKey(): { text: string; source: string } {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline && inline.trim().startsWith("{")) return { text: inline, source: "GOOGLE_SERVICE_ACCOUNT_JSON" };

  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) return { text: readFileSync(file, "utf8"), source: `file ${file}` };

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return {
      text: JSON.stringify({ type: "service_account", client_email: email, private_key: key.replace(/\\n/g, "\n") }),
      source: "GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY",
    };
  }
  throw new Error("No service account found. Set GOOGLE_SERVICE_ACCOUNT_FILE in .env.local first.");
}

function main() {
  loadEnv();
  const { text, source } = rawKey();
  const creds = parseServiceAccountJson(text);
  if (!creds.client_email || !creds.private_key) {
    throw new Error("The key is missing client_email or private_key.");
  }

  // Re-serialise from the parsed object: guaranteed valid JSON, newlines kept
  // as \n escapes, all on one line.
  const oneline = JSON.stringify(creds);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, oneline, "utf8");

  // Prove the round trip before anyone pastes it into a dashboard.
  const back = JSON.parse(oneline) as { client_email?: string; private_key?: string };
  const ok = back.client_email === creds.client_email && back.private_key === creds.private_key;

  console.log("");
  console.log("  Service account -> GOOGLE_SERVICE_ACCOUNT_JSON");
  console.log("  --------------------------------------------");
  console.log(`  read from : ${source}`);
  console.log(`  account   : ${creds.client_email}`);
  console.log(`  project   : ${(creds as { project_id?: string }).project_id ?? "(not in key file)"}`);
  console.log(`  one line  : ${oneline.length} characters`);
  console.log(`  round trip: ${ok ? "ok" : "FAILED"}`);
  console.log("");
  console.log(`  Written to: ${OUT}`);
  console.log("");
  console.log("  Next:");
  console.log("    1. Open that file and copy the whole line.");
  console.log("    2. Paste it as the value of GOOGLE_SERVICE_ACCOUNT_JSON.");
  console.log("       Vercel dashboard -> Project -> Settings -> Environment Variables");
  console.log("       (tick Production and Preview), or:");
  console.log(`       vercel env add GOOGLE_SERVICE_ACCOUNT_JSON production < "${OUT}"`);
  console.log("    3. Also set GOOGLE_SHEET_ID and AUTH_SECRET there.");
  console.log("    4. Do NOT set GOOGLE_SERVICE_ACCOUNT_FILE on Vercel - there is no disk.");
  console.log("");
  if (process.argv.includes("--print")) console.log(oneline + "\n");
}

main();
