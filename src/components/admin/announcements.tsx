"use client";

import { useState } from "react";
import { useLive } from "@/components/providers";
import { postCommand } from "@/lib/admin-client";
import { relativeTime } from "@/lib/format";
import { Icon } from "@/components/icons";

export function Announcements() {
  const { state } = useLive();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await postCommand({ type: "announce", message: trimmed });
    setBusy(false);
    if (!res.ok) {
      setStatus(res.error ?? "Could not post");
      return;
    }
    setMessage("");
    setStatus("Posted to the bulletin and TV mode.");
  }

  return (
    <section className="space-y-4">
      <h1 className="font-display flex items-center gap-2 text-3xl text-parchment">
        <Icon name="megaphone" size={26} className="text-straw" /> Announcements
      </h1>

      <div className="panel space-y-3 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-foam/70">New bulletin (max 280 characters)</span>
          <textarea
            value={message}
            maxLength={280}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-foam/25 bg-ink/60 px-3 py-2.5 text-parchment"
            placeholder="Volleyball (W) final starts at the gym in 10 minutes!"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={post}
            disabled={busy || !message.trim()}
            className="rounded-lg bg-straw px-4 py-2.5 font-semibold text-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post announcement"}
          </button>
          <span className="text-xs text-foam/60">{message.length}/280</span>
        </div>
        {status && <p role="status" className="text-sm text-teal">{status}</p>}
      </div>

      <div className="panel rounded-2xl p-4">
        <h2 className="font-display mb-2 text-xl text-parchment">Recent</h2>
        <ul className="space-y-2">
          {state.announcements.slice(0, 12).map((a, i) => (
            <li key={i} className="rounded-lg border border-foam/15 bg-ink/40 p-2.5">
              <p className="text-sm text-parchment">{a.message}</p>
              <p className="text-[0.68rem] text-foam/60">
                {relativeTime(a.timestamp)} · {a.postedBy}
              </p>
            </li>
          ))}
          {state.announcements.length === 0 && <li className="text-sm italic text-foam/60">Nothing posted yet.</li>}
        </ul>
      </div>
    </section>
  );
}
