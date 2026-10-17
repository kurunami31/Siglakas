"use client";

import { useEffect, useState } from "react";

interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Rolling number animation. Respects prefers-reduced-motion (jumps straight to
 * the final value) and is cheap enough for mid-range phones.
 */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), durationMs = 900, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = display;
    const delta = value - from;
    if (delta === 0) return;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + delta * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, reduce]);

  // A plain <span> cannot carry aria-label (axe: aria-prohibited-attr). Provide
  // the final value as real (visually hidden) text instead, and keep the
  // animating number out of the accessibility tree entirely.
  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>{format(display)}</span>
    </span>
  );
}
