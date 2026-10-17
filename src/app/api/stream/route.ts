import { getStore } from "@/lib/store/state-store";
import { toViewerState } from "@/lib/serialize";
import { getSession } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Server-Sent Events transport.
 *
 * One long-lived request per viewer (Vercel Hobby allows 300s streams and 1M
 * invocations/month, so this is far cheaper than per-second polling). The
 * server keeps the sheet fresh at most every ~5s and only pushes when the
 * content hash actually changes.
 */
export async function GET(request: Request) {
  const store = getStore();
  await store.init();
  // Resolve the viewer once: draft rows are only streamed to signed-in editors.
  const session = await getSession();
  const role = session?.role;

  const encoder = new TextEncoder();
  let closed = false;
  let tick: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const initialState = store.getState()!;
      let lastVersion = initialState.version;
      write("snapshot", { state: toViewerState(initialState, role), status: store.getStatus() });

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (tick) clearInterval(tick);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      unsubscribe = store.subscribe((state) => {
        if (state.version === lastVersion) return;
        lastVersion = state.version;
        write("snapshot", { state: toViewerState(state, role), status: store.getStatus() });
      });

      // keep the sheet fresh + heartbeat so proxies don't drop the connection
      tick = setInterval(async () => {
        if (closed) return;
        try {
          const fresh = await store.ensureFresh(4500);
          if (fresh.version !== lastVersion) {
            lastVersion = fresh.version;
            write("snapshot", { state: toViewerState(fresh, role), status: store.getStatus() });
          } else {
            write("ping", { at: Date.now(), status: store.getStatus() });
          }
        } catch {
          write("ping", { at: Date.now(), status: store.getStatus() });
        }
      }, 5000);
      (tick as unknown as { unref?: () => void }).unref?.();

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      if (tick) clearInterval(tick);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Vary: "Cookie",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
