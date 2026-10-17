"use client";

import Image from "next/image";
import { useState } from "react";
import type { Team } from "@/lib/types";
import { hexToRgbTriplet, prefersDarkText } from "@/lib/format";

interface TeamBadgeProps {
  team: Team;
  size?: number;
  priority?: boolean;
  className?: string;
  /** circular (default) or rounded-square frame */
  shape?: "circle" | "square";
}

/**
 * The supplied mascot logo, shown as a square badge in a frame tinted with the
 * team's accent colour (never recoloured or cropped — object-fit: cover on a
 * 1:1 box, which the artwork is already padded for).
 *
 * Falls back to an accent-coloured badge with the team initials when the logo
 * is missing or fails to load.
 */
export function TeamBadge({
  team,
  size = 56,
  priority = false,
  className = "",
  shape = "circle",
}: TeamBadgeProps) {
  const [failed, setFailed] = useState(false);
  const src = team.logoUrl || `/logos/${team.logoFile}/256.webp`;
  const radius = shape === "circle" ? "9999px" : `${Math.round(size * 0.22)}px`;
  const initials = team.shortName.slice(0, 4);
  const dark = prefersDarkText(team.color);

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `rgb(${hexToRgbTriplet(team.color)} / 0.22)`,
        border: `2px solid ${team.color}`,
        boxShadow: `0 0 0 3px rgba(7,20,38,0.55), 0 0 ${Math.round(size / 4)}px -6px ${team.color}`,
      }}
      title={`${team.name} — ${team.mascot}`}
    >
      {failed ? (
        <span
          aria-hidden
          className="font-display select-none"
          style={{
            fontSize: size * 0.38,
            color: dark ? "#1c1206" : "#f7ecd2",
          }}
        >
          {initials}
        </span>
      ) : (
        <Image
          src={src}
          alt={`${team.shortName} mascot logo: ${team.mascot}`}
          width={size}
          height={size}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          sizes={`${size}px`}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}
