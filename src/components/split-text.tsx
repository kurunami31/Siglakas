"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Word-by-word reveal for headings.
 *
 * Each word is its own inline-block, so the accessible text is still the plain
 * sentence — screen readers read it normally. Under `prefers-reduced-motion`
 * this renders as a single plain span with no animation at all, rather than
 * animating fast.
 *
 * Because every word becomes an inline-block, do NOT use this on text that
 * relies on `truncate`; a heading that has to ellipsis should keep a single
 * text node.
 */
export function SplitText({
  text,
  className = "",
  delay = 0,
  stagger = 0.045,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;

  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block"
          initial={{ opacity: 0, y: 14, filter: "blur(5px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, delay: delay + i * stagger, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}
