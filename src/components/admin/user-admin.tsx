"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccounts, postCommand, type AccountSummary } from "@/lib/admin-client";
import { useLive } from "@/components/providers";
import { Icon } from "@/components/icons";
import { ROLES, ROLE_BLURB, ROLE_SHORT } from "@/lib/auth/roles";
import type { Role, Team } from "@/lib/types";
import { useAdmin } from "./admin-shell";

/**
 * Super Admin console for handing out competition-day logins. The account list
 * arrives without hashes (the server projects the fields the UI needs), and
 * every change goes through the same audited command path as the scores.
 */
export function UserAdmin() {
  const me = useAdmin();
  const teams = useLive().state.teams;
  const [users, setUsers] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAccounts();
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Could not load accounts");
      return;
    }
    setError(null);
    setUsers(res.users);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const done = async (msg: string) => {
    setError(null);
    setNote(msg);
    await load();
  };

  const activeSupers = users.filter((u) => u.role === "superadmin" && u.active).length;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
            <Icon name="users" size={26} className="text-straw" /> Accounts
          </h1>
          <p className="mt-1 max-w-prose text-sm text-foam/70">
            Create and manage the logins for the Secretariat, the PIO and any other admin. Only a
            Super Admin can see this screen.
          </p>
        </div>
        <span className="rounded-full border border-foam/25 px-3 py-1 text-xs text-foam/70">
          {users.length} account{users.length === 1 ? "" : "s"} · {activeSupers} active Super Admin
          {activeSupers === 1 ? "" : "s"}
        </span>
      </header>

      <p role="status" aria-live="polite" className="min-h-0 text-sm">
        {error ? (
          <span className="inline-block rounded-lg border border-blood/40 bg-blood/10 px-2.5 py-1.5 text-parchment">
            {error}
          </span>
        ) : note ? (
          <span className="inline-block rounded-lg border border-teal/40 bg-teal/10 px-2.5 py-1.5 text-parchment">
            {note}
          </span>
        ) : null}
      </p>

      <CreateAccount teams={teams} onDone={done} onError={setError} />

      <div
        role="region"
        aria-label="Accounts (scrollable)"
        tabIndex={0}
        data-print-expand
        className="max-h-[65vh] space-y-3 overflow-y-auto overscroll-contain pr-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-straw"
      >
        {loading && users.length === 0 && (
          <p className="panel rounded-2xl p-4 text-sm italic text-foam/60">Loading accounts…</p>
        )}
        {!loading && users.length === 0 && !error && (
          <p className="panel rounded-2xl p-4 text-sm italic text-foam/60">No accounts yet.</p>
        )}
        {users.map((u) => (
          <AccountRow
            key={u.username}
            account={u}
            teams={teams}
            isMe={u.username.toLowerCase() === me.username.toLowerCase()}
            onDone={done}
            onError={setError}
          />
        ))}
      </div>

      <p className="text-xs text-foam/60">
        Passwords are stored as bcrypt hashes, so an existing password can never be read back — not
        even here. Use <strong className="text-foam/80">Reset password</strong> to issue a new one and
        share it with that person privately. The last active Super Admin cannot be demoted or deleted.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CreateAccount({
  teams,
  onDone,
  onError,
}: {
  teams: Team[];
  onDone: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("pio");
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await postCommand({
      type: "upsertUser",
      user: { username: username.trim(), role, teamId, active: true, password },
    });
    setBusy(false);
    if (!res.ok) {
      onError(res.error ?? "Could not create the account");
      return;
    }
    await onDone(`Created ${username.trim()} as ${ROLE_SHORT[role]}.`);
    setUsername("");
    setPassword("");
    setTeamId("");
    setShow(false);
    setOpen(false);
  }

  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display flex items-center gap-2 text-xl text-parchment">
          <Icon name="star" size={18} className="text-straw" /> New account
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw"
        >
          <Icon name={open ? "minus" : "star"} size={14} />
          {open ? "Hide form" : "Add account"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. pio-campus"
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
            />
            <span className="mt-1 block text-[0.7rem] text-foam/50">
              3–32 characters: letters, numbers, dot, dash or underscore.
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_SHORT[r]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[0.7rem] text-foam/50">{ROLE_BLURB[role]}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">
              Crew (optional)
            </span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            >
              <option value="">— none —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName} · {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Password</span>
            <span className="flex gap-2">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="min-h-11 shrink-0 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw"
              >
                Generate
              </button>
            </span>
            <span className="mt-1 flex items-center gap-2 text-[0.7rem] text-foam/50">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-straw" />
                Show
              </label>
            </span>
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !username.trim() || password.length < 8}
              className="min-h-11 rounded-lg bg-straw px-4 font-semibold text-ink hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AccountRow({
  account,
  teams,
  isMe,
  onDone,
  onError,
}: {
  account: AccountSummary;
  teams: Team[];
  isMe: boolean;
  onDone: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [role, setRole] = useState<Role>(account.role);
  const [teamId, setTeamId] = useState(account.teamId);
  const [active, setActive] = useState(account.active);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = role !== account.role || teamId !== account.teamId || active !== account.active;
  const id = account.username.replace(/[^a-zA-Z0-9_-]/g, "-");

  async function save() {
    setBusy(true);
    const res = await postCommand({
      type: "upsertUser",
      user: { username: account.username, role, teamId, active },
    });
    setBusy(false);
    if (!res.ok) return onError(res.error ?? "Save failed");
    await onDone(`Updated ${account.username}.`);
  }

  async function savePassword() {
    setBusy(true);
    const res = await postCommand({
      type: "upsertUser",
      user: { username: account.username, role, teamId, active, password },
    });
    setBusy(false);
    if (!res.ok) return onError(res.error ?? "Could not reset the password");
    await onDone(`New password set for ${account.username}. Share it privately.`);
    setPassword("");
    setResetting(false);
  }

  async function remove() {
    setBusy(true);
    const res = await postCommand({ type: "deleteUser", username: account.username });
    setBusy(false);
    if (!res.ok) return onError(res.error ?? "Could not delete the account");
    await onDone(`Deleted ${account.username}.`);
  }

  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        {account.role === "superadmin" && <Icon name="crown" size={16} className="text-straw" />}
        <span className="font-semibold text-parchment">{account.username}</span>
        {isMe && (
          <span className="rounded bg-straw/20 px-1.5 py-0.5 text-[0.6rem] uppercase text-straw">you</span>
        )}
        {!account.active && (
          <span className="rounded bg-blood/20 px-1.5 py-0.5 text-[0.6rem] uppercase text-parchment">
            disabled
          </span>
        )}
        <span className="ml-auto text-xs text-foam/60">{ROLE_SHORT[account.role]}</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_SHORT[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Crew</span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
          >
            <option value="">— none —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={`active-${id}`} className="flex items-center gap-2 self-end pb-2.5">
          <input
            id={`active-${id}`}
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-6 shrink-0 accent-straw"
          />
          <span className="text-sm text-parchment/85">Account active</span>
        </label>
      </div>

      {resetting && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block min-w-56 flex-1">
            <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">
              New password for {account.username}
            </span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment placeholder:text-foam/40"
            />
          </label>
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="min-h-11 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw"
          >
            Generate
          </button>
          <button
            type="button"
            onClick={savePassword}
            disabled={busy || password.length < 8}
            className="min-h-11 rounded-lg bg-straw px-3 font-semibold text-ink hover:brightness-105 disabled:opacity-50"
          >
            Set password
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-foam/10 pt-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="min-h-11 rounded-lg bg-straw px-3 text-sm font-semibold text-ink hover:brightness-105 disabled:opacity-40"
        >
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        <button
          type="button"
          onClick={() => setResetting((r) => !r)}
          aria-expanded={resetting}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw"
        >
          <Icon name="lock" size={14} /> Reset password
        </button>

        <span className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-foam/70">Delete {account.username}?</span>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="min-h-11 rounded-lg border border-blood bg-blood/20 px-3 text-sm font-semibold text-parchment hover:bg-blood/30 disabled:opacity-50"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-11 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm text-parchment/85 hover:border-blood hover:text-blood"
            >
              <Icon name="warning" size={14} /> Delete
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Strong, human-transcribable password (no 0/O/1/l ambiguity). */
export function generatePassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
