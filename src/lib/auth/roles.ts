import type { Role } from "../types";

/**
 * Client-safe role metadata. Kept out of the server-only session helpers so UI
 * components can render labels and pickers without pulling in `next/headers`.
 */
export const ROLES: Role[] = ["pio", "secretariat", "superadmin"];

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  secretariat: "Secretariat",
  pio: "Public Information Office",
};

export const ROLE_SHORT: Record<Role, string> = {
  superadmin: "Super Admin",
  secretariat: "Secretariat",
  pio: "PIO",
};

export const ROLE_BLURB: Record<Role, string> = {
  superadmin:
    "Manages accounts and has every permission. Only a Super Admin can create or edit logins.",
  secretariat:
    "Runs the festival: scores, locks, teams, point system, audit trail and CSV exports.",
  pio: "Enters and publishes results, scores matches and posts announcements.",
};
