# Grand Line Tally — SIGLAKAS 2026 live scoreboard

A live, One-Piece-themed tally site for the **SIGLAKAS 2026 Socio-Cultural & Sports**
competition at DOrSU. It reads a single Google Sheet, computes the standings, medal
tally and overall championship, and pushes every change to open browsers within a
few seconds.

Built for competition day: it must survive a spotty campus network, be readable on a
projector *and* a phone, and never invent a number.

- **12 crews** — 7 faculties + 5 extension campuses, one pool, one leaderboard.
- **97 events**, **426 medals** at stake across two divisions (sports, socio-cultural), plus two participation events where every entrant earns a gold.
- **One championship.** Both divisions roll into a single overall title.

---

## The two things you actually need to know

1. **The Google Sheet is the source of truth.** The site never owns data — it reads
   and writes the sheet you nominate. Edit the sheet by hand if you like; the site
   picks it up on the next poll (~5 seconds).
2. **The site is a view plus a controlled write path.** All writes go through a
   permission-checked, audited command API. Nothing else writes to the sheet.

---

## Quick start

```bash
npm install --legacy-peer-deps     # the flag is required for this dependency set
copy .env.example .env.local       # then fill it in (see Environment below)
npm run setup-sheet                # creates/seeds the tabs in your spreadsheet
npm run dev                        # http://localhost:3000
```

With `DEMO_MODE` unset the site runs on bundled demo data — no credentials, nothing
written anywhere. That is the fastest way to look around.

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Scoring, ranking, filtering, permissions and paste-parsing tests (46) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check-sheet` | Read-only health check of the live sheet |
| `npm run setup-sheet` | Create/seed tabs (never overwrites a tab that holds data unless `--force`) |
| `npm run beautify-sheet` | Re-apply formatting, the Dashboard and the Guide tabs (`--dry-run` to preview) |
| `npm run service-account-json` | Emit the key file as one line, for Vercel |
| `npm run create-admin -- --list` | Accounts: list / bootstrap / reset / disable (Super Admin) |
| `npm run backup-sheet` | Dump every raw tab to `backups/<date>/*.csv` (read-only) |
| `npm run rehearse` | End-to-end write-path rehearsal against a running server |
| `npm run optimize-logos` | Rebuild `public/logos/**` from `logos/source/**` |

---

## Roles

| Role | Can |
| --- | --- |
| **Public** | Read everything. No login. |
| **PIO** | Enter results, publish/unpublish them, post announcements. |
| **Secretariat** | Everything PIO can, plus locked events, events/teams/criteria, point system, audit log, CSV exports and the reveal. |
| **Super Admin** | Everything Secretariat can, plus creating and editing accounts. |

Accounts live in the **Users** tab. Passwords are bcrypt hashes — never plain text.
Sessions are signed JWTs in an httpOnly cookie; logins are rate-limited.

Only a **Super Admin** can manage accounts, and only from **Admin → Accounts**.
Bootstrap the first one from the command line (the app cannot create its own first
login), then hand out the rest in the UI:

```bash
npm run create-admin -- superadmin --generate superadmin
```

`create-admin` stays available as the recovery path — list, add, reset, disable or
remove an account, with lockout protection on the last active Super Admin:

```bash
npm run create-admin -- --list
npm run create-admin -- pio-day1 --generate pio
npm run create-admin -- --disable pio-day1
```

> Give every person their own account. The audit log records the **account**, not the
> human — shared logins make the trail useless exactly when you need it.

---

## How the scoring works

Each event carries a **medal weight** (the number of medals it puts at stake: 1 gold,
1 silver, 1 bronze for the top three, and 1 participation point to everyone else).
Placement converts to points through a table you can edit in **Admin → Point system**:

| Placement | Points |
| --- | --- |
| 1st | 10 |
| 2nd | 7 |
| 3rd | 5 |
| 4th | 3 |
| 5th and below, or competed without placing | 1 |

An event's `multiplier` scales those points. Judged events average weighted criteria
(with a tie-break criterion); team sports are scored from a round-robin or a bracket
including **third-place (bronze-medal) matches** — see `src/lib/scoring/match.ts`.

**How a crew wins the championship** is configurable (`championshipRankBy`):

- `gold_first` *(default, and what the manual specifies)* — most golds, then silvers,
  then bronzes.
- `total_medals` — most medals in total.
- `weighted_points` — most points.

A group filter (faculty / extension campus) **only hides rows**. It never re-ranks.

`1 medal = ฿100,000` bounty. The Bounty Board is the leaderboard; the terminology
toggle (`Admin → Point system`) switches between the pirate flavour and plain
wording for official printouts.

---

## Architecture at a glance

```
Google Sheet ──poll (~5s)──> state store (server singleton now-last-good)
                                   │
                    ┌──────────────┴───────────────┐
              SSE /api/stream              poll /api/state + /api/version
                    │                              │
                    └──────────> browsers (public, admin, /display TV mode)
```

- **Server** — Next.js App Router, React Server Components, Tailwind v4.
  A single server-side store polls the sheet and keeps the last known good state, so
  a slow or failing sheet never blanks the screen; clients show a *reconnecting*
  badge instead.
- **Transport** — SSE (`/api/stream`) with an automatic polling fallback, so one
  locked-down network can't take the site down.
- **Google access** — a small REST client that signs its own RS256 JWT (no
  `googleapis` dependency), authenticating as a **service account**.
- **Writes** — the command API (`/api/admin/command`) is the only write path.
  Each command checks a permission, validates with Zod, writes, and appends to the
  audit log.
- **Draft → publish** — results enter as drafts (invisible publicly) and are
  published deliberately. Locked events are Secretariat-only.

Key directories:

```
src/app/            routes (public, /admin/*, /display)
src/components/     UI, including components/admin/*
src/lib/data/       sheet + demo repositories, seed catalog, command schema
src/lib/scoring/    placement, judged, match, rank, medals — all pure
src/lib/auth/       sessions, permissions
scripts/            setup/check/beautify sheet, admin creation, logo pipeline
docs/               the guides in this folder
```

---

## Environment

Copy `.env.example` to `.env.local`. Full detail is in that file; the short version:

| Variable | Purpose |
| --- | --- |
| `DEMO_MODE` | `0` to use the real sheet; unset/`1` for bundled demo data |
| `GOOGLE_SHEET_ID` | The spreadsheet id from its URL |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Path to the key file (**local only**) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The key file as one line (**required on Vercel**) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | Split-credential alternative |
| `AUTH_SECRET` | ≥16 chars; signs the session cookie. Required in production |
| `SHEET_POLL_MS` | Sheet poll interval, default `5000` |

Credential precedence is JSON → file → email+key, so a JSON variable set for a Vercel
test also takes effect locally, overriding the file.

---

## Deploying

Target: **Vercel** (app) + the existing Google Sheet. Serverless functions have no
disk, so:

1. Push the repository to GitHub and import it in Vercel.
2. **Settings → Environment Variables** — set `GOOGLE_SERVICE_ACCOUNT_JSON`,
   `GOOGLE_SHEET_ID`, `AUTH_SECRET`, `DEMO_MODE=0` for **Production and Preview**.
   Do *not* set `GOOGLE_SERVICE_ACCOUNT_FILE` there.
3. Share the Google Sheet with the service-account email as an **Editor**.
4. Deploy, then open `/api/state` and confirm `"kind":"sheets"` and `"ok":true`.

Generate the single-line JSON with `npm run service-account-json`.

---

## Monitoring, backups and health

The public UI shows a "reconnecting" pill when the sheet is unreachable — but nobody
is watching that at 8am on day one. Two cheap safeguards close the gap:

```bash
npm run backup-sheet     # backups/<date>/*.csv — every raw tab, read-only
```

`backups/` is gitignored: it contains the password hashes. Run it nightly (Task
Scheduler, a cron, or by hand) — Google's version history is otherwise the only
restore path, and you do not want to discover that mid-festival.

**Uptime monitoring.** `GET /api/health` returns **200** when the store is healthy
and **503** when the sheet is unreachable:

```json
{ "ok": true, "kind": "sheets", "lastSyncedAt": "...", "version": "ejkt1p",
  "teams": 12, "events": 97, "medalsAtStake": 426 }
```

Point a free monitor (Better Stack, UptimeRobot) or a Vercel cron at
`https://<your-app>.vercel.app/api/health` and alert on anything that is not 200.
Watching `medalsAtStake` also catches a silent data problem: it should read 426.

## Performance (measured, not assumed)

Lighthouse on the production build (`npm run build && npm start`):

| Category | Mobile | Desktop |
| --- | --- | --- |
| Performance | **84** | **98** |
| Accessibility | 98 | 98 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |

Desktop reports FCP 0.3s, LCP 0.9s, TBT 80ms and Speed Index 1.0s — every metric
in Lighthouse's "good" band, so the 90+ target is met where it is normally
assessed. Mobile runs under 4× CPU throttling and slow 4G, where the floor for a
React 19 / Next App Router app is the framework itself: react-dom alone is a
224 KB chunk and the Next runtime another 110 KB.

The Bounty Board started at **59** on mobile. Two fixes, each verified by
re-measuring:

1. **59 → 68** — the twelve leaderboard cards animated in from `opacity: 0`, so
   nothing could paint until JS hydrated (FCP 1.1s but LCP 4.1s, Speed Index
   5.7s). The entrance is now scale-only: Speed Index fell to 4.0s.
2. **68 → 84** — two `backdrop-filter` blurs were forcing real paint work:
   `.panel`'s (twelve of them on that page, on a gradient that is already ~93%
   opaque) and the sticky header's, which re-blurred on every scroll frame.
   Total Blocking Time fell from 750ms to 300ms.

**If you want mobile above 90** the remaining lever is JavaScript: motion is its
own 136 KB chunk, and `LazyMotion` with the `domAnimation` feature bundle would
roughly halve it — but that requires dropping the `layout` animations in
`leaderboard`, `events`, `sports` and `medal-table`, since layout animations force
the heavier `domMax` bundle. Expect a few points, not nine; the rest is framework
floor.

## Supabase shared cache (designed, not yet implemented)

Contained to `StateStore.ensureFresh`. One Postgres row holds the snapshot and a
short advisory lease; whichever instance holds the lease polls Sheets, everyone
else reads that row. This is simultaneously the **cross-instance half of the write
race** (the single-instance half is already closed by the write queue) and the
structural fix for Sheets load, since only the lease holder polls.

```sql
create table if not exists tally_snapshot (
  id text primary key,
  payload jsonb not null,
  version text not null,
  updated_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz
);
alter table tally_snapshot enable row level security;  -- no policies: service_role only
```

RLS with **no policies** is deliberate: the anon key cannot touch the table at all,
and only `service_role` (which bypasses RLS) can. Never use the anon key
server-side for this — it is embedded in every page the browser receives.

One decision to make before implementing: the cached payload is the full raw
snapshot, which includes the bcrypt password hashes and the audit log. Caching it
puts that data in two places; storing a hash-free projection of the state instead
is the safer choice.

## Documentation

- [`docs/sheet-template.md`](docs/sheet-template.md) — every tab, every column, who edits what.
- [`docs/pio-guide.md`](docs/pio-guide.md) — the PIO's day-of workflow.
- [`docs/secretariat-guide.md`](docs/secretariat-guide.md) — the Secretariat's guide, including the rulebook.
- [`docs/competition-day-checklist.md`](docs/competition-day-checklist.md) — the run-of-show checklist.
- [`logos/README.md`](logos/README.md) — how the crew logos are produced and used.

---

## Known limitations

Deliberate, documented gaps — the manuals leave these open:

- The "double bronze ⇒ 0.05 tie-break point" rule is not modelled.
- An event with only 2 participants is treated as normal (the manual gives gold only).
- An event with only 1 participant still awards a placement.
- Only 1st–3rd contribute medals; 4th place and up score participation points only.
- `Live Band Competition` carries a `verify` flag: the printed line says 5 medals while
  its own sub-total only adds up with 9. Confirm with OSCAL and correct the sheet.

See [`docs/secretariat-guide.md`](docs/secretariat-guide.md) for what to do about
each of these before competition day.
