"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Change your own password, from the admin sidebar.
 *
 * Collapsed by default so it does not compete with the day-of actions, and it
 * clears the fields on success rather than leaving a password sitting in the
 * DOM. The server takes the target account from the session, so there is no
 * username field here on purpose.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Could not change the password (${res.status}).`);
        return;
      }
      setCurrent("");
      setNext("");
      setDone(true);
      setOpen(false);
    } catch {
      setError("Network error — your password was not changed.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-foam/25 bg-ink/60 px-2.5 py-2 text-sm text-parchment placeholder:text-foam/40";

  if (!open) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="w-full rounded-lg px-3 py-2 text-xs text-foam/70 hover:text-parchment"
        >
          Change my password
        </button>
        {done && (
          <p role="status" className="mt-1 px-2 text-[0.68rem] text-teal">
            Password changed.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 border-t border-foam/15 pt-2">
      <p className="flex items-center gap-1.5 px-1 text-[0.68rem] uppercase tracking-widest text-foam/60">
        <Icon name="lock" size={12} /> Change my password
      </p>
      <label className="block">
        <span className="sr-only">Current password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          className={field}
        />
      </label>
      <label className="block">
        <span className="sr-only">New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (8+ characters)"
          className={field}
        />
      </label>
      {error && (
        <p role="alert" className="px-1 text-[0.68rem] text-blood">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-9 flex-1 rounded-lg bg-straw px-2 text-xs font-semibold text-ink hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setCurrent("");
            setNext("");
          }}
          className="min-h-9 rounded-lg border border-foam/25 px-2 text-xs text-parchment/80 hover:border-straw"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
