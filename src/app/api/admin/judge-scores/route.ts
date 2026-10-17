import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { AuthError, requireSession } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Raw judge scores for a single event.
 *
 * They are deliberately NOT part of the public `CompetitionState` (a full
 * festival runs to roughly 6,000 rows), so the scoring screen fetches them per
 * event instead of bloating every viewer's payload.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!can(session.role, "edit_result")) {
      return NextResponse.json({ error: 'Requires the "edit_result" permission' }, { status: 403 });
    }

    const eventId = new URL(request.url).searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const raw = await getStore().currentRaw();
    const rows = (raw?.judgeScores ?? []).filter((s) => s.eventId === eventId);

    return NextResponse.json({ rows });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/judge-scores]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
