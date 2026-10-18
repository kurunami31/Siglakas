import type { Announcement, AuditEntry, RawSheets, Result } from "../types";
import {
  buildCriteria,
  DEFAULT_CONFIG,
  DEMO_ANNOUNCEMENTS,
  DEMO_USERS,
  EVENTS,
  generateDemoData,
  TEAMS,
} from "./seed";
import type { Command, Repository } from "./repo";
import { auditPayload } from "./audit-payload";

/**
 * In-memory repository used when DEMO_MODE is on (the default). It behaves like
 * the sheet repo — same commands, same derived output — but never touches the
 * network, so the whole site can be previewed without credentials.
 */
export class DemoRepository implements Repository {
  readonly kind = "demo" as const;
  private state: RawSheets;

  constructor() {
    const criteria = buildCriteria(EVENTS);
    const { results, matches, judgeScores } = generateDemoData(EVENTS, TEAMS, criteria);
    this.state = {
      config: { ...DEFAULT_CONFIG },
      teams: TEAMS.map((t) => ({ ...t })),
      events: EVENTS.map((e) => ({ ...e })),
      criteria,
      matches,
      judgeScores,
      results,
      announcements: DEMO_ANNOUNCEMENTS.map((a) => ({ ...a })),
      auditLog: [],
      users: DEMO_USERS.map((u) => ({ ...u })),
    };
  }

  async read(): Promise<RawSheets> {
    return structuredClone(this.state);
  }

  async apply(command: Command): Promise<void> {
    const s = this.state;
    switch (command.type) {
      case "saveResults": {
        for (const row of command.rows) {
          const idx = s.results.findIndex(
            (r) => r.eventId === command.eventId && r.teamId === row.teamId,
          );
          const next: Result = {
            eventId: command.eventId,
            teamId: row.teamId,
            placement: row.placement,
            tie: row.tie,
            status: row.status,
            count: row.count ?? 0,
            enteredBy: command.actor,
            timestamp: new Date().toISOString(),
          };
          if (idx >= 0) s.results[idx] = next;
          else s.results.push(next);
        }
        break;
      }
      case "publishResults":
      case "unpublishResults": {
        const status = command.type === "publishResults" ? "published" : "draft";
        for (const r of s.results) {
          if (r.eventId === command.eventId) r.status = status;
        }
        const ev = s.events.find((e) => e.id === command.eventId);
        if (ev && status === "published") ev.status = "finished";
        break;
      }
      case "deleteResult": {
        s.results = s.results.filter(
          (r) => !(r.eventId === command.eventId && r.teamId === command.teamId),
        );
        break;
      }
      case "saveJudgeScores": {
        s.judgeScores = s.judgeScores.filter((j) => j.eventId !== command.eventId);
        s.judgeScores.push(...command.rows);
        break;
      }
      case "saveMatch": {
        const idx = s.matches.findIndex((m) => m.id === command.match.id);
        if (idx >= 0) s.matches[idx] = command.match;
        else s.matches.push(command.match);
        break;
      }
      case "deleteMatch": {
        s.matches = s.matches.filter((m) => m.id !== command.id);
        break;
      }
      case "announce": {
        const entry: Announcement = {
          timestamp: new Date().toISOString(),
          message: command.message,
          postedBy: command.actor,
        };
        s.announcements.unshift(entry);
        break;
      }
      case "updateConfig": {
        s.config = { ...s.config, ...command.patch };
        break;
      }
      case "updateEvent": {
        const idx = s.events.findIndex((e) => e.id === command.id);
        if (idx >= 0) s.events[idx] = { ...s.events[idx], ...command.patch };
        break;
      }
      case "upsertTeam": {
        const idx = s.teams.findIndex((t) => t.id === command.team.id);
        if (idx >= 0) s.teams[idx] = { ...s.teams[idx], ...command.team };
        else s.teams.push(command.team);
        break;
      }
      case "deleteTeam": {
        s.teams = s.teams.filter((t) => t.id !== command.id);
        break;
      }
      case "saveCriteria": {
        s.criteria = s.criteria.filter((c) => c.eventId !== command.eventId);
        s.criteria.push(...command.rows);
        break;
      }
      case "upsertUser": {
        const target = command.user.username.toLowerCase();
        const existing = s.users.find((u) => u.username.toLowerCase() === target);
        s.users = s.users.filter((u) => u.username.toLowerCase() !== target);
        s.users.push({
          username: command.user.username,
          passwordHash: command.user.passwordHash ?? existing?.passwordHash ?? "",
          role: command.user.role,
          teamId: command.user.teamId,
          active: command.user.active,
        });
        break;
      }
      case "deleteUser": {
        const target = command.username.toLowerCase();
        s.users = s.users.filter((u) => u.username.toLowerCase() !== target);
        break;
      }
    }
    this.audit(command);
  }

  private audit(command: Command): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      actor: command.actor,
      action: command.type,
      entity: "command",
      entityId: "id" in command ? String(command.id ?? "") : "",
      newValue: auditPayload(command, 400),
    };
    this.state.auditLog.unshift(entry);
    if (this.state.auditLog.length > 500) this.state.auditLog.pop();
  }

  /** Used by the demo "live" simulator to fabricate a plausible update. */
  simulateTick(rng: () => number): boolean {
    const s = this.state;
    const upcoming = s.events.filter(
      (e) => e.status !== "finished" && e.scoringType !== "match",
    );
    if (upcoming.length === 0) return false;
    const event = upcoming[Math.floor(rng() * upcoming.length)];
    const pool = s.teams.filter((t) => !s.results.some((r) => r.eventId === event.id && r.teamId === t.id));
    if (pool.length === 0) return false;
    const team = pool[Math.floor(rng() * pool.length)];
    const placement = 1 + Math.floor(rng() * 3);
    s.results.push({
      eventId: event.id,
      teamId: team.id,
      placement,
      tie: false,
      status: "published",
      enteredBy: "demo",
      timestamp: new Date().toISOString(),
    });
    event.status = rng() < 0.3 ? "live" : event.status;
    return true;
  }
}
