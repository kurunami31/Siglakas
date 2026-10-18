import { SignJWT, jwtVerify } from "jose";
import type { Role } from "../types";

export interface SessionUser {
  username: string;
  role: Role;
}

const COOKIE_NAME = "gl_session";
const ISSUER = "grand-line-tally";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours — one competition day

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_SECRET) {
      throw new Error("AUTH_SECRET must be set (>=16 chars) in production");
    }
    // dev/demo fallback keeps `npm run dev` frictionless
    return new TextEncoder().encode("grand-line-tally-dev-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(user.username)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER });
    const role: Role =
      payload.role === "secretariat" ? "secretariat" : payload.role === "superadmin" ? "superadmin" : "pio";
    return { username: String(payload.username ?? payload.sub ?? ""), role };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  },
};

/* --------------------------- login throttling --------------------------- */

interface Attempt {
  count: number;
  first: number;
}

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
/** Above this many tracked keys, sweep the expired ones. */
const PRUNE_AT = 128;

/**
 * Drop entries whose window has lapsed. Without this the map grows without
 * bound: a key is only ever removed on a successful login, so failed attempts
 * from many addresses would accumulate for the lifetime of the process.
 */
function prune(now: number): void {
  for (const [key, entry] of attempts) {
    if (now - entry.first > WINDOW_MS) attempts.delete(key);
  }
}

export function rateLimit(key: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (attempts.size > PRUNE_AT) prune(now);
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return { ok: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.first + WINDOW_MS - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
