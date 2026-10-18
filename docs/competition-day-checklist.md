# Competition-day checklist

Print this. Work top to bottom. Times are relative to the opening ceremony.

---

## The day before (T-24h)

- [ ] **Confirm the `Live Band Competition` medal weight** with OSCAL; set it on the
      `Events` tab and clear the `verify` flag.
- [ ] **Rotate the Super Admin password** and create one account per PIO/Secretariat
      member from **Admin → Accounts**. No shared logins.
- [ ] **Run the health check** — `npm run check-sheet`. It must report no problems.
- [ ] **Take a baseline backup** — `npm run backup-sheet`. Note that
      `medalsAtStake` must read **426** on `/api/health`.
- [ ] **Point a monitor at `/api/health`** and confirm it alerts on a 503. The
      sheet connection is the one thing that fails silently otherwise.
- [ ] **Re-apply the sheet styling** — `npm run beautify-sheet` (restores the
      `Dashboard` and `Guide` tabs).
- [ ] **Rehearse once** — `npm run rehearse`. It enters a placement, publishes it,
      confirms the Bounty Board, the `Dashboard` tab and the engine all agree, then
      removes exactly what it added. The manual version: enter a bracket by hand,
      publish it, and confirm the same three agree.
- [ ] **Charge everything**: the projector laptop, the backup laptop, the phone
      hotspot, the tablet if you're using one.
- [ ] **Print the PIO guide.** Give one to each PIO.

---

## Two hours before

- [ ] **Confirm the sheet is reachable** and the service account still has **Editor**
      access to it.
- [ ] **Start the site** (`npm start` on the venue laptop, or open the deployed URL).
- [ ] **Open `/api/state`** and confirm `"kind":"sheets"` and `"ok":true`.
- [ ] **Open `/display`** on the projector laptop, press F11 for fullscreen, leave it
      rotating.
- [ ] **Post a welcome announcement.**
- [ ] **Check the public board is not frozen** (Admin → Point system → `points_freeze`
      must be off).
- [ ] **Verify the numbers**: 12 crews, 97 events, 426 medals on the `Dashboard`.
- [ ] **Note the sheet URL and the version-history path** on paper, in case you need
      to roll back quickly.

---

## Thirty minutes before

- [ ] **Log in every PIO** and confirm each sees the admin tabs matching their role.
- [ ] **Walk the first two events of the day with the PIOs**, on the real screens.
- [ ] **Agree the channel**: who announces a result, and who publishes it.
- [ ] **Agree the fallback**: if the network dies, results go on paper and are entered
      when it returns. Nominate who holds the paper.

---

## During the festival

Per event, in order:

- [ ] Confirm the **medal weight** matches the manual for that specific event.
- [ ] Lock any event the Secretariat has already finalised.
- [ ] Enter results as **draft** first for anything close or contested.
- [ ] **Publish** — drafts are invisible to everyone.
- [ ] Announce it if it's a headline result.
- [ ] Watch the `Dashboard` tab for the amber `verify` rows: they should be zero.

Every few hours:

- [ ] **Spot-check three published events** against the manual's medal counts.
- [ ] **Glance at the audit log** for actions you don't recognise.
- [ ] **Confirm the ticker** isn't showing something stale.
- [ ] **Check the projector** is still on `/display` and still updating.

If something goes wrong:

- [ ] Numbers wrong → compare the `Results` rows with the event status, then
      `npm run check-sheet`.
- [ ] Site "reconnecting" → it's serving the last known good state; keep working, and
      investigate the sheet access in parallel.
- [ ] Disputed result → read the **audit log** before responding.
- [ ] Sheet damaged → **restore from version history**, do *not* re-run
      `setup-sheet --force` mid-festival.

---

## Before the closing ceremony

- [ ] Ensure **every** event is either published or deliberately withheld. No event
      should be left as a draft by accident.
- [ ] Resolve every crew's tied position that the manual says needs a tie-break.
- [ ] Turn on **`points_freeze`** if you want the board hidden until the reveal.
- [ ] Confirm the final ordering on the `Dashboard` against the manual's rule
      (most golds → silvers → bronzes).
- [ ] Prepare the announcement text.

---

## The reveal

- [ ] Turn **`points_freeze`** off.
- [ ] Open **reveal mode** (Admin → Point system).
- [ ] Put `/display` on the projector.
- [ ] Announce placements from the bottom up.
- [ ] Turn reveal mode off when the ceremony ends.

---

## After (archive)

- [ ] Export or duplicate the sheet as the official record of SIGLAKAS 2026
      (File → Make a copy, named with the date).
- [ ] Confirm the `AuditLog` tab is intact.
- [ ] Set `active` to `FALSE` (or untick **Account active** under **Admin → Accounts**)
      for every temporary account.
- [ ] Post a closing announcement.
- [ ] Save a PDF of the final `Dashboard` for the records.

---

## Emergency reference

| Need | Where |
| --- | --- |
| Sheet | `docs/sheet-template.md`, and the sheet's own `Guide` tab |
| PIO workflow | `docs/pio-guide.md` |
| Rules and runbook | `docs/secretariat-guide.md` |
| Sheet health | `npm run check-sheet` |
| Restore formatting/Dashboard | `npm run beautify-sheet` |
| New account | **Admin → Accounts** as the Super Admin, or `npm run create-admin -- <user> --generate <role>` |
| Who changed what | Admin → Audit |
| Sheet rollback | Google Sheets → File → Version history |

Contacts (fill in by hand):

- Technical / site owner: ______________________________
- OSCAL: ______________________________
- Venue IT: ______________________________
- Sheet co-owner (backup Secretariat): ______________________________
