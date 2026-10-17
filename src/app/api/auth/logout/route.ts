import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return res;
}
