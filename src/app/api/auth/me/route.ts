import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  const store = getStore();
  return NextResponse.json(
    { user: session, store: store.getStatus() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
