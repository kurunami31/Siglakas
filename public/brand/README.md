# Brand assets

The site's logo is the **official SIGLAKAS 2026 festival mark** (ship's wheel,
compass, torch, book, oars, waves and the skull over a pile of coins).

## Where the files come from

The master artwork is a 3072×3072, ~11 MB PNG. That is far too heavy to serve,
so it is **not** committed (see the `/Official Logo.png` entry in `.gitignore`)
and only the generated copies live in the repository:

| File | Size | Used for |
| --- | --- | --- |
| `src/app/icon.png` | 96×96 | browser tab favicon (Next.js file convention) |
| `src/app/apple-icon.png` | 180×180 | iOS home-screen icon |
| `public/brand/siglakas-logo.png` | 512×512 | the mark in the site header |
| `public/brand/siglakas-logo-1024.png` | 1024×1024 | social / OpenGraph preview card |

## Regenerating

Put the master somewhere outside version control and point the script at it:

```bash
npm run build-brand -- "Official Logo.png"
```

The script uses `sharp` (a dev dependency) to resize and re-encode. Commit the
generated files, never the master.

## Displaying it

The artwork is circular on a white background, so it is shown as a **white disc**
(`rounded-full` + `object-cover`) rather than masked — cropping it to a circle
would cut into the rope ring. Do not recolour or redraw it: it is the official
festival identity, not decoration.
