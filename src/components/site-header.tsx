"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLive } from "./providers";
import { terms } from "@/lib/terminology";
import { Icon, type IconName } from "./icons";

const LINKS: Array<{ href: string; label: string; plain: string; icon: IconName }> = [
  { href: "/", label: "Bounty Board", plain: "Leaderboard", icon: "flag" },
  { href: "/medals", label: "Medal Tally", plain: "Medal Tally", icon: "medal" },
  { href: "/events", label: "Islands", plain: "Events", icon: "map" },
  { href: "/sports", label: "Sports Seas", plain: "Sports", icon: "ball" },
  { href: "/display", label: "TV Mode", plain: "TV Mode", icon: "tv" },
  { href: "/about", label: "About", plain: "About", icon: "users" },
];

export function SiteHeader() {
  const { state, connected, degraded, transport } = useLive();
  const t = terms(state.config);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-foam/15 bg-ink/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-5">
        <Link href="/welcome" className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/brand/siglakas-logo.png"
            alt=""
            width={80}
            height={80}
            priority
            className="h-9 w-9 shrink-0 rounded-lg bg-white object-cover shadow-[0_0_20px_-6px_var(--color-straw)] ring-1 ring-straw/50 sm:h-10 sm:w-10"
          />
          <span className="min-w-0">
            <span className="font-display block truncate text-lg leading-none text-parchment sm:text-xl">
              {state.config.subtitle || "Grand Line Tally"}
            </span>
            <span className="hidden truncate text-[0.7rem] text-foam/70 sm:block">
              {state.config.competitionName}
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const label = state.config.terminology === "plain" ? l.plain : l.label;
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
                  active ? "bg-straw/15 text-straw" : "text-parchment/85 hover:bg-foam/10 hover:text-parchment"
                }`}
              >
                <Icon name={l.icon} size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <ConnectionPill connected={connected} degraded={degraded} transport={transport} label={t.live} />
          <Link
            href="/admin"
            className="hidden min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm font-semibold text-parchment/90 hover:border-straw hover:text-straw sm:inline-flex"
          >
            <Icon name="anchor" size={15} />
            Admin
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-foam/25 text-parchment lg:hidden"
          >
            <span className="sr-only">Toggle navigation</span>
            <Icon name={open ? "close" : "menu"} size={20} />
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-foam/15 bg-ink/95 px-3 py-2 lg:hidden">
          <ul className="grid grid-cols-2 gap-1.5">
            {[...LINKS, { href: "/admin", label: "Admin", plain: "Admin", icon: "anchor" as IconName }].map((l) => {
              const label = state.config.terminology === "plain" ? l.plain : l.label;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-medium text-parchment/90 hover:bg-foam/10"
                  >
                    <Icon name={l.icon} size={16} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function ConnectionPill({
  connected,
  degraded,
  transport,
  label,
}: {
  connected: boolean;
  degraded: boolean;
  transport: string;
  label: string;
}) {
  const state = !connected ? "offline" : degraded ? "degraded" : "live";
  const text = !connected ? "Reconnecting…" : degraded ? "Last known data" : label;
  const dot = !connected ? "bg-blood" : degraded ? "bg-sunset" : "bg-teal";
  return (
    <span
      role="status"
      aria-live="polite"
      title={`Transport: ${transport}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-foam/20 bg-ink/60 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-parchment/90"
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${dot} ${connected && !degraded ? "animate-pulse" : ""}`} />
      {text}
      {state === "live" && <span className="sr-only">Live updates connected</span>}
    </span>
  );
}
