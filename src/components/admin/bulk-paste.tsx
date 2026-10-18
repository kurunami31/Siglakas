"use client";

import { useId, useMemo, useState } from "react";
import type { Team } from "@/lib/types";
import { parseBulkResults, toEntries, type BulkEntry, type TeamLite } from "@/lib/bulk-parse";
import { TeamBadge } from "@/components/team-badge";
import { Icon, MedalIcon } from "@/components/icons";

/**
 * Paste a whole event's placements out of Excel/Sheets.
 *
 * Nothing is written from here: the parsed rows are pushed into the normal grid
 * so the existing validation and the draft/publish buttons stay the only path
 * to the sheet.
 */
export function BulkPaste({
  teams,
  locked,
  onApply,
}: {
  teams: Team[];
  locked: boolean;
  onApply: (entries: BulkEntry[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const textId = useId();

  const lite: TeamLite[] = useMemo(
    () => teams.map((t) => ({ id: t.id, shortName: t.shortName, name: t.name, mascot: t.mascot })),
    [teams],
  );
  const parsed = useMemo(() => parseBulkResults(text, lite), [text, lite]);
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const entries = useMemo(() => toEntries(parsed.rows), [parsed.rows]);

  function apply() {
    onApply(entries);
    setMessage(`Sent ${entries.length} row${entries.length === 1 ? "" : "s"} to the grid — review them, then save.`);
  }

  /**
   * Read a chosen file straight into the textarea, so the preview, the
   * validation and the "send to grid" step all run exactly as they do for a
   * paste — nothing here writes to the sheet.
   *
   * CSV/TSV only, deliberately. Parsing .xlsx needs a spreadsheet library worth
   * several hundred KB, and Excel exports CSV in two clicks.
   */
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage("That file is over 2 MB — export just this event's rows, not the whole season.");
      e.target.value = "";
      return;
    }
    try {
      setText(await file.text());
      setMessage(`Read ${file.name} — check the rows below, then send them to the grid.`);
    } catch {
      setMessage("Could not read that file. In Excel use File → Save As → CSV UTF-8.");
    }
    // Let the same file be chosen again after an edit.
    e.target.value = "";
  }

  return (
    <div className="panel rounded-2xl">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 p-4 text-left"
      >
        <Icon name="scroll" size={18} className="shrink-0 text-straw" />
        <span className="font-display text-lg text-parchment">Import from Excel or CSV</span>
        <span className="ml-auto text-xs text-foam/60">{open ? "Hide" : "Show"}</span>
        <Icon name={open ? "arrowUp" : "arrowDown"} size={16} className="shrink-0 text-foam/60" />
      </button>

      {open && (
        <div className="space-y-3 border-t border-foam/15 p-4">
          <p className="text-xs text-foam/70">
            One row per crew: <span className="font-mono text-parchment">CREW</span> then{" "}
            <span className="font-mono text-parchment">PLACE</span>, in either order. Separate with a tab, a comma or
            spaces. Use <span className="font-mono text-parchment">-</span> for “competed but not placed” and add{" "}
            <span className="font-mono text-parchment">*</span> to a place to declare a tie (for example{" "}
            <span className="font-mono text-parchment">FBM 1*</span>).
          </p>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">
              Open a tally file (.csv or .tsv)
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              disabled={locked}
              onChange={onFile}
              className="w-full cursor-pointer rounded-lg border border-foam/25 bg-ink/60 px-3 py-2 text-xs text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-straw file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink disabled:opacity-50"
            />
            <span className="mt-1 block text-[0.7rem] text-foam/50">
              An .xlsx will not open here — in Excel use <strong className="text-foam/70">File → Save As → CSV UTF-8</strong>,
              or just copy the cells and paste below.
            </span>
          </label>

          <label className="block" htmlFor={textId}>
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Paste here</span>
            <textarea
              id={textId}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setMessage(null);
              }}
              rows={8}
              spellCheck={false}
              disabled={locked}
              placeholder={"FBM\t1\nFACET\t2\nFAHUSCIC\t3\nFALS\t-"}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2 font-mono text-xs text-parchment placeholder:text-foam/40 disabled:opacity-50"
            />
          </label>

          {text.trim().length > 0 && (
            <div className="space-y-2">
              <p role="status" className="text-xs text-foam/80">
                <strong className="text-parchment">{parsed.ok.length}</strong> read cleanly
                {parsed.problems.length > 0 && (
                  <>
                    {" · "}
                    <strong className="text-sunset">{parsed.problems.length}</strong> need attention
                  </>
                )}
                .
              </p>

              {parsed.problems.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-sunset/40 bg-sunset/10 p-2.5 text-xs text-sunset">
                  {parsed.problems.slice(0, 8).map((p) => (
                    <li key={p.line}>
                      <span className="font-mono">line {p.line}</span> — {p.error}
                    </li>
                  ))}
                  {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more.</li>}
                </ul>
              )}

              <div className="overflow-hidden rounded-lg border border-foam/15">
                <table className="w-full table-fixed text-xs">
                  <caption className="sr-only">What the pasted text was understood as</caption>
                  <thead>
                    <tr className="bg-ink/60 text-left text-[0.62rem] uppercase tracking-wider text-foam/70">
                      <th scope="col" className="w-10 px-2 py-1.5">Line</th>
                      <th scope="col" className="px-2 py-1.5">Understood as</th>
                      <th scope="col" className="w-16 px-2 py-1.5 text-center">Place</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r) => {
                      const team = r.teamId ? byId.get(r.teamId) : undefined;
                      return (
                        <tr key={r.line} className="border-t border-foam/10">
                          <td className="px-2 py-1.5 align-top font-mono text-foam/60">{r.line}</td>
                          <td className="px-2 py-1.5">
                            <span className="flex items-center gap-2">
                              {team ? (
                                <>
                                  <TeamBadge team={team} size={20} shape="square" />
                                  <span className="truncate font-semibold text-parchment">{team.shortName}</span>
                                  <span className="hidden truncate text-foam/60 sm:inline">{team.mascot}</span>
                                </>
                              ) : (
                                <span className="truncate font-mono text-foam/60">{r.raw}</span>
                              )}
                            </span>
                            {r.error && (
                              <span className="mt-0.5 block text-sunset">
                                <Icon name="warning" size={12} className="mr-1 inline align-[-1px]" />
                                {r.error}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center align-top">
                            {r.placement === 0 ? (
                              <span className="text-foam/60">none</span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                {r.placement <= 3 && (
                                  <MedalIcon
                                    kind={r.placement === 1 ? "gold" : r.placement === 2 ? "silver" : "bronze"}
                                    size={12}
                                  />
                                )}
                                {r.placement}
                                {r.tie && <span title="declared tie" className="text-straw">*</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {message && (
            <p role="status" className="rounded-lg border border-teal/40 bg-teal/10 p-2.5 text-xs text-teal">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={locked || entries.length === 0}
              className="rounded-lg bg-straw px-4 py-2.5 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-50"
            >
              Send {entries.length || ""} to the grid
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setMessage(null);
              }}
              disabled={text.length === 0}
              className="rounded-lg border border-foam/25 px-4 py-2.5 text-sm text-parchment/85 hover:border-straw hover:text-straw disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <p className="text-xs text-foam/60">
            Rows that need attention are skipped — fix them and paste again, or type those few by hand in the grid.
          </p>
        </div>
      )}
    </div>
  );
}
