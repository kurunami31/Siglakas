"use client";

import { useLive } from "./providers";
import { relativeTime } from "@/lib/format";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

/** Announcement ticker — scrolls the newest messages across the top. */
export function Ticker() {
  const { state } = useLive();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Set on mount (not during render) so server and client HTML match.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const announcements = state.announcements.slice(0, 6);
  if (announcements.length === 0 || now === null) return null;

  const items = announcements.map((a) => `${relativeTime(a.timestamp, now)} — ${a.message}`);

  return (
    <div className="relative overflow-hidden border-b border-foam/15 bg-gradient-to-r from-navy via-navy-2 to-navy print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-1.5 sm:px-5">
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-sunset px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-ink">
          <Icon name="megaphone" size={12} strokeWidth={2.2} /> Bulletin
        </span>
        <div className="group relative min-w-0 flex-1 overflow-hidden">
          <ul className="flex w-max animate-[wave_38s_linear_infinite] gap-10 whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:overflow-x-auto">
            {[...items, ...items].map((text, i) => (
              <li key={i} className="text-xs text-parchment/85">
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
