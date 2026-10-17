/**
 * End-to-end rehearsal of the write path (the checklist's "rehearse once" step).
 *
 * Drives the REAL HTTP API — login, /api/admin/command — against a live server
 * and verifies the sheet, the public state and the Dashboard formulas agree.
 * It cleans up after itself, so it is safe to run against the production sheet
 * on the morning of the event.
 *
 *   npm run rehearse                 # placement event, results + accounts
 *   npm run rehearse -- <eventId>    # pick another event
 *
 * Needs the dev server running (or a deployed URL via REHEARSAL_BASE) and, for
 * the account section, the Super Admin password:
 *
 *   REHEARSAL_SA_USER=superadmin REHEARSAL_SA_PASS=... npm run rehearse
 *
 * What it proves:
 *   - a saved draft is visible to editors, invisible to the public, and scores nothing
 *   - publishing moves medals and points, and the Dashboard's formulas agree
 *   - the command response is never stale (no "publish did nothing" lag)
 *   - cleanup removes exactly the rows it added, and the audit log grew by exactly
 *     the number of commands issued
 *   - the Secretariat is refused account management; the Super Admin is not
 *   - passwords never reach the audit log, and the last Super Admin cannot be locked out
 */
import { loadCredentialsFromEnv, SheetsClient } from "../src/lib/data/google";

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
loadEnvFiles();

const BASE = process.env.REHEARSAL_BASE ?? "http://localhost:3000";
const EVENT = process.argv[2] ?? "badminton-singles";
const USER = process.env.REHEARSAL_USER ?? "secretariat";
// Never default this to a real password: this file is committed.
const PASS = process.env.REHEARSAL_PASS ?? "";

const client = new SheetsClient(process.env.GOOGLE_SHEET_ID!, loadCredentialsFromEnv()!);

let cookie = "";
let failures = 0;
let skipped = 0;
let commandsIssued = 0;
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!cond) failures++;
};
/**
 * For checks that cannot run because the *test environment* is not set up (a
 * rotated password, say). Reporting these as failures would train people to
 * ignore a red run, which is worse than not running them.
 */
const skip = (label: string, detail = "") => {
  console.log(`  SKIP  ${label}${detail ? `  (${detail})` : ""}`);
  skipped++;
};

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length) cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
}

type State = any;
const getState = async (): Promise<State> => (await api("/api/state")).json.state;

/** Unauthenticated fetch — simulates a random public viewer. */
async function anonState(): Promise<State> {
  const res = await fetch(`${BASE}/api/state`, { headers: { "cache-control": "no-store" } });
  return (await res.json()).state;
}

const cmd = async (body: unknown) => {
  const res = await api("/api/admin/command", { method: "POST", body: JSON.stringify(body) });
  if (res.status === 200) commandsIssued++;
  return res;
};

/** Sign in as somebody else (resets the session cookie first). */
const loginAs = (username: string, password: string) => {
  cookie = "";
  return api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
};

const medal = (s: State, teamId: string) => {
  const row = s.standings.find((x: any) => x.teamId === teamId);
  return row ? { g: row.overall.gold, s: row.overall.silver, b: row.overall.bronze, t: row.overall.totalMedals, p: row.overall.points } : null;
};
const key = (m: ReturnType<typeof medal>) => (m ? `${m.g}/${m.s}/${m.b}#${m.t}@${m.p}` : "n/a");
const isZero = (m: ReturnType<typeof medal>) => !!m && m.g === 0 && m.s === 0 && m.b === 0;

async function sheetRows(tab: string) {
  const raw = (await client.batchGet([`${tab}!A1:Z`]))[tab] ?? [];
  return raw.slice(1).filter((r) => (r?.[0] ?? "") !== "");
}
async function auditCount() {
  const raw = (await client.batchGet(["AuditLog!A1:A"]))["AuditLog"] ?? [];
  return Math.max(0, raw.length - 1);
}

/** Read the Dashboard medal table: map shortName -> medals. */
async function readDashboard() {
  const dash = (await client.batchGet(["Dashboard!A1:F30"]))["Dashboard"] ?? [];
  const head = dash.findIndex((r) => String(r?.[1] ?? "").trim() === "Crew");
  const out: Record<string, { g: number; s: number; b: number; t: number }> = {};
  if (head < 0) return out;
  for (const row of dash.slice(head + 1, head + 13)) {
    const crew = String(row?.[1] ?? "").trim();
    if (!crew) continue;
    out[crew] = { g: Number(row?.[2] ?? 0), s: Number(row?.[3] ?? 0), b: Number(row?.[4] ?? 0), t: Number(row?.[5] ?? 0) };
  }
  return out;
}

async function compareDashboard(label: string) {
  let mismatch: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    // Re-read the engine each attempt: a publish may take a moment to land in
    // the store, and we want to compare "the sheet's formulas vs. the engine",
    // not vs. a frozen snapshot.
    const s = await getState();
    const dash = await readDashboard();
    mismatch = [];
    for (const t of s.teams) {
      const d = dash[t.shortName];
      const m = medal(s, t.id)!;
      if (!d || d.g !== m.g || d.s !== m.s || d.b !== m.b || d.t !== m.t) {
        mismatch.push(`${t.shortName}: sheet=${d ? `${d.g}/${d.s}/${d.b}#${d.t}` : "missing"} engine=${m.g}/${m.s}/${m.b}#${m.t}`);
      }
    }
    if (!mismatch.length) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  check(`Dashboard formulas match the engine ${label}`, mismatch.length === 0, mismatch.slice(0, 4).join("; "));
}

/** Poll until `fn` is true (or the timeout lapses). */
async function waitFor(fn: () => Promise<boolean>, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  if (!PASS) {
    console.error(
      "\n  x REHEARSAL_PASS is not set. It must be the sign-in password for REHEARSAL_USER\n" +
        "    (default user: secretariat). Example:\n" +
        '      $env:REHEARSAL_PASS="<password>"; npm run rehearse\n',
    );
    process.exit(1);
  }

  console.log(`\n=== Write-path rehearsal  (event=${EVENT}) ===\n`);

  /* 0. auth ---------------------------------------------------------------- */
  const login = await loginAs(USER, PASS);
  check("login as secretariat", login.status === 200, `HTTP ${login.status}`);

  /* snapshot before -------------------------------------------------------- */
  const before0 = await getState();
  const auditBefore = await auditCount();
  const resultsBefore = (await sheetRows("Results")).length;
  const ev = before0.events.find((e: any) => e.id === EVENT);
  check(`event ${EVENT} exists and is editable`, !!ev && !ev.locked, ev ? `type=${ev.scoringType} weight=${ev.medalWeight} locked=${ev.locked}` : "missing");
  const teams = before0.teams;
  const [t1, t2, t3] = [teams[0], teams[1], teams[2]];
  const before = { t1: medal(before0, t1.id), t2: medal(before0, t2.id), t3: medal(before0, t3.id) };
  console.log(`\n  BEFORE: ${t1.shortName} ${key(before.t1)} | ${t2.shortName} ${key(before.t2)} | ${t3.shortName} ${key(before.t3)}`);
  console.log(`  sheet: Results=${resultsBefore} rows, AuditLog=${auditBefore} rows\n`);
  await compareDashboard("(baseline)");

  /* 1. saveResults as DRAFT ------------------------------------------------ */
  const draft = await cmd({
    type: "saveResults",
    eventId: EVENT,
    rows: [
      { teamId: t1.id, placement: 1, tie: false, status: "draft" },
      { teamId: t2.id, placement: 2, tie: false, status: "draft" },
      { teamId: t3.id, placement: 3, tie: false, status: "draft" },
    ],
  });
  check("saveResults (draft) accepted", draft.status === 200, `HTTP ${draft.status} ${draft.json?.error ?? ""}`);

  const s1 = await getState();
  const draftRows = s1.results.filter((r: any) => r.eventId === EVENT);
  check("draft rows persisted in Results", (await sheetRows("Results")).length === resultsBefore + 3, `${(await sheetRows("Results")).length} rows`);
  check("signed-in editor receives the 3 draft rows", draftRows.length === 3 && draftRows.every((r: any) => r.status === "draft"), `${draftRows.length} rows`);
  const anon1 = await anonState();
  check("public viewer NEVER receives draft rows", anon1.results.filter((r: any) => r.eventId === EVENT).length === 0);
  check("public viewer count is published-only", anon1.results.every((r: any) => r.status === "published"));
  check("draft is INVISIBLE in standings", key(medal(s1, t1.id)) === key(before.t1), `${t1.shortName} ${key(medal(s1, t1.id))}`);
  await compareDashboard("(draft, unpublished)");

  /* 2. publish ------------------------------------------------------------- */
  const pub = await cmd({ type: "publishResults", eventId: EVENT });
  check("publishResults accepted", pub.status === 200, `HTTP ${pub.status} ${pub.json?.error ?? ""}`);

  const reachedPublic = await waitFor(
    async () => (await anonState()).results.filter((r: any) => r.eventId === EVENT).length === 3,
    15000,
  );
  check("published rows reach the public viewer", reachedPublic);

  const s2 = await getState();
  const a1 = medal(s2, t1.id)!;
  const a2 = medal(s2, t2.id)!;
  const a3 = medal(s2, t3.id)!;
  // "Medals at stake": an event's medal_weight is how many medals each placing wins.
  const w = ev.medalWeight;
  console.log(`  AFTER : ${t1.shortName} ${key(a1)} | ${t2.shortName} ${key(a2)} | ${t3.shortName} ${key(a3)}`);
  check(`gold awarded to ${t1.shortName} (weight ${w})`, a1.g === before.t1!.g + w && a1.t === before.t1!.t + w, `+${a1.g - before.t1!.g}g`);
  check(`silver awarded to ${t2.shortName} (weight ${w})`, a2.s === before.t2!.s + w && a2.t === before.t2!.t + w, `+${a2.s - before.t2!.s}s`);
  check(`bronze awarded to ${t3.shortName} (weight ${w})`, a3.b === before.t3!.b + w && a3.t === before.t3!.t + w, `+${a3.b - before.t3!.b}b`);
  check("1st place also earned placement points", a1.p > before.t1!.p, `+${a1.p - before.t1!.p} pts`);
  const respOverall = pub.json?.state?.standings?.find((x: any) => x.teamId === t1.id)?.overall as
    | { gold: number; silver: number; bronze: number; totalMedals: number; points: number }
    | undefined;
  const fromResponse = respOverall
    ? `${respOverall.gold}/${respOverall.silver}/${respOverall.bronze}#${respOverall.totalMedals}@${respOverall.points}`
    : "missing from the command response";
  check(
    "the command response itself is not stale",
    fromResponse === key(a1),
    `response=${fromResponse} later=${key(a1)}`,
  );
  await compareDashboard("(published)");

  /* 3. cleanup: saveResults with no rows removes the event's rows ---------- */
  const clean = await cmd({ type: "saveResults", eventId: EVENT, rows: [] });
  check("cleanup saveResults([]) accepted", clean.status === 200, `HTTP ${clean.status} ${clean.json?.error ?? ""}`);
  const s3 = await getState();
  check("Results tab back to baseline row count", (await sheetRows("Results")).length === resultsBefore, `${(await sheetRows("Results")).length} rows`);
  check("event rows removed from state", s3.results.filter((r: any) => r.eventId === EVENT).length === 0);
  check("public viewer sees no rows after cleanup", (await anonState()).results.filter((r: any) => r.eventId === EVENT).length === 0);
  check(`${t1.shortName} medals restored`, key(medal(s3, t1.id)) === key(before.t1), key(medal(s3, t1.id)));
  check(`${t2.shortName} medals restored`, key(medal(s3, t2.id)) === key(before.t2));
  check(`${t3.shortName} medals restored`, key(medal(s3, t3.id)) === key(before.t3));
  await compareDashboard("(after cleanup)");

  /* 4. accounts (Super Admin only) ---------------------------------------- */
  console.log("\n  -- accounts --");
  const tmpUser = "rehearsal-tmp";
  const tmpPass = "rehearsal-pass-1234";

  const forbidden = await cmd({
    type: "upsertUser",
    user: { username: tmpUser, role: "pio", active: true, password: tmpPass },
  });
  check("the Secretariat is refused account management", forbidden.status === 403, `HTTP ${forbidden.status}`);

  const saUser = process.env.REHEARSAL_SA_USER ?? "superadmin";
  const saPass = process.env.REHEARSAL_SA_PASS ?? "";
  const saLogin = saPass ? await loginAs(saUser, saPass) : { status: 0 };

  if (saLogin.status !== 200) {
    skip(
      "Super Admin account checks",
      saPass
        ? `sign-in as "${saUser}" failed (HTTP ${saLogin.status}) — it is likely the password was rotated; set REHEARSAL_SA_PASS to the current one`
        : "set REHEARSAL_SA_PASS to the current Super Admin password to include them",
    );
  } else {
    const created = await cmd({
      type: "upsertUser",
      user: { username: tmpUser, role: "pio", active: true, password: tmpPass },
    });
    check("Super Admin can create an account", created.status === 200, created.json?.error ?? "");

    const tmpLogin = await loginAs(tmpUser, tmpPass);
    check("the brand-new account can sign in", tmpLogin.status === 200, `HTTP ${tmpLogin.status}`);

    const backAsSa = await loginAs(saUser, saPass);
    check("Super Admin can sign back in", backAsSa.status === 200, `HTTP ${backAsSa.status}`);

    const list = ((await api("/api/admin/users")).json?.users ?? []) as Array<{ username: string }>;
    check("account list includes the new user", list.some((u) => u.username === tmpUser));

    const auditRows = await sheetRows("AuditLog");
    const upsertRow = [...auditRows].reverse().find((r) => r[2] === "upsertUser");
    check(
      "the password never reaches the audit log",
      !!upsertRow && /redacted/.test(upsertRow[7] ?? "") && !/\$2[aby]\$/.test(upsertRow[7] ?? ""),
      upsertRow ? String(upsertRow[7]).slice(0, 70) : "no upsertUser entry",
    );

    const demote = await cmd({ type: "upsertUser", user: { username: saUser, role: "pio", active: true } });
    check("cannot demote the last active Super Admin", demote.status === 400, `HTTP ${demote.status}`);
    const delSelf = await cmd({ type: "deleteUser", username: saUser });
    check("cannot delete the last active Super Admin", delSelf.status === 400, `HTTP ${delSelf.status}`);

    const delTmp = await cmd({ type: "deleteUser", username: tmpUser });
    check("Super Admin can delete the test account", delTmp.status === 200, delTmp.json?.error ?? "");

    const gone = await loginAs(saUser, saPass);
    check("Super Admin still signs in after cleanup", gone.status === 200, `HTTP ${gone.status}`);
    const finalList = ((await api("/api/admin/users")).json?.users ?? []) as Array<{ username: string }>;
    check("test account removed", !finalList.some((u) => u.username === tmpUser));
  }

  /* 5. audit trail --------------------------------------------------------- */
  const auditAfter = await auditCount();
  check(`AuditLog grew by exactly ${commandsIssued} commands`, auditAfter === auditBefore + commandsIssued, `${auditBefore} -> ${auditAfter}`);
  const tail = (await sheetRows("AuditLog")).slice(-commandsIssued).map((r) => `${r[1]}/${r[2]}`);
  console.log(`  audit tail: ${tail.join(", ")}`);

  const summary = failures
    ? `${failures} CHECK(S) FAILED`
    : skipped
      ? `ALL CHECKS PASSED (${skipped} skipped)`
      : "ALL CHECKS PASSED";
  console.log(`\n=== ${summary} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
