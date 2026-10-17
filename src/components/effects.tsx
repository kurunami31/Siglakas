"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Team } from "@/lib/types";
import { TeamBadge } from "./team-badge";
import { Icon } from "./icons";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  size: number;
  kind: "coin" | "flag" | "dot";
}

/**
 * Lightweight canvas coin/confetti burst. Fires whenever `trigger` changes and
 * is a no-op under prefers-reduced-motion.
 */
export function CoinBurst({ trigger, colors, className = "" }: { trigger: unknown; colors: string[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;
    const particles: Particle[] = [];
    const palette = colors.length ? colors : ["#f8d13d", "#ff8a3d", "#f4e5c6"];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: W() * (0.3 + Math.random() * 0.4),
        y: H() * 0.25,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 9 - 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: palette[i % palette.length],
        size: 5 + Math.random() * 7,
        kind: i % 3 === 0 ? "coin" : i % 3 === 1 ? "flag" : "dot",
      });
    }

    const gravity = 0.28;
    let frames = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      let alive = 0;
      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < H() + 40) alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === "coin") {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(-p.size * 0.15, -p.size * 0.6, p.size * 0.3, p.size * 1.2);
        } else if (p.kind === "flag") {
          ctx.fillRect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4);
        } else {
          ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
        }
        ctx.restore();
      }
      frames++;
      if (alive > 0 && frames < 220) raf.current = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduce]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}

/**
 * Points-freeze presentation. While the Secretariat has the board sealed the
 * public sees a locked treasure chest; when it is released we play a dramatic
 * reveal of the leading crews.
 */
export function SealedBoard({
  sealed,
  teams,
  colors,
  children,
}: {
  sealed: boolean;
  teams: Team[];
  colors: string[];
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const top = teams.slice(0, 3);

  return (
    <div className="relative">
      {sealed ? (
        <div className="panel relative overflow-hidden rounded-2xl p-8 text-center">
          <motion.div
            initial={reduce ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto max-w-lg space-y-3"
          >
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-3xl border-2 border-straw/50 bg-ink/60 text-straw shadow-[0_0_50px_-10px_var(--color-straw)] animate-[floaty_5s_ease-in-out_infinite]">
              <Icon name="chest" size={64} strokeWidth={1.4} />
            </div>
            <h2 className="font-display text-3xl text-straw">The standings are sealed!</h2>
            <p className="text-sm text-foam/85">
              The Secretariat has locked the board for the final events. The reveal comes at the closing ceremony —
              hold your breath, pirates.
            </p>
            <div className="flex justify-center gap-3 pt-2 opacity-60 blur-[2px]">
              {top.map((t) => (
                <TeamBadge key={t.id} team={t} size={44} />
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          {children}
        </motion.div>
      )}
      <CoinBurst trigger={sealed} colors={colors} />
    </div>
  );
}
