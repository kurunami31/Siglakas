import { NextResponse } from "next/server";
import { z } from "zod";
import { findUser, verifyPassword } from "@/lib/auth/server";
import { rateLimit, resetRateLimit, sessionCookie, signSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  const limit = rateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = await findUser(parsed.data.username);
  // Always run a comparison-shaped path to avoid trivially leaking which usernames exist.
  const ok = user?.active
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");

  if (!user || !user.active || !ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  resetRateLimit(ip);
  const token = await signSession({ username: user.username, role: user.role });

  const res = NextResponse.json({
    user: { username: user.username, role: user.role },
  });
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
