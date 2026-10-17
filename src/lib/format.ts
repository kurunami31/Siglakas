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

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
