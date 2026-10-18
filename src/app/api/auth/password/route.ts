import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, findUser, hashPassword, requireSession, verifyPassword } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";
import { rateLimit, resetRateLimit } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, "Passwords need at least 8 characters").max(200),
});

/**
 * Self-service password change.
 *
 * Deliberately NOT routed through /api/admin/command, which requires the
 * `manage_users` permission held only by a Super Admin — otherwise every routine
 * password change would need one. The safety comes from the target instead: the
 * username is taken from the session and never from the request body, so this
 * can only ever change the caller's own password, and the current password must
 * be supplied and verified first.
 *
 * The write goes through the same audited repository path, so it lands in the
 * AuditLog with the hash redacted.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const limit = rateLimit(`password:${session.username}`);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${limit.retryAfterSeconds}s.` },
        { status: 429 },
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "A new password of at least 8 characters is required." },
        { status: 400 },
      );
    }

    const user = await findUser(session.username);
    if (!user || !user.active) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "That is not your current password." }, { status: 401 });
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json({ error: "The new password must be different." }, { status: 400 });
    }

    resetRateLimit(`password:${session.username}`);

    await getStore().applyCommand({
      type: "upsertUser",
      user: {
        username: user.username, // from the session, never the body
        role: user.role,
        teamId: user.teamId,
        active: user.active,
        passwordHash: await hashPassword(parsed.data.newPassword),
      },
      actor: session.username,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[auth/password]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
