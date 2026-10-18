import { NextResponse } from "next/server";
import { getStore } from "@/lib/store/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monitoring endpoint.
 *
 * Returns 503 when the sheet is unreachable, so an uptime checker can alert
 * *before* the crowd notices. The public UI only shows a "reconnecting" pill,
 * which nobody is watching at 8am on day one — that is the gap this closes.
 *
 * Point a free monitor (Better Stack, UptimeRobot, a Vercel cron) at this URL
 * and alert on anything that is not 200.
 */
export async function GET() {
  const store = getStore();
  await store.init();
  const status = store.getStatus();
  // Allow a generous window: a cold instance legitimately has to read once.
  const state = await store.ensureFresh(20000);

  return NextResponse.json(
    {
      ok: status.ok,
      kind: status.kind,
      lastError: status.lastError,
      lastSyncedAt: status.lastSyncedAt,
      version: state.version,
      teams: state.teams.length,
      events: state.events.length,
      medalsAtStake: state.events.reduce((sum, e) => sum + e.medalWeight, 0),
    },
    {
      status: status.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
