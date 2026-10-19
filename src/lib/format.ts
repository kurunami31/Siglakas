/** Every point earned is displayed as a bounty, e.g. 10 pts → ฿ 1,000,000. */
export const BOUNTY_PER_POINT = 100_000;

export function bountyValue(points: number): number {
  return Math.round(points * BOUNTY_PER_POINT);
}

export function formatBounty(points: number): string {
  return `฿ ${bountyValue(points).toLocaleString("en-US")}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function medalOrdinal(n: number): string {
  return ordinal(n);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Convert "#aabbcc" → "170 187 204" so we can use rgb(var(--x) / alpha). */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return "255 255 255";
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/** Perceived luminance (0=black, 1=white) — used to keep text readable. */
export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return 0;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two hex colours (1..21), for accessibility checks. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** True when a bright accent needs dark text on top of it. */
export function prefersDarkText(hex: string): boolean {
  return luminance(hex) > 0.45;
}

/** The navy the app paints behind every crew accent (`--color-ink`). */
export const PANEL_INK = "#071426";

/** Non-text UI (borders, bars, swatches) needs 3:1 — WCAG 2.2 SC 1.4.11. */
const ACCENT_MIN_CONTRAST = 3;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function toRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** "#aabbcc" → [hue 0..360, saturation 0..1, lightness 0..1]. */
export function hexToHsl(hex: string): [number, number, number] {
  const [r255, g255, b255] = toRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  // Grey has no meaningful hue, and `d === 0` would divide by zero below.
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor((((h % 360) + 360) % 360) / 60);
  const [r, g, b] =
    seg === 0 ? [c, x, 0]
    : seg === 1 ? [x, c, 0]
    : seg === 2 ? [0, c, x]
    : seg === 3 ? [0, x, c]
    : seg === 4 ? [x, 0, c]
    : [c, 0, x];
  const byte = (v: number) => Math.round(Math.max(0, Math.min(1, v + m)) * 255);
  return `#${[byte(r), byte(g), byte(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The colour to actually PAINT with, given a crew's official accent.
 *
 * The crews' real colours come from the festival's identity sheet, and a few of
 * them were never meant to be seen as a 2px line on a dark navy panel: FTED is
 * a deep blue (`#1a22a8`), CEC a near-black blue (`#080d61`) and TARRAGONA
 * plain black. Drawn as-is they simply vanish into the background.
 *
 * So: keep the hue and the saturation, and walk the lightness up only as far as
 * it takes to clear 3:1 against the panel. A colour that already reads comes
 * back byte-for-byte, and the stored value is never modified — this is a display
 * concern only, so the admin grid and the spreadsheet keep the official hex.
 */
export function accentFor(hex: string): string {
  if (!HEX.test(hex)) return hex;
  if (contrastRatio(hex, PANEL_INK) >= ACCENT_MIN_CONTRAST) return hex;
  const [h, s, l] = hexToHsl(hex);
  for (let step = l + 0.01; step < 1; step += 0.01) {
    const candidate = hslToHex(h, s, step);
    if (contrastRatio(candidate, PANEL_INK) >= ACCENT_MIN_CONTRAST) return candidate;
  }
  return hslToHex(h, s, 1);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
