/**
 * Normalises the provided mascot logos.
 *
 *   logos/originals/*.jpg   (untouched source of truth)
 *        ↓
 *   public/logos/<id>/64|128|256|512.webp   (primary, served to browsers)
 *   public/logos/<id>/fallback.jpg          (256px JPG for old browsers)
 *   public/logos/<id>/share.jpg             (1200x630 social / TV card)
 *   logos/logos.manifest.json               (dominant colours + metadata)
 *
 * Run:  npm run optimize-logos
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { TEAMS } from "../src/lib/data/seed";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "logos", "originals");
const OUT = path.join(ROOT, "public", "logos");
const WEBP_SIZES = [64, 128, 256, 512];

interface Manifest {
  [id: string]: {
    dominant: string;
    accent: string;
    width: number;
    height: number;
    source: string;
    mascot: string;
  };
}

/** "FACET icon.jpg" → "faceticonjpg" so we can fuzzy-match to the team id. */
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  const files = await readdir(SRC);
  const manifest: Manifest = {};

  await mkdir(OUT, { recursive: true });

  for (const team of TEAMS) {
    const match = files.find((f) => normalize(f).startsWith(team.id));
    if (!match) {
      console.warn(`⚠  No source logo found for "${team.id}" — falling back to initials in the UI.`);
      continue;
    }

    const srcPath = path.join(SRC, match);
    const destDir = path.join(OUT, team.id);
    await mkdir(destDir, { recursive: true });

    const image = sharp(srcPath).rotate();
    const meta = await image.metadata();
    if (meta.width !== meta.height) {
      console.warn(`⚠  ${match} is ${meta.width}x${meta.height} (not square) — it will be centre-cropped.`);
    }

    // dominant colour (from a tiny resize — cheap and stable)
    const { dominant } = await sharp(srcPath).rotate().resize(16, 16, { fit: "cover" }).stats()
      .then((s) => ({ dominant: rgbToHex(s.channels[0].mean, s.channels[1].mean, s.channels[2].mean) }))
      .catch(() => ({ dominant: team.color }));

    for (const size of WEBP_SIZES) {
      await sharp(srcPath)
        .rotate()
        .resize(size, size, { fit: "cover", position: "centre" })
        .webp({ quality: 84, effort: 5 })
        .toFile(path.join(destDir, `${size}.webp`));
    }

    await sharp(srcPath)
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(destDir, "fallback.jpg"));

    await makeShareImage(srcPath, path.join(destDir, "share.jpg"), team.name, team.shortName, team.mascot, team.color);

    manifest[team.id] = {
      dominant,
      accent: team.color,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      source: match,
      mascot: team.mascot,
    };

    console.log(`✔ ${team.id.padEnd(9)} ← ${match.padEnd(18)} dominant ${dominant} · accent ${team.color}`);
  }

  await writeFile(
    path.join(ROOT, "logos", "logos.manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log(`\nWrote ${Object.keys(manifest).length} crews → public/logos/ and logos/logos.manifest.json`);
}

/** 1200x630 share card: accent-tinted navy panel with the crest centred. */
async function makeShareImage(
  src: string,
  dest: string,
  name: string,
  shortName: string,
  mascot: string,
  color: string,
) {
  const crest = await sharp(src).rotate().resize(360, 360, { fit: "cover" }).png().toBuffer();
  const bg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#071426"/>
        <stop offset="1" stop-color="#0d2740"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <rect x="0" y="0" width="1200" height="14" fill="${color}"/>
    <circle cx="600" cy="250" r="210" fill="${color}" opacity="0.16"/>
    <text x="600" y="540" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="bold" fill="#f4e5c6">${escapeXml(shortName)}</text>
    <text x="600" y="592" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#8fd6ef">${escapeXml(name)} · The ${escapeXml(mascot)}</text>
  </svg>`);

  await sharp(bg)
    .composite([{ input: crest, top: 70, left: 420 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(dest);
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
