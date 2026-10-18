import type {
  Criterion,
  EventItem,
  JudgeScore,
  Match,
  RawSheets,
  ResultStatus,
  Role,
  Team,
  Config,
} from "../types";

export interface ResultRowInput {
  teamId: string;
  placement: number;
  tie: boolean;
  status: ResultStatus;
  /** Participants, for `participation` events only. */
  count?: number;
}

export type Command =
  | { type: "saveResults"; eventId: string; rows: ResultRowInput[]; actor: string }
  | { type: "publishResults"; eventId: string; actor: string }
  | { type: "unpublishResults"; eventId: string; actor: string }
  | { type: "deleteResult"; eventId: string; teamId: string; actor: string }
  | { type: "saveJudgeScores"; eventId: string; rows: JudgeScore[]; actor: string }
  | { type: "saveMatch"; match: Match; actor: string }
  | { type: "deleteMatch"; id: string; actor: string }
  | { type: "announce"; message: string; actor: string }
  | { type: "updateConfig"; patch: Partial<Config>; actor: string }
  | { type: "updateEvent"; id: string; actor: string; patch: Partial<EventItem> }
  | { type: "upsertTeam"; team: Team; actor: string }
  | { type: "deleteTeam"; id: string; actor: string }
  | { type: "saveCriteria"; eventId: string; rows: Criterion[]; actor: string }
  | {
      type: "upsertUser";
      user: {
        username: string;
        role: Role;
        teamId: string;
        active: boolean;
        /** Already hashed by the API route; absent means "keep the existing password". */
        passwordHash?: string;
      };
      actor: string;
    }
  | { type: "deleteUser"; username: string; actor: string };

export interface Repository {
  readonly kind: "demo" | "sheets";
  read(): Promise<RawSheets>;
  /**
   * Apply the command. Sheets-backed repositories return the exact post-write
   * snapshot so callers never have to trust a follow-up read: Google Sheets
   * reads are only eventually consistent, so a read issued right after a write
   * can still return the pre-write table.
   */
  apply(command: Command): Promise<RawSheets | void>;
}

export function isRepository(value: unknown): value is Repository {
  return !!value && typeof (value as Repository).read === "function";
}
