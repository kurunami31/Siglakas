"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuditLog } from "@/lib/admin-client";
import { relativeTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { Icon } from "@/components/icons";

/**
 * Read-only audit trail. The entries live server-side (never in the public
 * state payload), so this screen pulls them from /api/admin/audit.
 */
export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAuditLog(300);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Could not load the audit log");
      return;
    }
    setError(null);
    setEntries(res.entries);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.actor, e.action, e.entityId, e.newValue].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [entries, query]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
          <Icon name="scroll" size={26} className="text-straw" /> Audit log
        </h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foam/25 px-3 py-2 text-sm hover:border-straw hover:text-straw disabled:opacity-50"
        >
          <Icon name="undo" size={14} /> {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="panel rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Filter</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Actor, action or event id…"
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
          />
        </label>
        <p className="mt-2 text-xs text-foam/60">
          {rows.length} entr{rows.length === 1 ? "y" : "ies"}
          {query ? ` matching “${query}”` : ""}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-blood/40 bg-blood/10 p-2.5 text-sm text-parchment">
          {error}
        </p>
      )}

      {/* Bounded height so a long trail scrolls inside the card instead of
          pushing the rest of the control room off-screen. Focusable so it can
          also be scrolled with the keyboard. */}
      <div
        role="region"
        aria-label="Audit log entries (scrollable)"
        tabIndex={0}
        data-print-expand
        className="panel max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-straw"
      >
        {/* Phones get cards — four columns cannot fit 320px without a nested
            horizontal scroller. */}
        <ul aria-label="Audit entries" className="divide-y divide-foam/10 sm:hidden">
          {rows.map((e, i) => (
            <li key={`m-${e.timestamp}-${i}`} className="space-y-1.5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-foam/70" title={e.timestamp}>{relativeTime(e.timestamp)}</span>
                <span className="font-semibold text-parchment">{e.actor}</span>
                <span className="ml-auto rounded bg-straw/15 px-1.5 py-0.5 font-mono text-[0.68rem] text-straw">
                  {e.action}
                </span>
              </div>
              <p className="text-xs">
                <AuditDetail entry={e} />
              </p>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="p-4 text-sm italic text-foam/60">{loading ? "Loading…" : "Nothing recorded yet."}</li>
          )}
        </ul>

        <table className="hidden w-full border-collapse text-sm sm:table">
          <caption className="sr-only">Every write action recorded by the system</caption>
          <thead className="sticky top-0 z-10 bg-ink">
            <tr className="border-b border-foam/20 text-left text-[0.68rem] uppercase tracking-wider text-foam/80">
              <th scope="col" className="px-3 py-2.5">When</th>
              <th scope="col" className="px-3 py-2.5">Actor</th>
              <th scope="col" className="px-3 py-2.5">Action</th>
              <th scope="col" className="px-3 py-2.5">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={`${e.timestamp}-${i}`} className="border-b border-foam/10 align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-foam/70" title={e.timestamp}>
                  {relativeTime(e.timestamp)}
                </td>
                <td className="px-3 py-2 font-semibold text-parchment">{e.actor}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-straw/15 px-1.5 py-0.5 font-mono text-[0.68rem] text-straw">
                    {e.action}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <AuditDetail entry={e} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-sm italic text-foam/60">
                  {loading ? "Loading…" : "Nothing recorded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The entity id plus the recorded value, shared by the table and the cards. */
function AuditDetail({ entry }: { entry: AuditEntry }) {
  return (
    <>
      {entry.entityId && <span className="mr-2 break-words font-mono text-[0.68rem] text-foam/70">{entry.entityId}</span>}
      {entry.newValue && (
        <span className="break-words font-mono text-[0.68rem] text-foam/60" title={entry.newValue}>
          {entry.newValue.length > 120 ? `${entry.newValue.slice(0, 120)}…` : entry.newValue}
        </span>
      )}
    </>
  );
}
