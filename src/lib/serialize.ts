import type { CompetitionState, Role } from "./types";
import { can } from "./auth/permissions";

/**
 * Strip anything a public viewer must not see: draft (unpublished) results and
 * the identity of who entered what. Standings are already published-only.
 */
export function toPublicState(state: CompetitionState): CompetitionState {
  return {
    ...state,
    results: state.results.filter((r) => r.status === "published"),
  };
}

/**
 * Serialize for the requesting viewer. Draft rows are withheld from the public
 * payload, but any signed-in editor must still receive them — otherwise the
 * admin grid could not re-hydrate a saved draft after a reload, which would
 * break the draft → publish workflow.
 *
 * Visibility is keyed on the `edit_result` permission (held by PIO and
 * Secretariat), so it can never be widened by accident.
 */
export function toViewerState(state: CompetitionState, role: Role | null | undefined): CompetitionState {
  return can(role, "edit_result") ? state : toPublicState(state);
}

/** Signed-in staff are the only viewers the maintenance switch never applies to. */
export function isStaff(role: Role | null | undefined): boolean {
  return !!role;
}

/** Is the board closed to this viewer right now? */
export function isBoardClosed(state: CompetitionState, role: Role | null | undefined): boolean {
  return state.config.maintenance && !isStaff(role);
}

/**
 * The payload served while the board is closed. The crew and event roster still
 * travels — those names are printed on the programme anyway — but nothing that
 * carries a score or a medal, so a half-finished correction cannot be read back
 * out of the API while it is being made.
 */
export function toMaintenanceState(state: CompetitionState): CompetitionState {
  return { ...state, results: [], matches: [], standings: [] };
}

/**
 * The single answer to "what may this viewer see": maintenance first, then the
 * draft-visibility rule. Both live endpoints and the server render go through
 * here so they can never disagree about what is public.
 */
export function stateForViewer(
  state: CompetitionState,
  role: Role | null | undefined,
): CompetitionState {
  if (isBoardClosed(state, role)) return toMaintenanceState(state);
  return toViewerState(state, role);
}

/** Lightweight payload for the version/ETag endpoint. */
export function toVersionPayload(state: CompetitionState) {
  return {
    version: state.version,
    lastUpdated: state.lastUpdated,
    eventCount: state.events.length,
    teamCount: state.teams.length,
    freeze: state.config.pointsFreeze,
    maintenance: state.config.maintenance,
  };
}
