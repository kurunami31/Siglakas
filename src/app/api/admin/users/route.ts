import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { AuthError, requireSession } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AccountSummary {
  username: string;
  role: Role;
  teamId: string;
  active: boolean;
}

/**
 * Account list for the Super Admin. Password hashes live in the raw sheet
 * snapshot and must never leave the server, so this endpoint projects the
 * fields the UI actually needs.
 */
export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "manage_users")) {
      return NextResponse.json({ error: 'Requires the "manage_users" permission' }, { status: 403 });
    }

    const raw = await getStore().currentRaw();
    const users: AccountSummary[] = (raw?.users ?? []).map((u) => ({
      username: u.username,
      role: u.role,
      teamId: u.teamId,
      active: u.active,
    }));

    return NextResponse.json(
      { users },
      { headers: { "Cache-Control": "no-store", Vary: "Cookie" } },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/users]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
