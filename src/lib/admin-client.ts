"use client";

import type { AuditEntry, CompetitionState, JudgeScore, Role } from "@/lib/types";

export interface CommandResult {
  ok: boolean;
  state?: CompetitionState;
  error?: string;
}

export interface AccountSummary {
  username: string;
  role: Role;
  teamId: string;
  active: boolean;
}

/** Single, permission-checked write path for every admin action. */
export async function postCommand(command: Record<string, unknown>): Promise<CommandResult> {
  try {
    const res = await fetch("/api/admin/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `Request failed (${res.status})` };
    return { ok: true, state: data.state as CompetitionState };
  } catch {
    return { ok: false, error: "Network error — your change was not saved." };
  }
}

/** Read the audit trail (Secretariat only; the store keeps it server-side). */
export async function getAuditLog(limit = 200): Promise<{ ok: boolean; entries: AuditEntry[]; error?: string }> {
  try {
    const res = await fetch(`/api/admin/audit?limit=${limit}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, entries: [], error: data.error ?? `Request failed (${res.status})` };
    return { ok: true, entries: (data.entries ?? []) as AuditEntry[] };
  } catch {
    return { ok: false, entries: [], error: "Network error." };
  }
}

/**
 * Raw judge scores for one event. Not part of the public state payload, so the
 * scoring screen reads them here.
 */
export async function getJudgeScores(
  eventId: string,
): Promise<{ ok: boolean; rows: JudgeScore[]; error?: string }> {
  try {
    const res = await fetch(`/api/admin/judge-scores?eventId=${encodeURIComponent(eventId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, rows: [], error: data.error ?? `Request failed (${res.status})` };
    return { ok: true, rows: (data.rows ?? []) as JudgeScore[] };
  } catch {
    return { ok: false, rows: [], error: "Network error." };
  }
}

/** The account list (Super Admin only). Hashes stay on the server. */
export async function getAccounts(): Promise<{ ok: boolean; users: AccountSummary[]; error?: string }> {
  try {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, users: [], error: data.error ?? `Request failed (${res.status})` };
    return { ok: true, users: (data.users ?? []) as AccountSummary[] };
  } catch {
    return { ok: false, users: [], error: "Network error." };
  }
}
