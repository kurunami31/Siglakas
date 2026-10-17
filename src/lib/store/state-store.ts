import type { CompetitionState, RawSheets } from "../types";
import type { Command, Repository } from "../data/repo";
import { deriveState, hashString } from "../data/derive";
import { EVENTS, TEAMS } from "../data/seed";
import { DemoRepository } from "../data/demo-repo";
import { createRepository, isDemoMode } from "./factory";

/**
 * Signature of the bundled seed data. In dev, HMR keeps `globalThis` alive, so
 * without this the store would keep serving the *old* seed after you edit
 * `seed.ts`. Rebuilding when the signature changes makes seed edits instant.
 */
const SEED_SIGNATURE = hashString(
  EVENTS.map((e) => `${e.id}:${e.name}:${e.medalWeight}:${e.category}`).join("|") +
    "##" +
    TEAMS.map((t) => `${t.id}:${t.name}:${t.color}`).join("|"),
);

type Listener = (state: CompetitionState) => void;

export interface StoreStatus {
  kind: "demo" | "sheets";
  ok: boolean;
  lastError: string | null;
  lastSyncedAt: string | null;
}

/**
 * The single server-side cache described in the architecture: the sheet is read
 * ONCE here and every connected client is served from this snapshot, so viewer
 * count never multiplies the number of Google Sheets reads.
 *
 * A module-level singleton works for a single Node instance (Docker / a VM /
 * a venue laptop). On multi-instance serverless the same instance-level dedupe
 * still applies per instance; the documented scale path is the `ensureFresh`
 * staleness guard plus a shared cache (Supabase) behind this same interface.
 */
class StateStore {
  private repo: Repository;
  private raw: RawSheets | null = null;
  private state: CompetitionState | null = null;
  private listeners = new Set<Listener>();
  private previousRanks: Record<string, number> = {};
  private refreshing: Promise<void> | null = null;
  private status: StoreStatus;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.repo = createRepository();
    this.status = {
      kind: this.repo.kind,
      ok: true,
      lastError: null,
      lastSyncedAt: null,
    };
  }

  get repoKind() {
    return this.repo.kind;
  }

  getStatus(): StoreStatus {
    return { ...this.status };
  }

  async ensureFresh(maxAgeMs = 5000): Promise<CompetitionState> {
    const age = this.status.lastSyncedAt ? Date.now() - Date.parse(this.status.lastSyncedAt) : Infinity;
    if (!this.state || age > maxAgeMs) {
      await this.refresh();
    }
    return this.state!;
  }

  getState(): CompetitionState | null {
    return this.state;
  }

  /** Last raw snapshot (includes password hashes). Server-only. */
  async currentRaw(): Promise<RawSheets | null> {
    if (!this.raw) await this.init();
    return this.raw;
  }

  async init(): Promise<CompetitionState> {
    if (!this.state) await this.refresh();
    this.startLoops();
    return this.state!;
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const raw = await this.repo.read();
        this.applyRaw(raw);
        this.status = { ...this.status, ok: true, lastError: null, lastSyncedAt: new Date().toISOString() };
      } catch (err) {
        // Graceful degradation: keep serving the last known-good snapshot.
        this.status = {
          ...this.status,
          ok: false,
          lastError: err instanceof Error ? err.message : String(err),
        };
        console.error("[store] refresh failed:", err);
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private applyRaw(raw: RawSheets): void {
    const next = deriveState(raw, { previousRanks: this.previousRanks });
    const changed = next.version !== this.state?.version;
    // remember ranks for next time so we can render up/down arrows
    this.previousRanks = Object.fromEntries(next.standings.map((s) => [s.teamId, s.ranks.overall]));
    this.raw = raw;
    this.state = next;
    if (changed) this.notify();
  }

  /**
   * Serialise every write. `Repository.apply` is read-modify-write across whole
   * tabs, so two commands running concurrently would each read the same
   * snapshot and the second write would silently drop the first one's rows —
   * exactly what happens when two PIOs publish at the same moment. Chaining
   * means each write is based on the previous one's result.
   *
   * This closes the window within one server instance, which is where the race
   * actually bites. Across instances the shared-cache layer is the real fix.
   */
  private writeQueue: Promise<unknown> = Promise.resolve();

  async applyCommand(command: Command): Promise<CompetitionState> {
    const run = this.writeQueue.then(
      () => this.applyNow(command),
      () => this.applyNow(command), // a rejected write must not poison the chain
    );
    this.writeQueue = run.catch(() => {});
    return run;
  }

  private async applyNow(command: Command): Promise<CompetitionState> {
    const raw = await this.repo.apply(command);
    if (raw) {
      // The repository handed back the exact post-write snapshot, so adopt it
      // straight away. Re-reading here would be at the mercy of Sheets'
      // read-after-write lag, which can still return the pre-write table and
      // make a fresh publish look like it did nothing. (Also saves a read.)
      this.applyRaw(raw);
      this.status = { ...this.status, ok: true, lastError: null, lastSyncedAt: new Date().toISOString() };
    } else {
      // Repository that mutates in place (demo): the in-flight guard still
      // matters, since a read that began before the write could land after it.
      if (this.refreshing) await this.refreshing.catch(() => {});
      this.status = { ...this.status, lastSyncedAt: null }; // force a re-read
      await this.refresh();
    }
    return this.state!;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    if (!this.state) return;
    for (const l of this.listeners) {
      try {
        l(this.state);
      } catch (err) {
        console.error("[store] listener error:", err);
      }
    }
  }

  /** Start the background poller (sheets) or live simulator (demo). */
  startLoops(): void {
    if (this.timer || typeof window !== "undefined") return;
    const demo = isDemoMode();
    const interval = demo ? 8000 : Number(process.env.SHEET_POLL_MS ?? 15000);
    this.timer = setInterval(async () => {
      if (demo && this.repo instanceof DemoRepository) {
        const rng = Math.random;
        let touched = false;
        for (let i = 0; i < 2; i++) touched = this.repo.simulateTick(rng) || touched;
        if (touched) {
          this.status = { ...this.status, lastSyncedAt: null };
        }
      }
      await this.refresh();
    }, interval);
    // do not keep the process alive just for polling
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  stopLoops(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

const globalForStore = globalThis as unknown as {
  __grandLineStore?: StateStore;
  __grandLineStoreSignature?: string;
};

export function getStore(): StateStore {
  let store = globalForStore.__grandLineStore;
  // Demo/HMR guard: rebuild whenever the bundled seed data changes.
  if (!store || globalForStore.__grandLineStoreSignature !== SEED_SIGNATURE) {
    store?.stopLoops();
    store = new StateStore();
    globalForStore.__grandLineStore = store;
    globalForStore.__grandLineStoreSignature = SEED_SIGNATURE;
  }
  return store;
}
