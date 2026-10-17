import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { Role, TeamUser } from "../types";
import { getStore } from "../store/state-store";
import { sessionCookie, verifySession, type SessionUser } from "./session";
import { can, type Permission } from "./permissions";
import { ROLE_LABEL } from "./roles";

export async function findUser(username: string): Promise<TeamUser | null> {
  const store = getStore();
  const state = await store.init();
  void state;
  const raw = await store.currentRaw();
  if (!raw) return null;
  const user = raw.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  return user ?? null;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Read + verify the session from cookies. Safe on the server only. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(sessionCookie.name)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Not signed in", 401);
  return session;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await requireSession();
  if (!can(session.role, permission)) {
    throw new AuthError("Your role is not allowed to do that", 403);
  }
  return session;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role] ?? "Public Information Office";
}
