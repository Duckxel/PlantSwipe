#!/usr/bin/env node
// Patch the upstream Aphydle clone to use Aphylia/PlantSwipe branding.
//
// Why this exists:
//   - Aphydle ships no favicon, so the browser's automatic /favicon.ico fetch
//     404s in the console.
//   - Its in-app brand mark is a CSS-grid mosaic leaf (`MosaicLeaf`) and we
//     want every Aphylia surface to wear the same plant icon for consistency
//     while Aphydle doesn't yet have its own art direction.
//
// What this does:
//   - Inserts `<link rel="icon">` tags into Aphydle's `index.html` pointing
//     at the PlantSwipe icons that scripts/refresh-aphydle.sh copies into
//     dist/icons/ post-build.
//   - Rewrites `src/components/ui/MosaicLeaf.jsx` so every callsite renders
//     the PlantSwipe icon SVG instead of the procedural mosaic.
//   - Idempotent (skip if marker present), and fails loudly if the upstream
//     source no longer matches, so a future refactor can't silently regress.
//
// Invoked from scripts/refresh-aphydle.sh between `git pull` and `bun install`.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const APHYDLE_DIR = process.argv[2] || process.env.APHYDLE_DIR;
if (!APHYDLE_DIR) {
  console.error("[aphydle-branding] APHYDLE_DIR not provided (argv[2] or env)");
  process.exit(2);
}

const MARKER = "__APHYLIA_BRANDING_PATCH__";

// ── 1. Inject favicon links into index.html ──────────────────────────────────
const INDEX_PATH = resolve(APHYDLE_DIR, "index.html");
let indexHtml;
try {
  indexHtml = readFileSync(INDEX_PATH, "utf8");
} catch (err) {
  console.error(`[aphydle-branding] cannot read ${INDEX_PATH}: ${err.message}`);
  process.exit(1);
}

if (indexHtml.includes(MARKER)) {
  console.log(`[aphydle-branding] ${INDEX_PATH} already patched — skipping`);
} else {
  if (!indexHtml.includes("</head>")) {
    console.error(`[aphydle-branding] ${INDEX_PATH} has no </head> tag — refusing to patch`);
    process.exit(1);
  }
  const FAVICON_BLOCK = `    <!-- ${MARKER}: branding sourced from Aphylia/PlantSwipe; files copied into dist/icons/ post-build by scripts/refresh-aphydle.sh -->
    <link rel="icon" type="image/svg+xml" href="/icons/plant-swipe-icon.svg" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
  </head>`;
  indexHtml = indexHtml.replace("</head>", FAVICON_BLOCK);
  writeFileSync(INDEX_PATH, indexHtml);
  console.log(`[aphydle-branding] patched ${INDEX_PATH}`);
}

// ── 2. Replace MosaicLeaf with the Aphylia logo image ───────────────────────
const LEAF_PATH = resolve(APHYDLE_DIR, "src/components/ui/MosaicLeaf.jsx");
let leafSrc;
try {
  leafSrc = readFileSync(LEAF_PATH, "utf8");
} catch (err) {
  console.error(`[aphydle-branding] cannot read ${LEAF_PATH}: ${err.message}`);
  process.exit(1);
}

if (leafSrc.includes(MARKER)) {
  console.log(`[aphydle-branding] ${LEAF_PATH} already patched — skipping`);
} else {
  // Pin against the upstream signature so a meaningful refactor (e.g. someone
  // renames the component or changes its prop shape) trips this script
  // instead of silently leaving the Aphylia logo behind.
  if (!/export\s+function\s+MosaicLeaf\s*\(/.test(leafSrc)) {
    console.error(
      `[aphydle-branding] FAILED: MosaicLeaf export not found in ${LEAF_PATH}. ` +
        `Aphydle upstream has changed; update scripts/aphydle-patch-branding.mjs ` +
        `before running refresh-aphydle.sh again.`,
    );
    process.exit(1);
  }
  const REPLACEMENT = `// ${MARKER}: rendered as the Aphylia/PlantSwipe icon so Aphydle and its host
// share the same brand mark. The original procedural mosaic-leaf renderer
// lives in git history if a standalone Aphydle ever needs it back.
export function MosaicLeaf({ size = 22 }) {
  const px = typeof size === "number" ? \`\${size}px\` : size;
  return (
    <img
      src="/icons/plant-swipe-icon.svg"
      alt="Aphylia"
      width={size}
      height={size}
      style={{
        width: px,
        height: px,
        display: "block",
        objectFit: "contain",
        userSelect: "none",
        pointerEvents: "none",
      }}
      draggable={false}
    />
  );
}
`;
  writeFileSync(LEAF_PATH, REPLACEMENT);
  console.log(`[aphydle-branding] patched ${LEAF_PATH}`);
}
