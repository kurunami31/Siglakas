"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icons";

/**
 * Decorative animated ocean: layered SVG waves with gentle parallax, floating
 * clouds and a ship that sails slowly across. Pure CSS/SVG — nothing copyrighted.
 * Hidden from assistive tech and disabled under prefers-reduced-motion.
 */
export function Ocean({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        el.style.setProperty("--parallax", String(Math.min(y * 0.06, 60)));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden ${className}`}>
      {/* drifting clouds */}
      <div className="parallax-layer absolute inset-x-0 top-0 h-64 opacity-[0.22]" style={{ transform: "translateY(calc(var(--parallax, 0px) * -0.4))" }}>
        <Cloud className="absolute left-[8%] top-6 h-10 w-40 animate-[sail_90s_linear_infinite]" />
        <Cloud className="absolute left-[45%] top-16 h-8 w-28 animate-[sail_120s_linear_infinite]" />
        <Cloud className="absolute left-[72%] top-4 h-12 w-48 animate-[sail_150s_linear_infinite]" />
      </div>

      {/* seagulls */}
      <div className="absolute inset-x-0 top-24 h-20 text-foam/40">
        <span className="absolute left-[20%] animate-[floaty_7s_ease-in-out_infinite]">
          <Icon name="gull" size={30} strokeWidth={1.5} />
        </span>
        <span className="absolute left-[62%] top-6 animate-[floaty_9s_ease-in-out_infinite]">
          <Icon name="gull" size={22} strokeWidth={1.5} />
        </span>
      </div>

      {/* the ship */}
      <div className="absolute bottom-24 left-0 hidden w-32 text-straw/70 sm:block" style={{ animation: "sail 70s linear infinite" }}>
        <Ship />
      </div>

      {/* waves */}
      <div className="parallax-layer absolute bottom-0 left-0 h-40 w-full" style={{ transform: "translateY(calc(var(--parallax, 0px) * -0.2))" }}>
        <Wave className="text-ocean-2/25" speed="26s" height={140} />
      </div>
      <div className="absolute bottom-0 left-0 h-32 w-full">
        <Wave className="text-ocean/45" speed="16s" height={110} />
      </div>
      <div className="absolute bottom-0 left-0 h-20 w-full">
        <Wave className="text-ink/70" speed="11s" height={80} />
      </div>
    </div>
  );
}

function Wave({ className, speed, height }: { className: string; speed: string; height: number }) {
  return (
    <svg
      className={`absolute bottom-0 left-0 h-full w-[200%] ${className}`}
      viewBox="0 0 2400 120"
      preserveAspectRatio="none"
      style={{ animation: `wave ${speed} linear infinite` }}
    >
      <path
        fill="currentColor"
        d="M0,60 C300,110 500,10 800,55 C1100,100 1300,20 1600,60 C1900,100 2100,25 2400,60 L2400,120 L0,120 Z"
      />
    </svg>
  );
}

function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 60" fill="currentColor" aria-hidden>
      <ellipse cx="45" cy="40" rx="45" ry="20" />
      <ellipse cx="95" cy="30" rx="55" ry="26" />
      <ellipse cx="150" cy="42" rx="42" ry="18" />
    </svg>
  );
}

function Ship() {
  return (
    <svg viewBox="0 0 120 90" fill="none" aria-hidden>
      <path d="M10 70 L110 70 L96 84 L24 84 Z" fill="currentColor" opacity="0.85" />
      <rect x="58" y="10" width="4" height="60" fill="currentColor" />
      <path d="M62 14 L96 44 L62 44 Z" fill="#f4e5c6" opacity="0.9" />
      <path d="M56 22 L30 48 L56 48 Z" fill="#ff8a3d" opacity="0.9" />
      <circle cx="60" cy="9" r="4" fill="#c0392b" />
    </svg>
  );
}
