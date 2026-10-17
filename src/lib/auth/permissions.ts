import type { Role } from "../types";

export type Permission =
  | "edit_result"
  | "publish_result"
  | "post_announcement"
  | "upload_logo"
  | "manage_teams"
  | "manage_events"
  | "manage_criteria"
  | "manage_points"
  | "lock_event"
  | "approve_scores"
  | "view_audit"
  | "manage_users"
  | "reveal"
  | "export";

const PIO_PERMISSIONS: Permission[] = [
  "edit_result",
  "publish_result",
  "post_announcement",
];

const SECRETARIAT_PERMISSIONS: Permission[] = [
  ...PIO_PERMISSIONS,
  "upload_logo",
  "manage_teams",
  "manage_events",
  "manage_criteria",
  "manage_points",
  "lock_event",
  "approve_scores",
  "view_audit",
  "reveal",
  "export",
];

/**
 * `manage_users` is deliberately NOT granted to the Secretariat: only a Super
 * Admin hands out accounts. Everything else is inherited.
 */
const SUPERADMIN_PERMISSIONS: Permission[] = [...SECRETARIAT_PERMISSIONS, "manage_users"];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  pio: new Set(PIO_PERMISSIONS),
  secretariat: new Set(SECRETARIAT_PERMISSIONS),
  superadmin: new Set(SUPERADMIN_PERMISSIONS),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Secretariat and above may edit locked events; PIO may not. */
export function canEditEvent(
  role: Role | null | undefined,
  locked: boolean,
): boolean {
  if (!role) return false;
  if (locked) return can(role, "lock_event");
  return can(role, "edit_result");
}
