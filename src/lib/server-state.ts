import { getStore } from "@/lib/store/state-store";
import { toPublicState, toViewerState } from "@/lib/serialize";
import { getSession } from "@/lib/auth/server";
import type { CompetitionState } from "@/lib/types";

/**
 * Server-side helper used by server components so the first paint already has
 * live data (no client fetch waterfall). Safe to call from any RSC.
 *
 * Draft results are included only for the signed-in editor, mirroring the
 * API routes, so the admin grid hydrates from the very first paint.
 */
export async function getViewerState(): Promise<CompetitionState> {
  const store = getStore();
  await store.init();
  const state = await store.ensureFresh(4000);
  const session = await getSession();
  return toViewerState(state, session?.role);
}

/** Published-only variant for pages that are always public. */
export async function getPublicState(): Promise<CompetitionState> {
  const store = getStore();
  await store.init();
  return toPublicState(await store.ensureFresh(4000));
}

export async function getStoreStatus() {
  return getStore().getStatus();
}
