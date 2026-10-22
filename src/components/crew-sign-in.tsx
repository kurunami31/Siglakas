"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * The staff sign-in form, shared by `/login` and the maintenance holding screen.
 *
 * It has to be shared: when maintenance is on, `/login` is closed along with
 * everything else, so the way back in for the Secretariat is the holding screen
 * itself. Reads `?next=` through `useSearchParams`, so callers must render it
 * inside a `<Suspense>` boundary.
 */
export function CrewSignIn({ defaultNext = "/admin" }: { defaultNext?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || defaultNext;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel rounded-2xl p-6">
      <p className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="anchor" size={26} className="text-straw" /> Crew sign-in
      </p>
      <p className="mt-1 text-sm text-foam/75">
        For the Public Information Office, Secretariat and Super Admin only. Viewers never need an account.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3" aria-describedby={error ? "login-error" : undefined}>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Username</span>
          <input
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment outline-none placeholder:text-foam/40"
            placeholder="secretariat"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment outline-none placeholder:text-foam/40"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p id="login-error" role="alert" className="rounded-lg border border-blood/50 bg-blood/15 px-3 py-2 text-sm text-parchment">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Boarding…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
