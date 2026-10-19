# The sheet template

The Google Sheet is the **source of truth**. The website reads it, and writes back
through a controlled, audited path. This page is the contract between the two: what
each tab is for, who may edit it, and the handful of rules that keep the site from
losing data.

---

## The tabs

The workbook has twelve tabs. Ten hold app data; two are for humans only.

| Tab | Holds | Edited by |
| --- | --- | --- |
| `Config` | Competition name, championship rule, point table | Secretariat (via the site) |
| `Teams` | The 12 crews | Secretariat |
| `Events` | All 98 events and their weights | Secretariat (the `verify` flag by OSCAL) |
| `Criteria` | Judging criteria per judged event | Secretariat |
| `Results` | Placements — **the tally itself** | PIO + Secretariat (app, or by hand) |
| `Matches` | Bracket / round-robin games for team sports | PIO + Secretariat (app, or by hand) |
| `JudgeScores` | Raw scores per judge and criterion | PIO (app, or by hand) |
| `Announcements` | The public ticker | PIO + Secretariat |
| `Users` | Accounts and password hashes | Super Admin only |
| `AuditLog` | Append-only trail of every write | Nobody — written by the site |
| `Dashboard` | Live computed medal table and summary | Nobody — formulas only |
| `Guide` | In-sheet summary of these rules | Nobody — reference text |

### `Dashboard` and `Guide` exist because of one rule

The app reads each of its tabs with the range `A1:Z` and maps every row **by header
name**. When it writes a tab back it clears `A1:Z` first. So **any extra column you
add inside A–Z on an app tab will be wiped on the next write.** Anything computed
therefore lives on `Dashboard` and `Guide`, tabs the app never touches. Keep them.

---

## Rules that matter

1. **The header row is the schema.** The site finds columns by header name. Don't
   rename a header, don't reorder rows, don't delete the header row. Adding a new
   column to the *right* of the last column is safe (`Z` is the limit).
2. **Never renumber or reuse an id.** `Results` and `Matches` point at events and
   teams by id. Changing an id orphans its data.
3. **A tab that holds data is never overwritten by `setup-sheet`** unless you pass
   `--force`. Re-running the setup is safe.
4. **Prefer the site for row edits.** Typing straight into the sheet works (the site
   picks it up within ~5 seconds) but skips validation and lands in the audit log as
   an unexplained change.
5. **Don't insert columns in the middle of `Results`/`Events`.** Extra columns are
   wiped; the layout shifts the moment the app saves.
6. **Formatting is safe.** Colours, widths, banding and conditional formatting are
   all re-appliable with `npm run beautify-sheet`.

---

## Column reference

### `Config` — key / value

Plain key–value pairs. Edit through **Admin → Point system** and this tab is rewritten
for you; hand-editing is fine too.

| key | Meaning |
| --- | --- |
| `competition_name`, `school_name`, `subtitle` | Titles used across the site |
| `championship_rank_by` | `gold_first` *(default)*, `total_medals`, `weighted_points` |
| `medal_points_gold` / `_silver` / `_bronze` | Bounty weight of each medal, default 3/2/1 |
| `placement_1` … `placement_12` | Points for each placement (default 10, 7, 5, 3, …) |
| `participation` | Points for everyone else (default 1) |
| `terminology` | `onepiece` or `plain` |
| `points_freeze` | `TRUE` hides the public board until the reveal |
| `reveal_mode` | `TRUE` for the closing-ceremony reveal presentation |

### `Teams` — 12 rows

`id`, `name`, `short_name`, `group`, `color`, `logo_file`, `mascot`, `motto`, `logo_url`

- `id` — lowercase slug, e.g. `fbm`. Permanent.
- `group` — `faculty` or `extension_campus`. The site's filter uses this; it never
  affects ranking.
- `color` — the crew's official primary colour from the festival's identity
  sheet, as hex. Stored exactly as given; where a colour is too dark to read on
  the site's navy panels (FTED, CEC, TARRAGONA) the UI lifts it for display
  only — see `accentFor()` in `src/lib/format.ts`. Editing this never changes
  what is written back.
- `logo_file` — the folder under `public/logos/`; see [`logos/README.md`](../logos/README.md).

### `Events` — 98 rows

`id`, `name`, `division`, `category`, `scoring_type`, `medal_weight`, `gender`,
`multiplier`, `schedule`, `venue`, `status`, `locked`, `verify`, `note`

- `division` — `sports` or `cultural`.
- `scoring_type` — `placement` (highest wins), `judged` (criteria), `match` (bracket
  or round-robin).
- `medal_weight` — **the number of medals at stake.** 1st gets gold, 2nd silver,
  3rd bronze; every other participant gets a participation point. This is the number
  to check against the manual.
- `multiplier` — scales the points (leave `1` unless an event is weighted).
- `status` — `upcoming`, `live`, `finished`.
- `locked` — `TRUE` means only the Secretariat may edit the event's results.
- `verify` — `TRUE` flags the row for review. One event is flagged today:
  `Live Band Competition` (see the note at the end of this page).

### `Criteria` — judged events

`event_id`, `criterion`, `weight`, `order`

Weights are relative; they don't need to total 100. `order` sets the display order.
A criterion with a weight of `0` is highlighted red — usually a typo.

### `Results` — the tally

`event_id`, `team_id`, `placement`, `tie`, `status`, `entered_by`, `timestamp`

- `placement` — `1`–`12`; `0` means "competed, not placed" and earns participation points.
- `tie` — `TRUE` when two crews genuinely share a placement. A duplicate placement
  without a tie flag is rejected by the site.
- `status` — `draft` (invisible publicly) or `published` (counts immediately).
- `entered_by` — `bracket` marks a row the site derived from a finished bracket.
  A hand-entered result for the same event overrides it entirely.

One row per crew per event. To clear an event, unpublish it or delete its rows.

### `Matches` — team sports

`event_id`, `round`, `team_a`, `team_b`, `score_a`, `score_b`, `status`, `detail`, `winner`, `id`

The typed fields come first; **`winner` and `id` are hidden columns** because both are
derived — `winner` falls back to the higher score, and the app generates `id` as
`event--round--teamA-teamB`. So a fixture is really six values: which event, which
round, the two crews, the two scores.

- `event_id` — must match an Events id exactly. A typo scores nothing, **silently**.
  The admin banner and `npm run check-sheet` both flag it.
- `round` — a **strict dropdown** of the five labels the site understands:
  *Round Robin*, *Quarterfinal*, *Semifinal*, *Final*, *Bronze medal match*.
  Sheets will reject anything else, because an unrecognised round crowns nobody.
  **Final** decides 1st and 2nd; **Bronze medal match** decides 3rd.
- `team_a` / `team_b` — Teams ids (`fted`, `facet`…), dropdowns in the sheet.
- `status` — `scheduled`, `live`, `final`. Only `final` games count toward placements.
- `detail` — free text for display, e.g. `25–23, 25–19`.
- `winner` — leave blank to use the higher score; fill it only when the scores tie.

Two things that surprise people:

- **A bronze-medal match is the only source of bronze.** Omit that row and the event
  publishes gold and silver only.
- **A pure round-robin event is decided by its pool table**, but only once *every*
  pool fixture is `final`. Until then it awards nothing. A knockout event with a
  `Final` row is never decided by its pool stage.

Hand-entered `Results` rows for an event always take precedence over anything derived
from matches, so use one route per event — never both.

### `JudgeScores`

`event_id`, `team_id`, `judge`, `criterion`, `score`

One row per crew, per judge, per criterion — the largest tab by far (~6,000 rows over
a festival). Scores outside the valid range are highlighted red.

### `Announcements`

`timestamp`, `message`, `posted_by` — newest drives the ticker and `/display`.

### `Users`

`username`, `password_hash`, `role`, `team_id`, `active`

Hashes are bcrypt. Add them from **Admin → Accounts** as a Super Admin, or with
`npm run create-admin` (bootstrap and recovery). Never type a hash in by hand.
`role` is one of `pio`, `secretariat` or `superadmin`.
`active` = `FALSE` disables an account without deleting it.

### `AuditLog`

`timestamp`, `actor`, `action`, `entity`, `entity_id`, `field`, `old_value`, `new_value`

Append-only, written by the site. It's the answer to "who changed this?".

---

## Maintenance

```bash
npm run check-sheet      # read-only health check; exits non-zero on problems
npm run setup-sheet      # add any missing tabs/headers; --force to re-seed
npm run beautify-sheet   # re-apply colours, widths, banding, Dashboard and Guide
```

`check-sheet` is the one to run before competition day and after any hand-editing
session. It reports missing tabs, missing headers, unknown event ids, duplicate
entries and criteria with a zero weight.

### The one open question

`Live Band Competition` is flagged `verify`. The manual's printed line says **5**
medals, but the sub-total of that section only adds up with **9**. Confirm the number
with OSCAL, correct `medal_weight` on the `Events` tab, then clear the `verify` flag.
Until then the row is amber on the `Dashboard`.
