# Cappella Website — Build & CSS Rules

This document records the conventions used when reproducing the Cappella
landing page from Figma, so future edits stay consistent.

## Source of truth
- The design comes from the Figma file `cappella.fig` (page "Frame 4",
  1544 × 8372 px). The exact node values in the Figma **Inspect** panel
  (font-size, font-weight, line-height, width/height, color) are authoritative.
  Copy them verbatim — never round or snap to an 8px grid.

## Project structure
- `index.html` — the page (a Design Component). It mounts the
  materialized Figma frame and scales it to fit the screen.
- `components/Components.bundle.js` — the materialized Figma frame (`Frame4`),
  pre-transpiled plain JS exposed as `window.Frame4`.
- `components/fig-assets.css` — background/mask classes for every image asset.
- `components/assets/` — the real bitmaps (logos, photos). Reference these
  verbatim; never redraw a logo/photo as an SVG placeholder.

## Layout / scaling rules
- The frame is a **fixed 1544 px wide** absolute-positioned canvas. Do not try
  to make individual elements responsive — instead the whole frame is scaled
  with `transform: scale(viewportWidth / 1457)` (see the logic class), and the
  wrapper height is set so scrolling still works.
- Content bounds are **1457 px wide × 7821 px tall** (the design's real edges).
  The scaler is cropped to these so there is no extra white space on the right
  or below the footer.

## Global text rule (IMPORTANT)
Several Figma text layers were authored with `white-space: nowrap` inside a
fixed-width box. On a scaled/narrower render this makes long copy overflow and
get clipped at the crop edge. To prevent this everywhere, `index.html`
carries a global rule in its `<helmet><style>`:

```css
#cap-scaler span,
#cap-scaler p,
#cap-scaler h1,
#cap-scaler h2,
#cap-scaler h3 {
  white-space: normal !important;   /* wrap instead of clipping */
  overflow-wrap: normal;            /* wrap only at spaces — never split a word/number */
  word-break: normal;
  text-wrap: pretty;
}
```

Rule of thumb: **long sentences must wrap inside their box; never `nowrap`.**
Short labels, headings, and stat numbers still fit on one line naturally, so
this rule is safe for them.

## Typography (from Figma Inspect)
- Primary typeface: **Montserrat** (300 / 400 / 500 / 600 / 700 / 800).
- Hero heading: 100 px, weight 600, three lines
  ("India's Leading" / "Edu-Infra Asset" / "Management Company").
- Section headings ("Our Journey", "Operators", "The Cappella Edge"): 55 px, 800.
- Stat numbers ($500 Mn+, 135 Acres, 16 Assets, 75 Years+): 60 px, weight 600.
- Stat captions (AUM, Total Land Area, …): 24 px, weight 400.
- Body / description copy: 24 px, weight 300, line-height ~123%.
- Footer address: 16 px, weight 500, line-height 25 px, **text-transform: uppercase**.
- Footer labels (email, "Connect with us", "Designed by"): uppercase.

## Colors
- Brand red: `rgb(209, 32, 47)` (#D1202F)
- White: `rgb(255, 255, 255)`
- Black text: `rgb(0, 0, 0)`
- Footer red band + accents use the same brand red.

## Editing conventions
- Edit typography/positions in `components/Components.bundle.js` (the frame),
  matching the Figma Inspect values exactly.
- Keep `text-transform: uppercase` on footer copy that Figma marks uppercase.
- When adding a new long text block, let it wrap (the global rule handles this);
  do not add `white-space: nowrap`.
