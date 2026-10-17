"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CompetitionState, Role } from "@/lib/types";
import { Icon } from "./icons";

export interface Toast {
  id: number;
  kind: "score" | "info" | "error";
  title: string;
  body?: string;
  teamId?: string;
}

interface LiveContextValue {
  state: CompetitionState;
  /** Signed-in staff role, or null for a public viewer. */
  role: Role | null;
  connected: boolean;
  degraded: boolean;
  transport: "sse" | "polling";
  pushToast: (t: Omit<Toast, "id">) => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({
  initial,
  role = null,
  children,
}: {
  initial: CompetitionState;
  role?: Role | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<CompetitionState>(initial);
  const [connected, setConnected] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [transport, setTransport] = useState<"sse" | "polling">("sse");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastVersion = useRef(initial.version);
  const toastSeq = useRef(0);
  const lastAnnouncement = useRef(initial.announcements[0]?.timestamp ?? "");
  const lastResultCount = useRef(initial.results.length);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const applyState = useCallback(
    (next: CompetitionState, quiet = false) => {
      if (next.version === lastVersion.current) return;
      lastVersion.current = next.version;
      setState(next);
      if (quiet) return;

      const newestAnnouncement = next.announcements[0];
      if (newestAnnouncement && newestAnnouncement.timestamp !== lastAnnouncement.current) {
        lastAnnouncement.current = newestAnnouncement.timestamp;
        pushToast({ kind: "info", title: "Announcement", body: newestAnnouncement.message });
      }

      if (next.results.length > lastResultCount.current) {
        lastResultCount.current = next.results.length;
        const published = next.results.filter((r) => r.status === "published");
        const newest = published[published.length - 1];
        const team = newest && next.teams.find((t) => t.id === newest.teamId);
        const event = newest && next.events.find((e) => e.id === newest.eventId);
        if (team && event) {
          pushToast({
            kind: "score",
            teamId: team.id,
            title: `${team.shortName} placed #${newest.placement} in ${event.name}`,
            body: `${event.medalWeight} medals at stake`,
          });
        }
      }
    },
    [pushToast],
  );

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const startPolling = () => {
      if (poll || stopped) return;
      setTransport("polling");
      poll = setInterval(async () => {
        if (stopped) return;
        try {
          const res = await fetch("/api/state", { cache: "no-store" });
          if (!res.ok) throw new Error("bad status");
          const data = await res.json();
          setConnected(true);
          setDegraded(false);
          applyState(data.state, true);
        } catch {
          setConnected(false);
          setDegraded(true);
        }
      }, 6000);
    };

    const startSSE = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/stream");
      } catch {
        startPolling();
        return;
      }
      setTransport("sse");
      es.addEventListener("open", () => {
        setConnected(true);
        setDegraded(false);
      });
      es.addEventListener("snapshot", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { state: CompetitionState };
          setConnected(true);
          setDegraded(false);
          applyState(data.state);
        } catch {
          /* ignore malformed frame */
        }
      });
      es.addEventListener("ping", () => {
        setConnected(true);
        setDegraded(false);
      });
      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        startPolling();
        // try to re-establish SSE a bit later
        setTimeout(() => {
          if (stopped) return;
          if (poll) {
            clearInterval(poll);
            poll = null;
          }
          startSSE();
        }, 15_000);
      };
    };

    startSSE();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !es && !poll) startSSE();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LiveContextValue>(
    () => ({ state, role, connected, degraded, transport, pushToast }),
    [state, role, connected, degraded, transport, pushToast],
  );

  return (
    <LiveContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </LiveContext.Provider>
  );
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 left-1/2 z-50 flex w-[min(94vw,26rem)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0 print:hidden"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="panel rising flex items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm"
        >
          <span className="mt-0.5 shrink-0 text-straw">
            <Icon name={t.kind === "score" ? "coin" : t.kind === "error" ? "warning" : "megaphone"} size={18} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-parchment">{t.title}</span>
            {t.body && <span className="block text-xs text-foam/80">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
