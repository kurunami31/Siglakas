import { NextResponse } from "next/server";
import { getStore } from "@/lib/store/state-store";
import { stateForViewer, toVersionPayload } from "@/lib/serialize";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full snapshot. Used on first paint and as the SSE reconnect fallback. */
export async function GET() {
  const store = getStore();
  await store.init();
  const state = await store.ensureFresh(4000);
  const session = await getSession();
  return NextResponse.json(
    {
      state: stateForViewer(state, session?.role),
      status: store.getStatus(),
      meta: toVersionPayload(state),
    },
    { headers: { "Cache-Control": "no-store", Vary: "Cookie" } },
  );
}
