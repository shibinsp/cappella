# Cappella Website

A pixel-accurate replication of the Cappella landing page, reproduced from the Figma design file `cappella.fig` (page "Frame 4", 1544 × 8372 px).

Cappella is India's leading Edu-Infra Asset Management Company, and this project rebuilds its marketing landing page as a static, self-contained web page.

## Project structure

| Path | Description |
|------|-------------|
| `Cappella Website.html` | Fully self-contained build of the page (all assets inlined). |
| `Cappella Website.dc.html` | The page as a Design Component — mounts the materialized Figma frame and scales it to fit the screen. |
| `components/Components.bundle.js` | The materialized Figma frame (`Frame4`), pre-transpiled plain JS exposed as `window.Frame4`. |
| `components/Components.d.ts` | Type declarations for the component bundle. |
| `components/fig-assets.css` | Background/mask classes for every image asset. |
| `components/assets/` | Real bitmaps (logos, photos) referenced by the page. |
| `uploads/` | Source images exported from the Figma file. |
| `screenshots/` | Progress and QA screenshots taken during replication. |
| `support.js` | Runtime support script. |
| `rules.md` | Build & CSS conventions used during replication — read this before editing. |

## How it works

- The design is a **fixed 1544 px wide** absolute-positioned canvas. Individual elements are not responsive; instead the whole frame is scaled with `transform: scale(viewportWidth / 1457)`, with the wrapper height adjusted so scrolling still works.
- Content bounds are **1457 × 7821 px** (the design's real edges); the scaler is cropped to these so no extra white space appears on the right or below the footer.
- A global text rule forces long copy to wrap instead of clipping (`white-space: normal !important` on text elements inside `#cap-scaler`).

## Design system

- **Typeface:** Montserrat (weights 300–800)
- **Brand red:** `#D1202F`
- Hero heading: 100 px / 600 · Section headings: 55 px / 800 · Stat numbers: 60 px / 600 · Body copy: 24 px / 300

## Viewing

Open `Cappella Website.html` directly in a browser — no build step or server required.

## Editing

Follow the conventions in [`rules.md`](rules.md):

- Copy values verbatim from the Figma **Inspect** panel — never round or snap to a grid.
- Edit typography/positions in `components/Components.bundle.js`.
- Reference real bitmaps from `components/assets/`; never redraw a logo or photo as an SVG placeholder.
- Let long text blocks wrap — never add `white-space: nowrap`.
