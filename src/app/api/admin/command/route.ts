import { NextResponse } from "next/server";
import { commandSchema } from "@/lib/data/command-schema";
import type { Command } from "@/lib/data/repo";
import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { AuthError, hashPassword, requireSession } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";
import type { TeamUser } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredPermission(command: Command): Permission {
  switch (command.type) {
    case "saveResults":
    case "deleteResult":
    case "saveJudgeScores":
    case "saveMatch":
    case "deleteMatch":
      return "edit_result";
    case "publishResults":
    case "unpublishResults":
      return "publish_result";
    case "announce":
      return "post_announcement";
    case "updateConfig":
      return "manage_points";
    case "updateEvent":
    case "upsertEvent":
      return "manage_events";
    case "upsertTeam":
    case "deleteTeam":
      return "manage_teams";
    case "saveCriteria":
      return "manage_criteria";
    case "upsertUser":
    case "deleteUser":
      return "manage_users";
  }
}

/**
 * The event a command names, if any.
 *
 * `upsertEvent` is included deliberately: `updateEvent` was the only event
 * command, so a lock guard keyed on `"eventId" in command` would have let an
 * upsert overwrite a locked event and slip straight past it.
 */
function targetEventId(command: Command): string | undefined {
  if ("eventId" in command) return command.eventId;
  if (command.type === "saveMatch") return command.match.eventId;
  if (command.type === "upsertEvent") return command.event.id;
  return undefined;
}

/** True when `username` is the only remaining active Super Admin. */
function isLastActiveSuperAdmin(users: TeamUser[], username: string): boolean {
  const target = username.toLowerCase();
  const supers = users.filter((u) => u.role === "superadmin" && u.active);
  return supers.length === 1 && supers[0].username.toLowerCase() === target;
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const json = await request.json().catch(() => null);
    const parsed = commandSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const actor = session.username;

    // Hash any plaintext password here, so the repository — and therefore the
    // audit log — only ever handle the hash.
    let command: Command;
    if (data.type === "upsertUser") {
      const { password, ...rest } = data.user;
      command = {
        type: "upsertUser",
        user: { ...rest, passwordHash: password ? await hashPassword(password) : undefined },
        actor,
      };
    } else {
      command = { ...data, actor } as Command;
    }

    const needed = requiredPermission(command);
    if (!can(session.role, needed)) {
      return NextResponse.json({ error: `Requires the "${needed}" permission` }, { status: 403 });
    }

    const store = getStore();
    const state = await store.init();

    // locked-event guard: only the Secretariat (and above) may touch a locked event
    const eventId = targetEventId(command);
    if (eventId) {
      const event = state.events.find((e) => e.id === eventId);
      if (event?.locked && !can(session.role, "lock_event")) {
        return NextResponse.json(
          { error: `"${event.name}" is locked. Only the Secretariat can edit it.` },
          { status: 403 },
        );
      }
    }

    if (command.type === "updateEvent" && command.patch.locked !== undefined && !can(session.role, "lock_event")) {
      return NextResponse.json({ error: "Requires the lock_event permission" }, { status: 403 });
    }

    /* ----------------------- account guards ----------------------- */
    if (command.type === "upsertUser" || command.type === "deleteUser") {
      const raw = await store.currentRaw();
      const users = raw?.users ?? [];
      const username = command.type === "upsertUser" ? command.user.username : command.username;
      const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

      if (command.type === "upsertUser") {
        if (!existing && !command.user.passwordHash) {
          return NextResponse.json(
            { error: "A password is required when creating a new account." },
            { status: 400 },
          );
        }
        const demoting = command.user.role !== "superadmin" || !command.user.active;
        if (demoting && isLastActiveSuperAdmin(users, username)) {
          return NextResponse.json(
            {
              error:
                "Lockout protection: this is the last active Super Admin. Promote another account first.",
            },
            { status: 400 },
          );
        }
      } else {
        if (!existing) {
          return NextResponse.json({ error: "No such account." }, { status: 404 });
        }
        if (isLastActiveSuperAdmin(users, username)) {
          return NextResponse.json(
            {
              error:
                "Lockout protection: this is the last active Super Admin and cannot be deleted.",
            },
            { status: 400 },
          );
        }
        if (existing.username.toLowerCase() === session.username.toLowerCase()) {
          return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
        }
      }
    }

    const next = await store.applyCommand(command);
    return NextResponse.json({
      ok: true,
      state: next,
      status: store.getStatus(),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/command]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
