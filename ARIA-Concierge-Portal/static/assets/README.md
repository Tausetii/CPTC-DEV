# Alysa Assets

Drop an image file here named **`alysa.png`** to use as the AI concierge's avatar
across the site (the hero "Meet Alysa" card and the `/orbit-chat` chat header).

Accepted:
- `alysa.png` (preferred — transparent background works best)
- Any square aspect ratio looks best; non-square will be cropped to a circle
- Recommended size: **256×256 or larger**

Other formats also work if you change the `image` prop on `<OrbItAvatar />`:
- `/assets/alysa.jpg`
- `/assets/alysa.webp`
- `/assets/alysa.svg`

If no file is present (or the path 404s) the component automatically falls back
to the generated cosmic orb. No code changes required.

## How it's served

SvelteKit serves everything under `static/` at the URL root, so a file at
`static/assets/alysa.png` is available at `https://<host>/assets/alysa.png`.

The avatar component (`src/lib/components/OrbItAvatar.svelte`) defaults to
loading `/assets/alysa.png` and gracefully falls back on error.
