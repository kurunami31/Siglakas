import { NextResponse } from "next/server";
import { getStore } from "@/lib/store/state-store";
import { toVersionPayload } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tiny change-detection endpoint. Clients poll this and only refetch on change. */
export async function GET() {
  const store = getStore();
  const state = await store.ensureFresh(4000);
  return NextResponse.json(
    { ...toVersionPayload(state), store: store.getStatus() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
