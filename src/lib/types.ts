/**
 * Domain types for the Grand Line Tally scoreboard.
 *
 * Everything in this file is plain data so it can travel over the wire
 * (SSE / JSON) and be unit-tested without any framework.
 */

export type Group = "faculty" | "extension_campus";
export type Division = "sports" | "cultural";
export type ScoringType = "placement" | "judged" | "match";
export type ResultStatus = "draft" | "published";
export type EventStatus = "upcoming" | "live" | "finished";
export type MatchStatus = "scheduled" | "live" | "final";
export type Gender = "M" | "W" | "M&W" | "Open";
/**
 * `superadmin` sits above the Secretariat: it is the only role that can create
 * or edit accounts, so competition-day roles can be handed out without giving
 * everyone the keys to the user list.
 */
export type Role = "pio" | "secretariat" | "superadmin";

export interface Team {
  id: string;
  /** Full official name, e.g. "Faculty of Business and Management" */
  name: string;
  /** Short label used on chips / posters, e.g. "FBM" */
  shortName: string;
  group: Group;
  /** Accent colour derived from the logo background. */
  color: string;
  /** Normalised logo id without extension, e.g. "fbm" */
  logoFile: string;
  mascot: string;
  motto?: string;
  /** Optional uploaded logo URL (Supabase Storage) overriding the bundled asset. */
  logoUrl?: string;
}

export interface EventItem {
  id: string;
  name: string;
  division: Division;
  /** e.g. "Team Sports", "Music Arts" */
  category: string;
  scoringType: ScoringType;
  /** Medals at stake (roster / performer count). */
  medalWeight: number;
  gender: Gender;
  multiplier: number;
  schedule?: string;
  venue?: string;
  status: EventStatus;
  locked: boolean;
  /** Flags an auto-corrected value the Secretariat should double-check. */
  verify?: boolean;
  note?: string;
}

export interface Criterion {
  eventId: string;
  criterion: string;
  weight: number;
  order: number;
}

export interface Match {
  id: string;
  eventId: string;
  round: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  /** Free-form per-set detail, e.g. "25-20, 25-18, 25-22" */
  detail?: string;
  winner: string;
  status: MatchStatus;
}

export interface JudgeScore {
  eventId: string;
  teamId: string;
  judge: string;
  criterion: string;
  score: number;
}

export interface Result {
  eventId: string;
  teamId: string;
  /** 1..12, or 0 for participation-only */
  placement: number;
  /** Declared tie (Secretariat decision). */
  tie: boolean;
  status: ResultStatus;
  enteredBy: string;
  timestamp: string;
}

export interface Announcement {
  timestamp: string;
  message: string;
  postedBy: string;
}

export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface TeamUser {
  username: string;
  passwordHash: string;
  role: Role;
  teamId: string;
  active: boolean;
}

/** A named placement → points table (Config / PointTables tab). */
export interface PlacementTable {
  /** placement number → points */
  places: Record<number, number>;
  /** points for teams that did not place */
  participation: number;
  name?: string;
}

export type ChampionshipRankBy =
  | "total_medals"
  | "gold_first"
  | "weighted_points";

export interface Config {
  competitionName: string;
  schoolName: string;
  subtitle: string;
  championshipRankBy: ChampionshipRankBy;
  medalPoints: { gold: number; silver: number; bronze: number };
  defaultPlacementTable: PlacementTable;
  /** "onepiece" | "plain" terminology toggle */
  terminology: "onepiece" | "plain";
  /** Hide the public leaderboard for suspense. */
  pointsFreeze: boolean;
  /** Dramatic reveal overlay for the freeze. */
  revealMode: boolean;
}

export interface RawSheets {
  config: Partial<Config> & Record<string, unknown>;
  teams: Team[];
  events: EventItem[];
  criteria: Criterion[];
  matches: Match[];
  judgeScores: JudgeScore[];
  results: Result[];
  announcements: Announcement[];
  auditLog: AuditEntry[];
  users: TeamUser[];
}

export interface ScoreBreakdown {
  points: number;
  gold: number;
  silver: number;
  bronze: number;
  totalMedals: number;
  medalPoints: number;
}

export type DivisionOrOverall = "overall" | Division;

export interface TeamStanding {
  teamId: string;
  overall: ScoreBreakdown;
  sports: ScoreBreakdown;
  cultural: ScoreBreakdown;
  /**
   * Rank per division. The `overall` rank is computed across ALL teams and is
   * never affected by the group (faculty / campus) display filter.
   */
  ranks: Record<DivisionOrOverall, number>;
  /** overall rank change vs. previous snapshot (positive = moved up). */
  rankChange: number;
  prevRank: number | null;
}

export interface CompetitionState {
  config: Config;
  teams: Team[];
  events: EventItem[];
  criteria: Criterion[];
  matches: Match[];
  results: Result[];
  announcements: Announcement[];
  userCount: number;
  standings: TeamStanding[];
  lastUpdated: string;
  /** content hash of the source data, used by clients to skip re-renders */
  version: string;
}

export const DIVISION_LABEL: Record<Division, string> = {
  sports: "Sports",
  cultural: "Socio-Cultural",
};

export function emptyBreakdown(): ScoreBreakdown {
  return { points: 0, gold: 0, silver: 0, bronze: 0, totalMedals: 0, medalPoints: 0 };
}

export function addBreakdown(a: ScoreBreakdown, b: ScoreBreakdown): ScoreBreakdown {
  return {
    points: a.points + b.points,
    gold: a.gold + b.gold,
    silver: a.silver + b.silver,
    bronze: a.bronze + b.bronze,
    totalMedals: a.totalMedals + b.totalMedals,
    medalPoints: a.medalPoints + b.medalPoints,
  };
}
