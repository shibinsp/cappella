// Components.d.ts — the complete catalog of the 1 component(s) in
// Components.bundle.js. READ THIS FILE BEFORE USING THE BUNDLE: component
// names are derived from Figma layer names (sanitized to PascalCase,
// deduplicated) and may differ from what the design calls them — the
// "figma layer" comment above each interface maps them back.
// After the bundle <script> loads, every component is a window global
// (e.g. window.Frame4) and usable directly in JSX.
import * as React from 'react';

// figma layer: "Frame 4" (node 13:11)
export interface Frame4Props {
  className?: string;
  style?: React.CSSProperties;
}

declare const Frame4: React.FC<Frame4Props>;
declare global {
  interface Window {
    Frame4: React.FC<Frame4Props>;
  }
}
