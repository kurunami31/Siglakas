# Crew logos

These are the official mascot logos and the real identity of each crew. **Never
remove, recolour, crop or redraw the artwork.** Display them as square badges in
a frame tinted with the crew's accent colour.

## Layout

```
logos/originals/     ← untouched source files (never edited, never served)
logos/logos.manifest.json   ← generated: dominant colour + metadata per crew
public/logos/<id>/   ← generated, served to browsers
```

`logos/originals/` is the **source of truth**. Everything under `public/logos/`
is generated — delete and regenerate it freely.

## Naming rules

Source filenames are normalised to the crew's lowercase `id`:

| Source file | Crew id | Notes |
|---|---|---|
| `FTED.jpg` | `fted` | |
| `FACET icon.jpg` | `facet` | spaces / suffixes are stripped |
| `FAHUSCIC.jpg` | `fahuscic` | |
| `FALS.jpg` | `fals` | |
| `FBM.jpg` | `fbm` | |
| `FCJE.jpg` | `fcje` | |
| `FNAHS.jpg` | `fnahs` | |
| `SIEC.jpg` | `siec` | |
| `TEC.jpg` | `tec` | |
| `BEC.jpg` | `bec` | |
| `BGEC.jpg` | `bgec` | |
| `CEC.jpg` | `cec` | |

Matching is fuzzy: the script lowercases the filename, strips every
non-alphanumeric character, and looks for a prefix equal to the crew id. So
`FACET icon.jpg` → `faceticonjpg` → matches `facet`. Add a new crew by dropping
a file named after its id (e.g. `newcampus.jpg`) into `logos/originals/` **and**
adding the crew to `src/lib/data/seed.ts`.

## Recommended dimensions & formats

- **Minimum:** 512 × 512 px, square, 1:1.
- **Ideal source:** 1000–3000 px square. Current sources are 2970 × 2970.
- **Format:** JPG, PNG, WebP or SVG. Solid backgrounds are fine (and expected).
- Keep the subject **centred with padding** — the frames crop to a centred square.
- Non-square sources are centre-cropped by the generator (a warning is printed).

## Generate the assets

```bash
npm run optimize-logos
```

Produces, for every crew:

| File | Purpose |
|---|---|
| `64.webp`, `128.webp`, `256.webp`, `512.webp` | primary images (WebP, quality 84) |
| `fallback.jpg` | 256 px JPG for browsers without WebP |
| `share.jpg` | 1200 × 630 social / TV card |
| `logos/logos.manifest.json` | dominant colour, dimensions, source filename |

## How the app uses them

`<TeamBadge>` is the single component that renders a logo and is used in the
bounty board, medal tally, island cards, event rankings, crew profiles, sports
standings, brackets, live scoreboards, TV mode, the Crew Parade and share cards.

- Rendered with `next/image` (`object-fit: cover` on a 1:1 box), lazy-loaded,
  explicit `width`/`height`, and descriptive alt text
  (e.g. _"FBM mascot logo: Yellow Eagle"_).
- Framed with a 2 px border in the crew accent colour plus a soft glow.
- **Fallback:** if the file is missing or fails to load, the badge shows the crew
  initials on an accent-coloured background — no broken images, ever.
- Text is never placed directly on a logo; the artwork always sits on a navy or
  parchment panel so bright crests (FBM yellow, SIEC pale yellow, FNAHS gold,
  FAHUSCIC cyan) stay readable.

## Look-alike crews

`FBM` (bright yellow), `FNAHS` (gold) and `SIEC` (pale yellow) — and `BEC`
(dark red) vs `FCJE` (red) — must never be distinguishable by colour alone.
Charts use dashed lines and different marker shapes, and **every** logo is
labelled with the crew `short_name`.

## Third-party / copyright

The mascot artwork is supplied by the school and belongs to the respective
faculties and campuses. All decorative pirate motifs on the site (waves, ships,
compasses, chests, banners) are original CSS/SVG created for this project.
