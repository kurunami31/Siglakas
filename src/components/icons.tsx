import type { ReactNode } from "react";

/**
 * Original SVG icon set — no emoji, no third-party icon fonts.
 *
 * All icons are drawn on a 24×24 grid, inherit `currentColor`, and use a
 * consistent stroke weight so they sit together cleanly. Decorative by default:
 * pass `title` to expose them to assistive tech, otherwise they are aria-hidden.
 */

export type IconName =
  | "compass"
  | "flag"
  | "medal"
  | "trophy"
  | "map"
  | "ball"
  | "tv"
  | "anchor"
  | "megaphone"
  | "bolt"
  | "mask"
  | "gear"
  | "scroll"
  | "lock"
  | "warning"
  | "signal"
  | "crown"
  | "coin"
  | "chest"
  | "ship"
  | "chart"
  | "calendar"
  | "pin"
  | "users"
  | "close"
  | "menu"
  | "undo"
  | "play"
  | "pause"
  | "chevronLeft"
  | "chevronRight"
  | "arrowUp"
  | "arrowDown"
  | "minus"
  | "dot"
  | "star"
  | "gull";

const PATHS: Record<IconName, ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.6 8.4 13.2 13.2 8.4 15.6 10.8 10.8z" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h13.5l-2.6 3.6 2.6 3.6H5" />
      <circle cx="10.2" cy="8.6" r="1.5" />
      <path d="M9 12.4h2.4" />
    </>
  ),
  medal: (
    <>
      <path d="M8 3 6.2 8.4M16 3l1.8 5.4" />
      <circle cx="12" cy="15" r="5.2" />
      <path d="M12 12.6v4.8M9.6 15h4.8" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5.4v1.6A3.4 3.4 0 0 0 8.8 10" />
      <path d="M16 5h2.6v1.6A3.4 3.4 0 0 1 15.2 10" />
      <path d="M12 13v3.2" />
      <path d="M9.4 20.5h5.2" />
      <path d="M10 16.2h4l.7 4.3H9.3z" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3.5 6v13.5L9 17.5l6 2 5.5-2V4l-5.5 2z" />
      <path d="M9 4v13.5M15 6v13.5" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M4.6 7.6c4 3 10.8 3 14.8 0" />
      <path d="M4.6 16.4c4-3 10.8-3 14.8 0" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M12 17v4M9 21h6" />
    </>
  ),
  anchor: (
    <>
      <circle cx="12" cy="5" r="2.4" />
      <path d="M12 7.4V21" />
      <path d="M6.5 11h11" />
      <path d="M4.2 15a7.8 7.8 0 0 0 15.6 0" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 10H5a1 1 0 0 0-1 1z" />
      <path d="M15.8 8.6a4.8 4.8 0 0 1 0 6.8" />
      <path d="M18.4 6.2a8.2 8.2 0 0 1 0 11.6" />
    </>
  ),
  bolt: <path d="M13.6 2 5 13.4h6L10.4 22 19 10.6h-6z" />,
  mask: (
    <>
      <path d="M3.2 5.6h8v6.2a4 4 0 0 1-8 0z" />
      <path d="M12.8 5.6h8v6.2a4 4 0 0 1-8 0z" />
      <path d="M6 9.3c.8.9 1.6.9 2.4 0" />
      <path d="M15.6 9.3c.8.9 1.6.9 2.4 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 3h9a2 2 0 0 1 2 2v13.5a2.5 2.5 0 0 0 2.5 2.5H8.5A2.5 2.5 0 0 1 6 18.5V5" />
      <path d="M6 3h1" />
      <path d="M9.5 8h5.5M9.5 11.5h5.5M9.5 15h3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.2" />
      <path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4" />
      <path d="M12 14v2.4" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.4 21.2 20H2.8z" />
      <path d="M12 9.4v5" />
      <circle cx="12" cy="17.4" r="0.95" fill="currentColor" stroke="none" />
    </>
  ),
  signal: (
    <>
      <circle cx="12" cy="11" r="2" />
      <path d="M9.4 8.4a3.7 3.7 0 0 0 0 5.2M14.6 8.4a3.7 3.7 0 0 1 0 5.2" />
      <path d="M6.9 5.9a7.2 7.2 0 0 0 0 10.2M17.1 5.9a7.2 7.2 0 0 1 0 10.2" />
      <path d="M12 13v7.4" />
    </>
  ),
  crown: (
    <>
      <path d="M4 8.4l3.6 3.1L12 5l4.4 6.5L20 8.4l-1.6 10.1H5.6z" />
      <path d="M5.6 18.5h12.8" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 9.4v5.2" />
    </>
  ),
  chest: (
    <>
      <path d="M4 10.2A8 8 0 0 1 20 10.2" />
      <rect x="4" y="10.2" width="16" height="10" rx="2.2" />
      <path d="M4 14.2h16" />
      <rect x="10.4" y="12.2" width="3.2" height="4" rx="0.7" />
    </>
  ),
  ship: (
    <>
      <path d="M3 17.4h18l-2.6 3.6H5.6z" />
      <path d="M12 3v14.4" />
      <path d="M12 4.6 18.4 12H12z" />
      <path d="M11 7 6 12h5z" />
    </>
  ),
  chart: (
    <>
      <path d="M3.6 20.4h16.8" />
      <rect x="5.4" y="11.6" width="3.2" height="6.4" rx="0.7" />
      <rect x="10.4" y="7.4" width="3.2" height="10.6" rx="0.7" />
      <rect x="15.4" y="13.6" width="3.2" height="4.4" rx="0.7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.2" />
      <path d="M3.6 10.2h16.8M8.2 3.2v4M15.8 3.2v4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.2s7-6.4 7-11.2a7 7 0 1 0-14 0c0 4.8 7 11.2 7 11.2z" />
      <circle cx="12" cy="9.8" r="2.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9.2" cy="8.2" r="3.3" />
      <path d="M3.4 19.6a5.8 5.8 0 0 1 11.6 0" />
      <path d="M16.2 5.4a3.3 3.3 0 0 1 0 6.6" />
      <path d="M17.2 14.4a5.8 5.8 0 0 1 3.4 5.2" />
    </>
  ),
  close: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
  menu: <path d="M3.8 7h16.4M3.8 12h16.4M3.8 17h16.4" />,
  undo: (
    <>
      <path d="M9 5 4.4 9.6 9 14.2" />
      <path d="M4.4 9.6H14a5.6 5.6 0 0 1 0 11.2H9.4" />
    </>
  ),
  play: <path d="M7.2 4.6 19.2 12 7.2 19.4z" />,
  pause: (
    <>
      <rect x="6.8" y="5" width="3.6" height="14" rx="1.1" />
      <rect x="13.6" y="5" width="3.6" height="14" rx="1.1" />
    </>
  ),
  chevronLeft: <path d="M14.6 4.8 7.4 12l7.2 7.2" />,
  chevronRight: <path d="M9.4 4.8 16.6 12l-7.2 7.2" />,
  arrowUp: <path d="M12 19.2V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 4.8V19M6 13l6 6 6-6" />,
  minus: <path d="M6 12h12" />,
  dot: <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />,
  star: <path d="M12 3.4 14.7 9l6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1L3.2 9.9 9.3 9z" />,
  gull: (
    <>
      <path d="M2.5 12.4c3-2.6 5.4-2.6 8 0" />
      <path d="M13.5 12.4c2.6-2.6 5-2.6 8 0" />
      <path d="M10.5 12.4h3" />
    </>
  ),
};

/**
 * Tailwind's preflight sets `svg { display: block }`, which makes icons ignore
 * `text-align` in table cells and headings. `inline-block` keeps them flow
 * content so centring works everywhere; callers can still override via
 * `className` (e.g. `block`, `mx-auto`).
 */
const ICON_BASE = "inline-block shrink-0 align-middle";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Provide to expose the icon to assistive tech; omit for decorative use. */
  title?: string;
}

export function Icon({ name, size = 20, className, strokeWidth = 1.7, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`${ICON_BASE} ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Medals — colour + shape, never colour alone (accessible for the
 * look-alike crews: a gold/silver/bronze ring, dot and label differ).
 * ------------------------------------------------------------------ */

export type MedalKind = "gold" | "silver" | "bronze";

const MEDAL_FILL: Record<MedalKind, { face: string; ring: string; ribbon: string }> = {
  gold: { face: "#F8D13D", ring: "#8a6300", ribbon: "#C0392B" },
  silver: { face: "#D5DCE4", ring: "#5a6472", ribbon: "#3F6FA8" },
  bronze: { face: "#D08A45", ring: "#6f4420", ribbon: "#6B4A2B" },
};

export function MedalIcon({
  kind,
  size = 18,
  className,
  title,
}: {
  kind: MedalKind;
  size?: number;
  className?: string;
  title?: string;
}) {
  const c = MEDAL_FILL[kind];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`${ICON_BASE} ${className ?? ""}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d="M8 2.4 10.6 9M16 2.4 13.4 9" stroke={c.ribbon} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="14.8" r="5.6" fill={c.face} stroke={c.ring} strokeWidth="1.2" />
      {/* distinct centre glyph per medal so shape differs, not just colour */}
      {kind === "gold" && <path d="M12 12.2l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill={c.ring} stroke="none" />}
      {kind === "silver" && <circle cx="12" cy="14.8" r="2.1" fill="none" stroke={c.ring} strokeWidth="1.2" />}
      {kind === "bronze" && <path d="M12 12.9v3.8M10.6 14.8h2.8" stroke={c.ring} strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

/** Inline medal count, e.g. "12 gold" — icon plus a screen-reader label. */
export function MedalCount({
  kind,
  value,
  size = 16,
  className,
}: {
  kind: MedalKind;
  value: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <MedalIcon kind={kind} size={size} />
      <span className="sr-only">{kind} medals: </span>
      <span>{value}</span>
    </span>
  );
}
