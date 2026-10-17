import { describe, expect, it } from "vitest";
import { can, canEditEvent, ROLE_PERMISSIONS } from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("lets anyone with a role edit + publish results and post announcements", () => {
    expect(can("pio", "edit_result")).toBe(true);
    expect(can("pio", "publish_result")).toBe(true);
    expect(can("pio", "post_announcement")).toBe(true);
    expect(can("secretariat", "edit_result")).toBe(true);
  });

  it("reserves configuration powers for the Secretariat", () => {
    for (const p of [
      "manage_teams",
      "manage_events",
      "manage_criteria",
      "manage_points",
      "lock_event",
      "view_audit",
      "reveal",
      "export",
    ] as const) {
      expect(can("pio", p)).toBe(false);
      expect(can("secretariat", p)).toBe(true);
    }
  });

  it("keeps account management exclusive to the Super Admin", () => {
    expect(can("pio", "manage_users")).toBe(false);
    expect(can("secretariat", "manage_users")).toBe(false);
    expect(can("superadmin", "manage_users")).toBe(true);
  });

  it("denies everything to anonymous visitors", () => {
    expect(can(null, "edit_result")).toBe(false);
    expect(can(undefined, "view_audit")).toBe(false);
  });

  it("only the Secretariat and above may edit a locked event", () => {
    expect(canEditEvent("pio", true)).toBe(false);
    expect(canEditEvent("secretariat", true)).toBe(true);
    expect(canEditEvent("superadmin", true)).toBe(true);
    expect(canEditEvent("pio", false)).toBe(true);
  });

  it("gives the Secretariat a strict superset of PIO permissions", () => {
    for (const p of ROLE_PERMISSIONS.pio) {
      expect(ROLE_PERMISSIONS.secretariat.has(p)).toBe(true);
    }
  });

  it("gives the Super Admin a strict superset of Secretariat permissions", () => {
    for (const p of ROLE_PERMISSIONS.secretariat) {
      expect(ROLE_PERMISSIONS.superadmin.has(p)).toBe(true);
    }
    expect(ROLE_PERMISSIONS.superadmin.size).toBeGreaterThan(ROLE_PERMISSIONS.secretariat.size);
  });
});
