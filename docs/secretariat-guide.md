# Secretariat guide

You own the competition. The site is a tool that enforces the rules you set — where
the manual is ambiguous, the decisions in this document are the ones implemented, and
this is where they are written down.

Your role can touch events, teams, criteria, the point system, the audit log and the
reveal. **Accounts are owned by the Super Admin** — the one thing deliberately kept
out of your hands, so the user list cannot be rewritten by anyone who can also edit
scores.

---

## Before competition day

### 1. Clear the `verify` flags

`npm run check-sheet` lists every event still flagged `verify`. Each one is a
`medal_weight` nobody has confirmed against the manual, usually because the
printed line and that section's own sub-total disagreed. Get OSCAL to confirm the
number, set `medal_weight` on the `Events` tab, then untick `verify`. The
`Dashboard` shows the row amber until you do, and `check-sheet` keeps warning.

The flag is advisory — a flagged event still scores normally — so it is easy to
leave one behind by accident. That is exactly why the Dashboard colours it.

### 2. Hand out the logins

Accounts belong to the **Super Admin**. The first one is created from the command
line (the app cannot bootstrap itself), after which everything is done in the app:

```bash
npm run create-admin -- superadmin --generate superadmin
```

That prints a generated password once — save it, then sign in and open
**Admin → Accounts**. From there, create one account per person:

| Role | Can do |
| --- | --- |
| **PIO** | Enter and publish results, score matches, post announcements |
| **Secretariat** | Everything PIO can, plus events, locks, teams, criteria, point system, audit log, CSV exports, reveal |
| **Super Admin** | Everything above, plus creating and editing accounts |

Passwords are bcrypt-hashed into the `Users` tab; nothing is stored in plain text.
Untick **Account active** to disable someone without deleting them, and use
**Reset password** to issue a new one — an existing password can never be read back.
The last active Super Admin cannot be demoted, disabled or deleted (lockout
protection).

`create-admin` stays available as the recovery path if every login is ever lost:

```bash
npm run create-admin -- --list
npm run create-admin -- <username> --generate <role>
npm run create-admin -- --disable <username>
npm run create-admin -- --remove <username>
```

> **One account per person.** The audit log records the account, not the human.
> Shared logins destroy its value precisely when a result is disputed.

### 3. Health-check the sheet

```bash
npm run check-sheet
```

Read-only. It exits non-zero if anything is wrong: missing tabs or headers, unknown
event ids in `Results`/`Criteria`, duplicate results, zero-weight criteria. Run it
again after any hand-editing session during the festival.

### 4. Rehearse

Pick one event, enter a bracket through to a final, publish it, and watch three things
at once: the Bounty Board, the `Dashboard` tab, and `/display`. If all three agree,
the plumbing is sound. Then unpublish and clear it.

---

## The competition rules, as implemented

**Each event's medal weight is the number of medals it puts at stake.** 1st takes gold,
2nd silver, 3rd bronze; everyone else earns a participation point.

**The Overall Championship is decided by `gold_first`** — the most golds, tie-broken by
silvers, then by bronzes. This is what both SIGLAKAS 2026 manuals specify. The
alternative rankings (`total_medals`, `weighted_points`) are available under
**Admin → Point system** if you ever need them, but you shouldn't.

**Both divisions count.** Sports and socio-cultural medals roll into the same overall
title. The division filters on the site are views, not separate championships.

**The group filter never re-ranks.** Filtering to faculties or extension campuses hides
rows; the ranks stay as they are on the full board. This is deliberate — a filtered
rank would be a lie about the championship.

**Placement → points** (editable under Admin → Point system):

| Placement | 1st | 2nd | 3rd | other placed | participation |
| --- | --- | --- | --- | --- | --- |
| Points | 10 | 7 | 5 | 3 | 1 |

Points feed the bounty (×100,000) and the `weighted_points` ranking; they do **not**
decide the championship under `gold_first`.

### Team sports

The manual's formats are implemented in `src/lib/scoring/match.ts`:

- **Round robin** for 3 or fewer entries,
- **Double elimination** for 4 or more,
- **Single elimination** for a knockout,
- medals are awarded on **final placing**, and the **bronze-medal match counts** —
  the loser of the third-place playoff takes the bronze.

Placements are derived automatically once the decisive final is marked `final`.
A hand-entered result for the same event overrides the derived ones entirely.

### Judged events

Weighted criteria, averaged across judges, with a tie-break criterion. Enter only the
judges' raw scores; let the site compute the placements.

---

## Where the manual is silent — and what to do

These gaps are deliberate and documented. Each has a workaround, and every workaround
should be noted in the audit log (post an announcement, or record it on the sheet) so
the decision is defensible.

| Situation | What the manual says | What the site does | Your workaround |
| --- | --- | --- | --- |
| "Double bronze" tie-break of 0.05 points | Awarded in a specific case | Not modelled | Resolve by hand and record the reasoning; the board will order by gold → silver → bronze. |
| An event with only **2** participants | Gold only, no silver | Awards gold *and* silver | Enter the winner's placement only. Leave the other crew as *competed, not placed* so it earns participation, not silver. |
| An event with only **1** participant | No gold | Still awards gold | Leave the lone crew as *competed, not placed*, or don't score the event at all. Decide with OSCAL before it happens. |
| 4th place and up | No medal | No medal — 4th still earns 3 points, below that the participation point | Nothing to do. |
| An event that ends in a genuine draw | Unspecified | Use the **Tie** flag; both crews share the placement and the medal | Declare the tie and note it. |

---

## Day-to-day controls

### Locking an event

When a result is final, under protest, or already announced, lock it: **Admin → Events**,
tick **Locked**. PIOs can then see the event but not edit it; you still can. Unlock it
when the protest clears.

### Freezing the board and the reveal

**Admin → Point system → Suspense**:

- **Freeze the public board** (`points_freeze`) hides the standings from viewers —
  the home board, the Medal Tally page, every crew page, and the TV slides (which
  drop to announcements plus a sealed screen). Use it before a closing-ceremony
  announcement so the reveal isn't spoiled. Per-event results stay visible; the
  freeze hides the standings, not who placed in what.
- **Reveal mode** drives the closing presentation.

Both are one switch away and instant. Unfreeze as soon as the ceremony ends, or the
public site looks broken.

### Closing the board for maintenance

**Admin → Point system → Suspense → Close the board (maintenance)** (`maintenance`)
does something stronger than a freeze: every page and both live feeds
(`/api/state`, `/api/stream`) serve a holding screen instead of the tally. Freeze
hides *who is winning*; maintenance hides *everything*, including event pages and
the API payload, so a correction can be made in private.

Use it when the numbers are wrong rather than unannounced — fixing a medal weight,
re-attributing a crew, or cleaning up a run of bad rows. The moment the switch is
on, a viewer who already had the board open loses it too; the moment it is off,
they get it back without reloading.

- Signed-in crew see the real board the whole time — that is how you check the fix.
  `/login` is closed along with everything else, so sign in from the holding screen.
- The public cannot fetch the data while it is closed: the endpoints return an empty
  board, not the working copy.
- Turn it **off** when the correction is finished and verified. It is not a
  substitute for `points_freeze` and leaving it on makes the site look abandoned.

### The audit log

**Admin → Audit** lists every write: when, who, what, and the before/after values.
It's append-only and never edited by the site. On a phone it renders as cards.

When someone disputes a result, this page is the answer. Read it before defending
anything.

### Announcements

You and PIOs can post to the ticker from **Admin → Announcements**. Keep them one line.

---

## Housekeeping

```bash
npm run check-sheet              # health check (read-only)
npm run setup-sheet              # add missing tabs/headers; --force to re-seed
npm run beautify-sheet           # re-apply colours, widths, banding, Dashboard, Guide
npm run create-admin -- --list   # accounts (day-to-day: Admin → Accounts, Super Admin)
```

`beautify-sheet` is idempotent — safe to re-run at any time, and the way to restore
the `Dashboard` and `Guide` tabs if someone clears them.

**The `Dashboard` and `Guide` tabs are yours to read, not to edit.** Both are
formulas and reference text; the app never touches them, and re-running
`beautify-sheet` restores them.

---

## Runbook

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Site shows "reconnecting" | Sheet unreachable, or the venue network dropped | Check the sheet opens in a browser and that the service account still has editor access. The site keeps serving the last known good state meanwhile. |
| Numbers on the site differ from your spreadsheet | Someone edited the sheet by hand, or a draft wasn't published | Compare the `Results` tab with the event's status. Publish if needed, then `npm run check-sheet`. |
| A PIO says an event is locked by mistake | Someone ticked **Locked** | Unlock it under **Admin → Events**. |
| The public board is empty | `points_freeze` is on, or nothing is published | Check Admin → Point system, then the publish status of recent results. |
| A medal total is wrong | Wrong `medal_weight`, or a duplicate/mistyped result | Check the event's weight against the manual, then the `Results` rows. `check-sheet` flags duplicates. |
| `check-sheet` reports a zero-weight criterion | A judging criterion lost its weight | Fix it under **Admin → Judges → Criteria**. |
| Someone leaves, or their account is compromised | — | Ask the Super Admin to untick **Account active** on **Admin → Accounts**, or to reset the password. `npm run create-admin -- --disable <user>` also works. |
| Nobody can create accounts | The Super Admin account was lost | Recover with `npm run create-admin -- <user> --generate superadmin`, then sign in at `/login`. |

### Escalation

If the sheet itself is damaged: **do not** run `setup-sheet --force` while the
festival is running — it re-seeds the tabs. Restore from the sheet's version history
(File → Version history) instead, then run `npm run check-sheet`.
