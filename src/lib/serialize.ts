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

/** Lightweight payload for the version/ETag endpoint. */
export function toVersionPayload(state: CompetitionState) {
  return {
    version: state.version,
    lastUpdated: state.lastUpdated,
    eventCount: state.events.length,
    teamCount: state.teams.length,
    freeze: state.config.pointsFreeze,
  };
}
