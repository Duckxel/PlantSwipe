#!/usr/bin/env node
// Patch the upstream Aphydle clone so image URLs from `plant_images.link` are
// fetched through PlantSwipe's CORS-enabled image proxy.
//
// Why this exists:
//   - Aphydle (a separate repo at github.com/Duckxel/Aphydle) talks to Supabase
//     directly and renders `plant_images.link` URLs into a <canvas> via
//     `img.crossOrigin = "anonymous"` (see Aphydle's PlantImage.jsx).
//   - Many of those links point at third-party hosts (e.g.
//     img.passeportsante.net) that don't send Access-Control-Allow-Origin,
//     so the browser blocks the load with a CORS error and the puzzle image
//     never appears.
//   - PlantSwipe already exposes /api/image-proxy?url=<encoded> with permissive
//     CORS headers (see plant-swipe/server.js). The previous attempt at fixing
//     this only rewrote URLs in /api/plants responses, but Aphydle never calls
//     that endpoint — it queries Supabase directly — so the fix never reached
//     it.
//
// What this does:
//   - Edits Aphydle's `src/lib/data.js` to make `pickImage()` route every URL
//     it returns through `/api/image-proxy`, except hosts that already serve
//     correct CORS (aphylia.app and *.supabase.co).
//   - Idempotent: re-running on an already-patched file is a no-op.
//   - Fails loudly if the function shape we depend on isn't present, so an
//     upstream rename or refactor doesn't silently regress the fix.
//
// Invoked from scripts/refresh-aphydle.sh between `git pull` and `bun install`.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const APHYDLE_DIR = process.argv[2] || process.env.APHYDLE_DIR;
if (!APHYDLE_DIR) {
  console.error("[aphydle-patch] APHYDLE_DIR not provided (argv[2] or env)");
  process.exit(2);
}

const TARGET = resolve(APHYDLE_DIR, "src/lib/data.js");
const MARKER = "__APHYLIA_IMAGE_PROXY_PATCH__";

let src;
try {
  src = readFileSync(TARGET, "utf8");
} catch (err) {
  console.error(`[aphydle-patch] cannot read ${TARGET}: ${err.message}`);
  process.exit(1);
}

if (src.includes(MARKER)) {
  console.log(`[aphydle-patch] ${TARGET} already patched — nothing to do`);
  process.exit(0);
}

// Match the original pickImage definition. We pin against the exact upstream
// body so a meaningful rename (e.g. someone changes the use-list ordering)
// fails this script instead of letting the CORS regression slip through.
const ORIGINAL = `function pickImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  for (const use of ["card", "cover", "hero", "thumbnail"]) {
    const m = images.find((i) => i?.use === use && i?.link);
    if (m) return m.link;
  }
  return images.find((i) => i?.link)?.link || null;
}`;

const REPLACEMENT = `function pickImage(images) {
  // ${MARKER}: route third-party plant_images.link URLs through PlantSwipe's
  // CORS-enabled /api/image-proxy so <img crossOrigin="anonymous"> succeeds on
  // hosts that don't send Access-Control-Allow-Origin (e.g. passeportsante).
  // Hosts that already serve correct CORS pass through untouched.
  const _aphyliaWrap = (u) => {
    if (!u || typeof u !== "string") return u;
    let host;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return u;
      host = parsed.hostname.toLowerCase();
    } catch {
      return u;
    }
    if (
      host === "aphylia.app" ||
      host.endsWith(".aphylia.app") ||
      host.endsWith(".supabase.co")
    ) {
      return u;
    }
    const base = (import.meta.env.VITE_APHYLIA_API_URL || "https://aphylia.app").replace(/\\/+$/, "");
    return base + "/api/image-proxy?url=" + encodeURIComponent(u);
  };
  if (!Array.isArray(images) || images.length === 0) return null;
  for (const use of ["card", "cover", "hero", "thumbnail"]) {
    const m = images.find((i) => i?.use === use && i?.link);
    if (m) return _aphyliaWrap(m.link);
  }
  return _aphyliaWrap(images.find((i) => i?.link)?.link || null);
}`;

if (!src.includes(ORIGINAL)) {
  console.error(
    `[aphydle-patch] FAILED: pickImage() in ${TARGET} no longer matches the ` +
      `expected upstream shape. The Aphydle repo has likely changed; update ` +
      `scripts/aphydle-patch-image-proxy.mjs to match the new function before ` +
      `running refresh-aphydle.sh again, otherwise plant_images.link URLs will ` +
      `regress to direct (CORS-blocked) fetches.`,
  );
  process.exit(1);
}

const patched = src.replace(ORIGINAL, REPLACEMENT);
writeFileSync(TARGET, patched);
console.log(`[aphydle-patch] patched ${TARGET}`);
