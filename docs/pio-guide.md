# PIO guide

You enter results and publish them. Everything you type is attributed to your account
in the audit log, so **use your own login.**

- Log in at `/login` with the username and passphrase the Super Admin gave you.
- Your account has the **PIO** role: results, publishing and announcements.
  Anything else is out of your reach by design — that's not a bug.

> **Golden rule:** a result is not real until it is **published**. Drafts are invisible
> to the public, to the Bounty Board and to the medal tally.

---

## Your three screens

| Screen | Use it for |
| --- | --- |
| `/admin` — **Quick result entry** | Placements. Most events, most of the day. |
| `/admin/matches` | Team sports: brackets and round-robin games. |
| `/admin/judges` | Judge scores for judged events (pageants, contests). |
| `/admin/announcements` | The public ticker and the TV display. |

All four are also reachable from the tabs at the top of `/admin`.

---

## Entering a placement event (the common case)

1. Open `/admin`.
2. Choose the event in the **Event / island** dropdown. It's grouped by category, and
   locked events are marked *(locked)*.
3. Read the pills under the dropdown. They tell you how many **medals are at stake**,
   the scoring type, and whether the event carries a multiplier or a `verify` flag.
4. Set each crew's **Placement**. Give every crew that competed a placing — 4th earns
   3 points, 5th and below earn the participation point. Leave crews that didn't
   compete at *— none —*.
5. **Save as draft** if you want to check it, or **Save & publish** to put it live.
6. Watch the little confirmation strip. It tells you how many placements were saved.

### Ties

Two crews genuinely level? Give them the same placement and tick **Tie** on both.
The site refuses a duplicated placement that isn't declared a tie, so you can't do it
by accident.

### Bulk paste from Excel

Doing a dozen crews by hand is fine. Doing forty is not. Use **Bulk paste from Excel**:

1. Type or paste one crew per line, crew then placement:

   ```
   FBM	1
   FACET	2
   FALS	3
   ```

   Tab, comma or spaces all work, in either order (`1 FBM` is fine). Full faculty
   names and mascots work too (`The Griffins 2`).
2. Use `-` for "competed but not placed" and add `*` to a placement to declare a tie
   (`FBM 1*`).
3. Read the preview. Each line shows what it was understood as; anything it couldn't
   match is listed in amber with a reason.
4. Press **Send to the grid**. The grid fills in — **nothing is saved yet.**

Then review the grid and save as draft or publish, as usual. Bad lines are skipped
rather than guessed at, so a typo can never become a result.

**Copy grid** does the reverse: it copies the current grid as text you can paste into
Excel, fix in bulk, and paste back.

### Undo

**Undo** reverses your last save for the event you're on. It's a real undo — it
restores exactly what was there before. It only remembers your session, so don't rely
on it after closing the tab.

---

## Entering a team sport (bracket or round-robin)

Open `/admin/matches`.

1. Pick the **event**. Any games already recorded are listed.
2. Add each game: the **Round**, both crews, the set scores, and the status.
   The Round field suggests the only five labels the scoring understands —
   *Round 1*, *Quarterfinal*, *Semifinal*, *Bronze Medal Match*, *Final*.
   Use **Bronze Medal Match** for the third-place playoff: its loser takes the
   bronze. Note that *Semifinal* is not the final.
3. Set a game's status to `final` once it ends — only final games count.
4. When the **decisive final** is `final`, the site derives the whole bracket's
   placements and publishes them. You don't enter placements by hand for team
   sports.

> Round-robin events are read straight from the recorded games; the standings are
> computed for you.

> If you ever need to override a bracket result by hand, type it into `/admin` for
> that event. A hand-entered result suppresses the bracket-derived one completely —
> no double counting.

---

## Entering judge scores

Open `/admin/judges`.

1. Choose the **Judged event**, then type the **Judge**'s name — judges already
   recorded for that event are offered as one-tap chips underneath.
2. Fill each crew's score for each criterion. The criteria and their weights run along
   the top of the matrix; the Secretariat maintains them in the **Criteria & weights**
   panel on this same screen.
3. Save. Scores are averaged into a weighted total and the placements fall out of
   that — never type placements yourself for a judged event.

On a phone the criteria columns scroll sideways with the crew name pinned in place.

---

## Announcements

Open `/admin/announcements` and post a short message. It appears in the ticker at the
top of every page and on the TV display within seconds. Keep it to one line: the
ticker has no room for an essay.

Good: *"Basketball (M) tips off at the gym, 3:00 PM — cheer for your crew!"*
Bad: *"results"*

---

## The TV display

`/display` is the big-screen mode: full-height, auto-rotating slides (overall
championship, medal tally, live matches, latest results, announcements), arrow keys to
change slide, space to pause.

Open it on the laptop driving the projector, press **F11** for fullscreen, and leave
it. It updates itself.

---

## When something looks wrong

| Symptom | What's happening | What to do |
| --- | --- | --- |
| A "Reconnecting" badge appears | The server lost contact with the sheet, or the venue network dropped | Keep working if the banner is green; if it stays red, tell the Secretariat. Your unsaved typing is still on screen. |
| "This event is locked" | The Secretariat locked it (common for events under protest or already final) | Ask the Secretariat to unlock or edit it. |
| An amber `verify` pill | That event's medal weight is unconfirmed | Don't publish until the Secretariat clears it. |
| "Placement *n* is used twice" | Two crews share a placement without a tie | Tick **Tie** on both, or fix the placement. |
| A save says it failed | The write didn't reach the sheet | Don't retype. Read the message, then press save again. |
| The public site shows old numbers | Nothing is published for that event, or it's a draft | Check the event's status on `/admin`. |

---

## What not to do

- **Don't share a login.** The audit log names the account, not the person; a shared
  login makes the trail worthless. Ask for a second account instead.
- **Don't edit the Google Sheet directly while others are using the site** unless you
  have to. Hand edits skip validation. If you do, run `npm run check-sheet` after.
- **Don't publish on a `verify` flag.** Those are unconfirmed numbers.
- **Don't re-enter a team sport by hand** once the bracket is final — you'll suppress
  the derived placements and lose the bronze.
