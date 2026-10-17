import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { AuthError, requireSession } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The audit trail lives in the raw sheet snapshot (it is deliberately NOT part
 * of the public `CompetitionState`), so it needs its own permission-checked
 * endpoint rather than riding along on `/api/state`.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!can(session.role, "view_audit")) {
      return NextResponse.json({ error: 'Requires the "view_audit" permission' }, { status: 403 });
    }

    const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 200) || 200, 500);
    const raw = await getStore().currentRaw();
    // Newest first, regardless of how the repository stores its rows. A plain
    // `slice(0, limit)` on the sheet's append-ordered log would show the OLDEST
    // entries and hide everything from the current day.
    const entries = [...(raw?.auditLog ?? [])]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
      .slice(0, limit);

    return NextResponse.json({ entries });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/audit]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
