import { z } from "zod";

const placement = z.number().int().min(0).max(30);

/** Account usernames: lowercase-friendly, no spaces or punctuation beyond ._-. */
export const usernameSchema = z
  .string()
  .min(3, "Usernames need at least 3 characters")
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, dash or underscore only");

export const resultRowSchema = z.object({
  teamId: z.string().min(1).max(64),
  placement,
  tie: z.boolean().default(false),
  status: z.enum(["draft", "published"]),
  /** Participants, for `participation` events only. */
  count: z.number().int().min(0).max(500).default(0),
});

export const judgeScoreSchema = z.object({
  eventId: z.string().min(1).max(64),
  teamId: z.string().min(1).max(64),
  judge: z.string().min(1).max(80),
  criterion: z.string().min(1).max(80),
  score: z.number().min(0).max(1000),
});

export const matchSchema = z.object({
  id: z.string().min(1).max(80),
  eventId: z.string().min(1).max(64),
  round: z.string().max(80).default("Round"),
  teamA: z.string().max(64),
  teamB: z.string().max(64),
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
  detail: z.string().max(400).optional(),
  winner: z.string().max(64).default(""),
  status: z.enum(["scheduled", "live", "final"]),
});

export const eventPatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    category: z.string().max(80).optional(),
    scoringType: z.enum(["placement", "judged", "match", "participation"]).optional(),
    medalWeight: z.number().int().min(0).max(100).optional(),
    multiplier: z.number().min(0).max(10).optional(),
    schedule: z.string().max(120).optional(),
    venue: z.string().max(120).optional(),
    status: z.enum(["upcoming", "live", "finished"]).optional(),
    locked: z.boolean().optional(),
    verify: z.boolean().optional(),
    note: z.string().max(400).optional(),
    division: z.enum(["sports", "cultural"]).optional(),
  })
  .strict();

/**
 * A complete event, for creating one that does not exist yet.
 *
 * `updateEvent` only patches rows that are already there — it maps over the
 * existing list and silently drops an unknown id — so it can never add an event
 * that is newly scheduled after the sheet was seeded. This is the counterpart to
 * `teamSchema`/`upsertTeam` for exactly that case.
 */
export const eventSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, "Event id must be lowercase letters, numbers, dashes or underscores"),
  name: z.string().min(1).max(120),
  division: z.enum(["sports", "cultural"]),
  category: z.string().min(1).max(80),
  scoringType: z.enum(["placement", "judged", "match", "participation"]),
  medalWeight: z.number().int().min(0).max(100),
  gender: z.enum(["M", "W", "M&W", "Open"]),
  multiplier: z.number().min(0).max(10),
  schedule: z.string().max(120).optional(),
  venue: z.string().max(120).optional(),
  status: z.enum(["upcoming", "live", "finished"]),
  locked: z.boolean(),
  verify: z.boolean().optional(),
  note: z.string().max(400).optional(),
});

export const teamSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, "Team id must be lowercase letters, numbers, dashes or underscores"),
  name: z.string().min(1).max(160),
  shortName: z.string().min(1).max(12),
  group: z.enum(["faculty", "extension_campus"]),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Accent must be a hex colour"),
  logoFile: z.string().max(80),
  mascot: z.string().max(80),
  motto: z.string().max(160).optional(),
  logoUrl: z.string().url().max(400).optional(),
});

export const criterionSchema = z.object({
  eventId: z.string().min(1).max(64),
  criterion: z.string().min(1).max(80),
  weight: z.number().min(0).max(100),
  order: z.number().int().min(0).max(50),
});

export const configPatchSchema = z
  .object({
    competitionName: z.string().min(1).max(160).optional(),
    schoolName: z.string().min(1).max(160).optional(),
    subtitle: z.string().max(160).optional(),
    championshipRankBy: z.enum(["total_medals", "gold_first", "weighted_points"]).optional(),
    terminology: z.enum(["onepiece", "plain"]).optional(),
    pointsFreeze: z.boolean().optional(),
    revealMode: z.boolean().optional(),
    medalPoints: z
      .object({
        gold: z.number().min(0).max(1000),
        silver: z.number().min(0).max(1000),
        bronze: z.number().min(0).max(1000),
      })
      .optional(),
    defaultPlacementTable: z
      .object({
        name: z.string().max(80).optional(),
        participation: z.number().min(0).max(1000),
        // keys arrive as strings over JSON; the scorer indexes with numbers,
        // which is identical at runtime.
        places: z.record(z.string(), z.number().min(0).max(1000)),
      })
      .optional(),
  })
  .strict();

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("saveResults"),
    eventId: z.string().min(1).max(64),
    rows: z.array(resultRowSchema).max(40),
    actor: z.string().default("system"),
  }),
  z.object({ type: z.literal("publishResults"), eventId: z.string().min(1).max(64), actor: z.string().default("system") }),
  z.object({ type: z.literal("unpublishResults"), eventId: z.string().min(1).max(64), actor: z.string().default("system") }),
  z.object({ type: z.literal("deleteResult"), eventId: z.string().min(1).max(64), teamId: z.string().min(1).max(64), actor: z.string().default("system") }),
  z.object({
    type: z.literal("saveJudgeScores"),
    eventId: z.string().min(1).max(64),
    rows: z.array(judgeScoreSchema).max(2000),
    actor: z.string().default("system"),
  }),
  z.object({ type: z.literal("saveMatch"), match: matchSchema, actor: z.string().default("system") }),
  z.object({ type: z.literal("deleteMatch"), id: z.string().min(1).max(80), actor: z.string().default("system") }),
  z.object({ type: z.literal("announce"), message: z.string().min(1).max(280), actor: z.string().default("system") }),
  z.object({ type: z.literal("updateConfig"), patch: configPatchSchema, actor: z.string().default("system") }),
  z.object({ type: z.literal("updateEvent"), id: z.string().min(1).max(64), patch: eventPatchSchema, actor: z.string().default("system") }),
  z.object({ type: z.literal("upsertEvent"), event: eventSchema, actor: z.string().default("system") }),
  z.object({ type: z.literal("upsertTeam"), team: teamSchema, actor: z.string().default("system") }),
  z.object({ type: z.literal("deleteTeam"), id: z.string().min(1).max(32), actor: z.string().default("system") }),
  z.object({
    type: z.literal("saveCriteria"),
    eventId: z.string().min(1).max(64),
    rows: z.array(criterionSchema).max(20),
    actor: z.string().default("system"),
  }),
  z.object({
    type: z.literal("upsertUser"),
    user: z.object({
      username: usernameSchema,
      role: z.enum(["pio", "secretariat", "superadmin"]),
      teamId: z.string().max(64).default(""),
      active: z.boolean().default(true),
      /**
       * Plaintext, optional. Present on create and on password reset; omitted to
       * leave the current password alone. The route hashes it and drops it
       * before the command reaches the repository or the audit log.
       */
      password: z.string().min(8, "Passwords need at least 8 characters").max(200).optional(),
    }),
    actor: z.string().default("system"),
  }),
  z.object({
    type: z.literal("deleteUser"),
    username: usernameSchema,
    actor: z.string().default("system"),
  }),
]);

export type CommandInput = z.infer<typeof commandSchema>;
