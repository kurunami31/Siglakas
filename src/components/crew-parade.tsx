"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { Team } from "@/lib/types";
import { TeamBadge } from "./team-badge";
import { Icon } from "./icons";

const SEEN_KEY = "gl-parade-seen";

/**
 * "Crew Parade" intro: the twelve mascot logos sail past on a galleon, then the
 * board settles. Shown once per session; instantly skipped for reduced motion.
 */
export function CrewParade({ teams }: { teams: Team[] }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"hidden" | "playing" | "done">("hidden");

  useEffect(() => {
    if (reduce || sessionStorage.getItem(SEEN_KEY) === "1") {
      setPhase("done");
      return;
    }
    setPhase("playing");
    const id = setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, "1");
      setPhase("done");
    }, 5200);
    return () => clearTimeout(id);
  }, [reduce]);

  if (phase !== "playing") return null;

  // Rendered into <body> on purpose. `position: fixed` resolves against the
  // nearest ancestor that carries a transform, and the animated wrappers up the
  // tree set one — so `inset-0` sized this overlay to the content column rather
  // than the viewport (measured 1101px tall against a 900px viewport), leaving a
  // band at the bottom of the screen undimmed. A portal guarantees inset-0 means
  // the real viewport.
  return createPortal(
    <div
      role="dialog"
      aria-label="Crew parade introduction"
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/95"
    >
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(SEEN_KEY, "1");
          setPhase("done");
        }}
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-foam/30 px-3 py-2 text-sm text-parchment hover:border-straw hover:text-straw"
      >
        Skip intro
        <Icon name="close" size={14} />
      </button>

      <div className="relative w-full">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display mb-8 text-center text-4xl text-straw sm:text-6xl"
        >
          Set sail, crews of the Grand Line!
        </motion.p>

        <div className="relative h-40">
          <motion.div
            initial={{ x: "-15vw", opacity: 0 }}
            animate={{ x: ["-15vw", "115vw"], opacity: [0, 1, 1, 0.2] }}
            transition={{ duration: 4.6, ease: "linear" }}
            className="absolute top-6 flex items-center gap-6"
          >
            <span aria-hidden className="text-straw/80">
              <Icon name="ship" size={56} strokeWidth={1.5} />
            </span>
            <div className="flex items-center gap-4">
              {teams.map((team, i) => (
                <motion.span
                  key={team.id}
                  initial={{ y: 0 }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.12 }}
                >
                  <TeamBadge team={team} size={76} shape="square" priority />
                  <span className="mt-1 block text-center text-[0.6rem] uppercase tracking-wider text-parchment/80">
                    {team.shortName}
                  </span>
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>

      </div>

      {/* Pinned to the bottom of the SCREEN, not to the content wrapper.
          Anchored to the wrapper the sea sat mid-screen and left a band of
          empty space below the intro. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 w-full opacity-70">
        <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="h-full w-[200%] animate-[wave_12s_linear_infinite] text-ocean-2">
          <path fill="currentColor" d="M0,60 C300,110 500,10 800,55 C1100,100 1300,20 1600,60 C1900,100 2100,25 2400,60 L2400,120 L0,120 Z" />
        </svg>
      </div>
    </div>,
    document.body,
  );
}
