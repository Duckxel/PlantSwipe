// Server-side Aphylia card renderer. Pulls a plant + its translations,
// images, and colour palette from Supabase, renders the same four 1080×1350
// social cards the in-app /admin Export Studio produces, uploads each PNG
// to Supabase storage, and returns the URLs alongside the Instagram caption
// so a cron job can hand them straight to Buffer.
//
// Mirrors /tmp/aphydle/server/puzzleApi.mjs by importing the platform-
// agnostic shared renderer (../src/shared/aphyliaCardRenderer.ts) and
// providing the napi-canvas-flavoured implementations of everything that
// can't live in shared code: image decoding, font registration, icon
// rasterisation, and the AI/Supabase fetches.

import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import {
  Sun,
  Droplet,
  Wind,
  Palette,
  Sprout,
  AlertTriangle,
  MapPin,
  Leaf,
  Thermometer,
  Clock,
  Ruler,
  ScrollText,
  ChevronsDown,
  Shovel,
} from "lucide-react";

import {
  CARD_W,
  CARD_H,
  C,
  renderAphyliaCard,
} from "../src/shared/aphyliaCardRenderer.ts";
import { ORIGIN_MAP_URL } from "../src/lib/originCoords.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "..", "public");
const LOGO_WHITE_PATH = join(PUBLIC_DIR, "icons", "icon-500_transparent_white.png");
const LOGO_BLACK_PATH = join(PUBLIC_DIR, "icons", "icon-500_transparent_black.png");
const WORLD_MAP_PATH = resolve(__dirname, "..", "src", "assets", "world-map-dark.svg");

// — fonts ────────────────────────────────────────────────────────────────
// Fira Code is the only typeface the cards use. Register every weight the
// renderer touches (400/500/600/700) with a single family alias so the
// browser-side `font: "700 32px Fira Code"` strings keep working unchanged
// server-side.
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const require = createRequire(import.meta.url);
  const weights = ["400", "500", "600", "700"];
  let registered = 0;
  for (const w of weights) {
    let ttfPath = null;
    try {
      const cssPath = require.resolve(`@fontsource/fira-code/${w}.css`);
      const candidate = resolve(
        dirname(cssPath),
        "files",
        `fira-code-latin-${w}-normal.ttf`,
      );
      if (existsSync(candidate)) ttfPath = candidate;
    } catch {
      /* fontsource resolve failed — try next strategy */
    }
    if (!ttfPath) {
      const fallback = resolve(
        __dirname,
        "..",
        "node_modules",
        "@fontsource",
        "fira-code",
        "files",
        `fira-code-latin-${w}-normal.ttf`,
      );
      if (existsSync(fallback)) ttfPath = fallback;
    }
    if (ttfPath) {
      try {
        GlobalFonts.registerFromPath(ttfPath, "Fira Code");
        registered++;
      } catch (e) {
        console.warn(`[aphylia-card-renderer] failed to register Fira Code ${w}:`, e?.message || e);
      }
    }
  }
  if (registered === 0) {
    console.warn(
      "[aphylia-card-renderer] no Fira Code TTFs found — cards will fall back to napi-canvas's default font (renders identical layout but visually drifts).",
    );
  }
  fontsRegistered = true;
}

// — utilities mirroring the React component's `tidy` helper ─────────────
function tidy(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// — icon set: rasterise each Lucide React icon to a data URL and decode it
// through @napi-rs/canvas. Same path the in-app component uses — SVG via
// renderToStaticMarkup, encoded as a data URL, decoded to an image — so
// the iconography matches pixel-for-pixel. Cached at module level (icons
// are static; rebuilding them every render is wasteful).
let iconSetPromise = null;

async function rasteriseLucide(IconComponent, color, size = 64, strokeWidth = 2) {
  try {
    const node = React.createElement(IconComponent, { size, color, strokeWidth });
    const svg = renderToStaticMarkup(node);
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return await loadImage(dataUrl);
  } catch (e) {
    console.warn("[aphylia-card-renderer] icon rasterise failed:", e?.message || e);
    return null;
  }
}

async function loadIconSet() {
  if (iconSetPromise) return iconSetPromise;
  iconSetPromise = (async () => {
    const [
      sunFilled,
      sunEmpty,
      dropletFilled,
      dropletEmpty,
      wind,
      palette,
      sproutInk,
      sproutCream,
      alert,
      mapPin,
      leaf,
      thermo,
      clock,
      ruler,
      scroll,
      scrollGold,
      chevDown,
      chevDownInk,
      shovel,
      sunCream,
    ] = await Promise.all([
      rasteriseLucide(Sun, C.gold, 64, 2.4),
      rasteriseLucide(Sun, "rgba(21,32,26,0.18)", 64, 2),
      rasteriseLucide(Droplet, C.mint, 64, 2.4),
      rasteriseLucide(Droplet, "rgba(21,32,26,0.18)", 64, 2),
      rasteriseLucide(Wind, C.ink, 64, 2),
      rasteriseLucide(Palette, C.ink, 64, 2),
      rasteriseLucide(Sprout, C.ink, 64, 2),
      rasteriseLucide(Sprout, C.cream, 64, 2),
      rasteriseLucide(AlertTriangle, C.warning, 64, 2.4),
      rasteriseLucide(MapPin, C.cream, 64, 2.2),
      rasteriseLucide(Leaf, C.ink, 64, 2),
      rasteriseLucide(Thermometer, C.ink, 64, 2),
      rasteriseLucide(Clock, C.ink, 64, 2),
      rasteriseLucide(Ruler, C.ink, 64, 2),
      rasteriseLucide(ScrollText, C.cream, 64, 2),
      rasteriseLucide(ScrollText, C.gold, 96, 2.2),
      rasteriseLucide(ChevronsDown, C.cream, 96, 2.5),
      rasteriseLucide(ChevronsDown, "#059669", 96, 2.5),
      rasteriseLucide(Shovel, C.ink, 64, 2),
      rasteriseLucide(Sun, C.cream, 64, 2.2),
    ]);
    return {
      sunFilled,
      sunEmpty,
      dropletFilled,
      dropletEmpty,
      wind,
      palette,
      sproutInk,
      sproutCream,
      alert,
      mapPin,
      leaf,
      thermo,
      clock,
      ruler,
      scroll,
      scrollGold,
      chevDown,
      chevDownInk,
      shovel,
      sunCream,
    };
  })();
  return iconSetPromise;
}

// — static (non-icon) image cache ─────────────────────────────────────────
let staticAssetsPromise = null;
function loadStaticAssets() {
  if (staticAssetsPromise) return staticAssetsPromise;
  staticAssetsPromise = (async () => {
    const [logoWhite, logoBlack, worldMap, originMap] = await Promise.all([
      existsSync(LOGO_WHITE_PATH) ? loadImage(LOGO_WHITE_PATH).catch(() => null) : null,
      existsSync(LOGO_BLACK_PATH) ? loadImage(LOGO_BLACK_PATH).catch(() => null) : null,
      existsSync(WORLD_MAP_PATH) ? loadImage(WORLD_MAP_PATH).catch(() => null) : null,
      loadImage(ORIGIN_MAP_URL).catch(() => null),
    ]);
    return { logoWhite, logoBlack, worldMap, originMap };
  })();
  return staticAssetsPromise;
}

// — Supabase plant fetch (mirrors generate() in AdminExportPanel.tsx) ────
async function loadPlantBundle(supabase, plantId) {
  if (!supabase) throw new Error("supabase client not configured");
  const { data: plantData, error: plantErr } = await supabase
    .from("plants")
    .select("*")
    .eq("id", plantId)
    .single();
  if (plantErr || !plantData) {
    throw new Error(`plant ${plantId} not found: ${plantErr?.message || "no row"}`);
  }
  const plant = plantData;

  const [imgsRes, translationsRes, colorLinksRes] = await Promise.all([
    supabase.from("plant_images").select("link, use").eq("plant_id", plantId),
    supabase
      .from("plant_translations")
      .select("language, variety, presentation, common_names, origin")
      .eq("plant_id", plantId),
    supabase
      .from("plant_colors")
      .select("color_id, colors:color_id (name, hex_code)")
      .eq("plant_id", plantId),
  ]);

  const translations = translationsRes.data || [];
  const tEn =
    translations.find((t) => (t.language || "").toLowerCase() === "en") ||
    translations[0] ||
    null;
  const variety = (tEn?.variety || "").trim();
  const presentation = (tEn?.presentation || "").trim();
  const origin = tEn && Array.isArray(tEn.origin)
    ? tEn.origin.map(tidy).filter(Boolean)
    : [];
  const commonNames = tEn && Array.isArray(tEn.common_names)
    ? tEn.common_names.map(tidy).filter(Boolean)
    : [];

  const colorLinks = colorLinksRes.data || [];
  const colors = colorLinks
    .map((l) => (Array.isArray(l.colors) ? l.colors[0] : l.colors))
    .filter((c) => !!c && !!c.hex_code);

  const USE_PRIORITY = { primary: 0, card: 1, cover: 2, hero: 3, thumbnail: 4 };
  const rawImgs = (imgsRes.data || [])
    .filter((r) => !!r?.link)
    .sort(
      (a, b) =>
        (USE_PRIORITY[a.use ?? ""] ?? 99) - (USE_PRIORITY[b.use ?? ""] ?? 99),
    )
    .slice(0, 4);

  const loaded = await Promise.all(
    rawImgs.map((r) => loadImage(r.link).catch(() => null)),
  );
  const images = loaded.filter(Boolean);

  return {
    plant,
    variety,
    presentation,
    origin,
    commonNames,
    colors,
    images,
  };
}

// — AI content fetch ─────────────────────────────────────────────────────
// Hits the same admin endpoint the browser-side panel uses. Server-to-
// server: bind to 127.0.0.1 with the static admin token so the OpenAI
// generation runs through the existing handler instead of duplicating it.
async function fetchAiContent({
  baseUrl,
  endpoint,
  plantName,
  scientificName,
  family,
  variety,
}) {
  const empty = { historicalFact: "", gardenerTip: "", postDescription: "" };
  if (!plantName) return empty;
  const adminToken =
    process.env.ADMIN_STATIC_TOKEN || process.env.VITE_ADMIN_STATIC_TOKEN || "";
  if (!baseUrl || !endpoint) return empty;
  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (adminToken) headers["X-Admin-Token"] = adminToken;
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ plantName, scientificName, family, variety }),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    if (!data?.success) return empty;
    const fact =
      data.factConfidence === "low" || typeof data.historicalFact !== "string"
        ? ""
        : data.historicalFact.trim();
    return {
      historicalFact: fact,
      gardenerTip:
        typeof data.gardenerTip === "string" ? data.gardenerTip.trim() : "",
      postDescription:
        typeof data.postDescription === "string"
          ? data.postDescription.trim()
          : "",
    };
  } catch (e) {
    console.warn("[aphylia-card-renderer] AI fetch failed:", e?.message || e);
    return empty;
  }
}

// — public entry point ──────────────────────────────────────────────────
export async function renderAphyliaCardsForPlant(plantId, deps) {
  if (!plantId) throw new Error("plantId required");
  const { supabase, uploadCardToStorage, primaryDomainUrl, aiContentBaseUrl, aiContentEndpoint } =
    deps || {};
  if (!supabase) throw new Error("deps.supabase required");
  if (typeof uploadCardToStorage !== "function") {
    throw new Error("deps.uploadCardToStorage required");
  }

  registerFonts();

  const [bundle, ai, staticAssets, icons] = await Promise.all([
    loadPlantBundle(supabase, plantId),
    fetchAiContent({
      baseUrl: aiContentBaseUrl,
      endpoint: aiContentEndpoint,
      plantName: String(plantId), // overwritten below once bundle loads
    }).catch(() => ({ historicalFact: "", gardenerTip: "", postDescription: "" })),
    loadStaticAssets(),
    loadIconSet(),
  ]);

  // Re-fetch AI with the actual plant fields. The pre-fetch above keeps the
  // promise.all symmetric but the placeholder name produced empty content;
  // here we run the real call now that the bundle is in hand.
  const realAi = await fetchAiContent({
    baseUrl: aiContentBaseUrl,
    endpoint: aiContentEndpoint,
    plantName: String(bundle.plant.name || "").trim(),
    scientificName: String(bundle.plant.scientific_name_species || "").trim(),
    family: String(bundle.plant.family || "").trim(),
    variety: bundle.variety,
  });
  const aiFinal = realAi.postDescription || realAi.historicalFact || realAi.gardenerTip
    ? realAi
    : ai;

  const plantName = String(bundle.plant.name || "Plant");
  const plantUrl = `${primaryDomainUrl || "https://aphylia.app"}/plants/${bundle.plant.id || plantId}`;

  const cardUrls = [];
  for (let i = 0; i < 4; i++) {
    const canvas = createCanvas(CARD_W, CARD_H);
    const ctx = canvas.getContext("2d");
    renderAphyliaCard({
      ctx,
      cardIndex: i,
      plant: bundle.plant,
      images: bundle.images,
      variety: bundle.variety,
      commonNames: bundle.commonNames,
      origin: bundle.origin,
      colors: bundle.colors,
      icons,
      logoWhite: staticAssets.logoWhite,
      logoBlack: staticAssets.logoBlack,
      originMap: staticAssets.originMap,
      worldMap: staticAssets.worldMap,
      ai: {
        historicalFact: aiFinal.historicalFact,
        gardenerTip: aiFinal.gardenerTip,
      },
    });
    const buffer = canvas.toBuffer("image/png");
    const url = await uploadCardToStorage({
      buffer,
      mimetype: "image/png",
      originalname: `card-${i + 1}.png`,
    });
    cardUrls.push(url);
  }

  // Caption assembly mirrors fullCaption in AdminExportPanel.tsx.
  const lines = [];
  if (aiFinal.postDescription) lines.push(aiFinal.postDescription.trim());
  lines.push("");
  lines.push(`🔗 Full plant guide → ${plantUrl}`);
  lines.push("🌿 Discover more on aphylia.app");
  lines.push("");
  const tagBase =
    String(bundle.plant.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "plant";
  lines.push(
    `#aphylia #plants #plantsofinstagram #${tagBase} #plantcare #houseplants`,
  );
  const caption = lines.join("\n");

  return {
    caption,
    cardUrls,
    plantName,
    plantUrl,
  };
}
