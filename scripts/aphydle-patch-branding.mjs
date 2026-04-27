#!/usr/bin/env node
// Patch the upstream Aphydle clone to wire the Aphylia/PlantSwipe brand mark
// into the favicon and the in-app logo.
//
// Why this exists:
//   - Aphydle's upstream `index.html` ships no favicon, so the browser's
//     automatic /favicon.ico fetch 404s in the console.
//   - Its in-app brand mark is a procedural CSS-grid mosaic leaf
//     (`MosaicLeaf`) and we want every Aphylia surface to wear the same
//     plant icon while Aphydle doesn't yet have its own art direction.
//
// What this does:
//   - Inserts a `<link rel="icon">` into Aphydle's `index.html` pointing at
//     `src/assets/FINAL.png`. The path is relative so Vite picks it up
//     during build, hashes it, and emits a content-addressed asset URL.
//   - Rewrites `src/components/ui/MosaicLeaf.jsx` so every callsite renders
//     the same PNG via an ES-module import, again letting Vite hash and
//     cache-bust the asset.
//   - Idempotent (skip if marker present), and fails loudly if upstream
//     Aphydle removes the assets or the MosaicLeaf export so a future
//     refactor can't silently regress the branding.
//
// Invoked from scripts/refresh-aphydle.sh between `git pull` and `bun install`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const APHYDLE_DIR = process.argv[2] || process.env.APHYDLE_DIR;
if (!APHYDLE_DIR) {
  console.error("[aphydle-branding] APHYDLE_DIR not provided (argv[2] or env)");
  process.exit(2);
}

const MARKER = "__APHYLIA_BRANDING_PATCH__";

// Aphydle ships the brand PNG at src/assets/FINAL.png. Bail loudly if it's
// missing — the patch would otherwise build a bundle that 404s every icon.
const ASSET_REL = "src/assets/FINAL.png";
const ASSET_ABS = resolve(APHYDLE_DIR, ASSET_REL);
if (!existsSync(ASSET_ABS)) {
  console.error(
    `[aphydle-branding] FAILED: ${ASSET_ABS} is missing. Update Aphydle ` +
      `upstream so the brand asset exists, or change the path in ` +
      `scripts/aphydle-patch-branding.mjs.`,
  );
  process.exit(1);
}

// ── 1. Inject favicon link into index.html ──────────────────────────────────
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
  // Relative path → Vite hashes the asset and rewrites href= to the emitted
  // /assets/<hash>.png. Absolute /src/assets/... would bypass Vite asset
  // handling and 404 in production.
  const FAVICON_BLOCK = `    <!-- ${MARKER}: brand icon shared with Aphylia/PlantSwipe; Vite hashes and emits this on build -->
    <link rel="icon" type="image/png" href="./${ASSET_REL}" />
    <link rel="apple-touch-icon" href="./${ASSET_REL}" />
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
  // Import path is relative to src/components/ui/MosaicLeaf.jsx
  // (i.e. ../../assets/FINAL.png).
  const REPLACEMENT = `// ${MARKER}: rendered as the shared Aphylia/PlantSwipe brand mark so Aphydle
// and its host wear the same icon. The original procedural mosaic-leaf
// renderer lives in git history if a standalone Aphydle ever needs it back.
import aphyliaIcon from "../../assets/FINAL.png";

export function MosaicLeaf({ size = 22 }) {
  const px = typeof size === "number" ? \`\${size}px\` : size;
  return (
    <img
      src={aphyliaIcon}
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
