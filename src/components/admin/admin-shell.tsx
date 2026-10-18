"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import type { Role } from "@/lib/types";
import { can, type Permission } from "@/lib/auth/permissions";
import { ROLE_SHORT } from "@/lib/auth/roles";
import { auditResults, summariseIssues } from "@/lib/data/data-quality";
import { useLive } from "@/components/providers";
import { ChangePassword } from "./change-password";
import { Icon, type IconName } from "@/components/icons";

export interface AdminSession {
  username: string;
  role: Role;
}

const AdminContext = createContext<AdminSession | null>(null);

export function useAdmin(): AdminSession {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminShell>");
  return ctx;
}

const NAV: Array<{ href: string; label: string; icon: IconName; perm: Permission }> = [
  { href: "/admin", label: "Quick results", icon: "bolt", perm: "edit_result" },
  { href: "/admin/judges", label: "Judge scores", icon: "mask", perm: "edit_result" },
  { href: "/admin/matches", label: "Match scoring", icon: "ball", perm: "edit_result" },
  { href: "/admin/announcements", label: "Announcements", icon: "megaphone", perm: "post_announcement" },
  { href: "/admin/events", label: "Events & locks", icon: "map", perm: "manage_events" },
  { href: "/admin/teams", label: "Teams & logos", icon: "flag", perm: "manage_teams" },
  { href: "/admin/config", label: "Point system", icon: "gear", perm: "manage_points" },
  { href: "/admin/audit", label: "Audit log", icon: "scroll", perm: "view_audit" },
  { href: "/admin/users", label: "Accounts", icon: "users", perm: "manage_users" },
];

/** CSV snapshots for the archives; Secretatiat-only, gated by the `export` permission. */
const EXPORTS: Array<{ what: string; label: string }> = [
  { what: "standings", label: "Standings & points" },
  { what: "medals", label: "Medal table" },
  { what: "results", label: "All results" },
  { what: "events", label: "Event catalog" },
];

export function AdminShell({ session, children }: { session: AdminSession; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useLive();
  const [signingOut, setSigningOut] = useState(false);
  const links = NAV.filter((n) => can(session.role, n.perm));

  const qualityIssues = auditResults(state.events, state.teams, state.results);
  const qualityWarning = summariseIssues(qualityIssues);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <AdminContext.Provider value={session}>
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <aside className="panel h-max rounded-2xl p-3 lg:sticky lg:top-20 print:hidden">
          <p className="px-2 py-1 text-[0.68rem] uppercase tracking-widest text-foam/60">Control room</p>
          <p className="px-2 pb-2 text-sm">
            <span className="font-semibold text-parchment">{session.username}</span>
            <span className="ml-1 rounded bg-straw/20 px-1.5 py-0.5 text-[0.6rem] uppercase text-straw">
              {ROLE_SHORT[session.role]}
            </span>
          </p>
          <nav aria-label="Admin">
            <ul className="space-y-0.5">
              {links.map((l) => {
                const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                        active ? "bg-straw/15 text-straw" : "text-parchment/85 hover:bg-foam/10"
                      }`}
                    >
                      <Icon name={l.icon} size={16} />
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {can(session.role, "export") && (
            <div className="mt-3 border-t border-foam/15 pt-3">
              <p className="px-2 pb-1 text-[0.68rem] uppercase tracking-widest text-foam/60">Export CSV</p>
              <ul className="space-y-0.5">
                {EXPORTS.map((x) => (
                  <li key={x.what}>
                    <a
                      href={`/api/admin/export?what=${x.what}`}
                      className="flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-parchment/85 hover:bg-foam/10 hover:text-straw"
                    >
                      <Icon name="chart" size={14} />
                      {x.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="mt-3 w-full rounded-lg border border-foam/25 px-3 py-2 text-sm text-parchment/85 hover:border-blood hover:text-blood disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <ChangePassword />
          <Link
            href="/"
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-center text-xs text-foam/70 hover:text-parchment"
          >
            <Icon name="chevronLeft" size={13} />
            Back to public site
          </Link>
        </aside>
        <div className="min-w-0">
          {/* Results the scorer cannot resolve score nothing, silently. Surface
              them here rather than only in the `check-sheet` CLI, because
              nobody runs a command during the festival. */}
          {qualityWarning && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-sunset/50 bg-sunset/10 p-3 text-sm"
            >
              <p className="flex items-start gap-2 text-parchment">
                <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-sunset" />
                <span>
                  <strong className="text-sunset">Results need attention.</strong> {qualityWarning}
                </span>
              </p>
              <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-foam/80">
                {qualityIssues.slice(0, 5).map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
                {qualityIssues.length > 5 && <li>…and {qualityIssues.length - 5} more.</li>}
              </ul>
            </div>
          )}
          {children}
        </div>
      </div>
    </AdminContext.Provider>
  );
}

/** Rendered in place of a section when the signed-in role lacks a permission. */
export function NoAccess({ permission }: { permission: Permission }) {
  return (
    <div className="panel rounded-2xl p-6">
      <p className="font-display flex items-center gap-2 text-2xl text-parchment">
        <Icon name="lock" size={22} className="text-sunset" /> Restricted
      </p>
      <p className="mt-1 text-sm text-foam/75">
        Your account does not have the <code>{permission}</code> permission. Ask the Secretariat or a
        Super Admin if you need it.
      </p>
    </div>
  );
}
