/**
 * Builds the web-ready brand assets from the official SIGLAKAS festival logo.
 *
 *   npm run build-brand -- "Official Logo.png"
 *
 * The master artwork is a 3072x3072, ~11MB PNG — far too heavy to ship. This
 * writes the downsized copies the site actually uses. The master is deliberately
 * NOT committed (see `.gitignore`); keep it outside version control and re-run
 * this whenever it changes.
 *
 * Outputs:
 *   src/app/icon.png                    browser favicon
 *   src/app/apple-icon.png              iOS home-screen icon
 *   public/brand/siglakas-logo.png      the mark used in the site header
 *   public/brand/siglakas-logo-1024.png social/OpenGraph card
 */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2] ?? "Official Logo.png";

const OUTPUTS: Array<{ to: string; size: number }> = [
  { to: "src/app/icon.png", size: 96 },
  { to: "src/app/apple-icon.png", size: 180 },
  { to: "public/brand/siglakas-logo.png", size: 512 },
  { to: "public/brand/siglakas-logo-1024.png", size: 1024 },
];

const kb = (n: number) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  const info = await stat(source).catch(() => null);
  if (!info) {
    console.error(`\n  x "${source}" not found. Pass the master artwork path:\n`);
    console.error('      npm run build-brand -- "Official Logo.png"\n');
    process.exit(1);
  }

  const meta = await sharp(source).metadata();
  console.log("\n  Grand Line Tally - brand assets");
  console.log("  -------------------------------");
  console.log(`  source      : ${source} (${meta.width}x${meta.height}, ${kb(info.size)})`);
  console.log("");

  for (const { to, size } of OUTPUTS) {
    await mkdir(path.dirname(to), { recursive: true });
    await sharp(source)
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(to);
    const out = await stat(to);
    console.log(`  wrote       : ${to.padEnd(38)} ${size}x${size}  ${kb(out.size)}`);
  }

  console.log("\n  done. Commit the generated files, not the master.\n");
}

void main().catch((err) => {
  console.error("\n  x build-brand failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
