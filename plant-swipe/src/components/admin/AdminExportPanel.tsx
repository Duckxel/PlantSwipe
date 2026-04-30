import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import {
  Download,
  Sparkles,
  WandSparkles,
  RefreshCw,
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
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item";
import worldMapDarkUrl from "@/assets/world-map-dark.svg";

type PlantRow = Record<string, unknown>;
type ColorRow = { name?: string; hex_code?: string };
type Translation = {
  language?: string;
  variety?: string | null;
  presentation?: string | null;
  common_names?: string[] | null;
  origin?: string[] | null;
};

const CARD_W = 1080;
const CARD_H = 1350;

// Fira Code is the only typeface — loaded across 400/500/600/700 in main.tsx
// (no italic variant exists for this family, so we never request italic).
const FONT_MONO =
  '"Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const C = {
  forest: "#0B1A12",
  forestDeep: "#06120B",
  forestSoft: "#16271D",
  cream: "#F4EFE2",
  paper: "#EBE3CF",
  ink: "#15201A",
  inkDim: "#3B4A40",
  mint: "#5BD394",
  mintGlow: "#A8F0CC",
  mintDim: "#3B7F5A",
  coral: "#FF8A65",
  gold: "#E0B252",
  rose: "#F2C8B7",
  warning: "#E25555",
} as const;

// Load a plant image for the canvas. Try direct first (works for Supabase and
// CORS-friendly third-parties); fall back to PlantSwipe's CORS-permissive
// /api/image-proxy when direct fails (third-party hosts that don't send
// Access-Control-Allow-Origin). Vite dev forwards /api → :3000 already, so this
// works whenever the express server is running; in pure-vite dev it'll just
// log the failed direct attempt and stop there.
async function loadCanvasImage(
  url: string | null | undefined,
): Promise<HTMLImageElement | null> {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return loadImage(url, { crossOrigin: null });
  }
  const direct = await loadImage(url);
  if (direct) return direct;
  if (!/^https?:/i.test(url)) return null;
  return loadImage(`/api/image-proxy?url=${encodeURIComponent(url)}`);
}

// — utils ----------------------------------------------------------------

const tidy = (s: unknown): string =>
  String(s ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

const slug = (v: string): string =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function joinPretty(arr: string[], sep = " · ", max = 3): string {
  if (!arr.length) return "—";
  const top = arr.slice(0, max).map(tidy);
  const more = arr.length - max;
  return more > 0 ? `${top.join(sep)} +${more}` : top.join(sep);
}

function loadImage(
  url: string | null | undefined,
  opts: { crossOrigin?: string | null } = {},
): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (opts.crossOrigin !== null) img.crossOrigin = opts.crossOrigin ?? "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Render a lucide-react icon component to a canvas-loadable image. Each icon
// is rasterized once at a chosen color/stroke and cached so the cards can
// drawImage() it like any other asset. We render the SVG to a string via
// react-dom/server (the same call the app already uses elsewhere) and inline
// it as a data URL — no network, no taint.
async function lucideImage(
  Icon: LucideIcon,
  color: string,
  size = 64,
  strokeWidth = 2,
): Promise<HTMLImageElement | null> {
  try {
    const node = React.createElement(Icon, {
      size,
      color,
      strokeWidth,
    });
    const svg = renderToStaticMarkup(node);
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return await loadImage(dataUrl, { crossOrigin: null });
  } catch {
    return null;
  }
}

type IconSet = {
  sunFilled: HTMLImageElement | null;
  sunEmpty: HTMLImageElement | null;
  dropletFilled: HTMLImageElement | null;
  dropletEmpty: HTMLImageElement | null;
  wind: HTMLImageElement | null;
  palette: HTMLImageElement | null;
  sproutInk: HTMLImageElement | null;
  sproutCream: HTMLImageElement | null;
  alert: HTMLImageElement | null;
  mapPin: HTMLImageElement | null;
  leaf: HTMLImageElement | null;
  thermo: HTMLImageElement | null;
  clock: HTMLImageElement | null;
  ruler: HTMLImageElement | null;
  sunCream: HTMLImageElement | null;
};

// Build the same auth headers shape lib/aiPlantFill.ts uses so the export
// panel hits the admin AI endpoints with both Supabase JWT (the canonical
// auth path) and the static admin token (fallback for the local dev shell
// where session refresh is flaky).
async function buildAdminAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  try {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  try {
    const t = (
      globalThis as typeof globalThis & {
        __ENV__?: { VITE_ADMIN_STATIC_TOKEN?: unknown };
      }
    ).__ENV__?.VITE_ADMIN_STATIC_TOKEN;
    if (t) headers["X-Admin-Token"] = String(t);
  } catch {
    /* ignore */
  }
  return headers;
}

async function fetchHistoricalFact(
  plantName: string,
  scientificName: string,
  family: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!plantName) return "";
  try {
    const headers = await buildAdminAuthHeaders();
    const res = await fetch("/api/admin/ai/plant-historical-fact", {
      method: "POST",
      headers,
      body: JSON.stringify({
        plantName,
        scientificName,
        family,
        maxChars: 280,
      }),
      signal,
    });
    if (!res.ok) return "";
    const data = (await res.json()) as {
      success?: boolean;
      fact?: string;
      confidence?: string;
    };
    if (!data?.success || typeof data.fact !== "string") return "";
    if (data.confidence === "low") return "";
    return data.fact.trim();
  } catch {
    return "";
  }
}

async function ensureFontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`700 96px "Lavonte"`),
      document.fonts.load(`400 36px "Lavonte"`),
      document.fonts.load(`700 32px "Fira Code"`),
      document.fonts.load(`500 18px "Fira Code"`),
      document.fonts.load(`700 48px "Inter"`),
      document.fonts.load(`400 22px "Inter"`),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to system fonts */
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  start: number,
  min: number,
  weight: string,
  family: string,
): number {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return size;
    size -= 2;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (!img.width || !img.height) return;
  const srcAR = img.width / img.height;
  const dstAR = dw / dh;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (srcAR > dstAR) {
    sw = img.height * dstAR;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dstAR;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawWrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
  maxLines = 4,
): number {
  if (!text) return y;
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (lines >= maxLines - 1) {
        let rem = `${line} ${words.slice(i).join(" ")}`;
        while (rem && ctx.measureText(`${rem}…`).width > maxW)
          rem = rem.slice(0, -1);
        ctx.fillText(`${rem.trimEnd()}…`, x, cy);
        return cy;
      }
      ctx.fillText(line, x, cy);
      line = words[i];
      cy += lineHeight;
      lines++;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

// — gauges ---------------------------------------------------------------

const SUN_RANK: Record<string, number> = {
  full_sun: 5,
  direct_light: 5,
  partial_sun: 4,
  bright_indirect_light: 4,
  partial_shade: 3,
  medium_light: 3,
  light_shade: 2,
  deep_shade: 1,
  low_light: 1,
};

function sunLevel(values: string[]): number {
  let best = 0;
  for (const v of values) {
    const r = SUN_RANK[v.toLowerCase()] ?? 0;
    if (r > best) best = r;
  }
  return best;
}

function waterLevel(plant: PlantRow): number {
  const warm = Number(plant.watering_frequency_warm) || 0;
  const cold = Number(plant.watering_frequency_cold) || 0;
  const peak = Math.max(warm, cold);
  if (peak >= 7) return 5;
  if (peak >= 5) return 4;
  if (peak >= 3) return 3;
  if (peak >= 2) return 2;
  if (peak >= 1) return 1;
  return 0;
}

function drawColorSwatches(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colors: ColorRow[],
  borderColor: string,
  emptyColor: string,
) {
  if (!colors.length) {
    ctx.fillStyle = emptyColor;
    ctx.font = `500 22px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText("—", x, y + 6);
    return;
  }
  const r = 22;
  const gap = 18;
  let cx = x + r;
  for (let i = 0; i < Math.min(colors.length, 6); i++) {
    const hex = colors[i].hex_code || "#888";
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    cx += r * 2 + gap;
  }
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  opts: {
    bg: string;
    fg: string;
    border?: string;
    paddingX?: number;
    paddingY?: number;
    size?: number;
    family?: string;
    weight?: string;
    radius?: number;
    letterSpacing?: number;
  },
): { width: number; height: number } {
  const px = opts.paddingX ?? 18;
  const py = opts.paddingY ?? 10;
  const size = opts.size ?? 18;
  const family = opts.family ?? FONT_MONO;
  const weight = opts.weight ?? "600";
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width + px * 2;
  const h = size + py * 2;
  roundRectPath(ctx, x, y, w, h, opts.radius ?? h / 2);
  ctx.fillStyle = opts.bg;
  ctx.fill();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = opts.fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + px, y + h / 2 + 1);
  return { width: w, height: h };
}

function drawGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha = 0.04,
  density = 1100,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < density; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.4;
    ctx.fillRect(x, y, r, r);
  }
  ctx.restore();
}

// — branding ------------------------------------------------------------

function drawBrandHeader(
  ctx: CanvasRenderingContext2D,
  page: number,
  total: number,
  label: string,
  fg: string,
  accent: string,
  logo: HTMLImageElement | null,
) {
  const padX = 64;
  const top = 56;
  const logoSize = 56;

  // Aphylia logo glyph (PNG asset). Falls through to a text-only mark when the
  // logo isn't available yet so the cards still render before assets resolve.
  let textX = padX;
  if (logo && logo.width > 0) {
    ctx.drawImage(logo, padX, top, logoSize, logoSize);
    textX = padX + logoSize + 14;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fg;
  ctx.font = `700 26px ${FONT_MONO}`;
  ctx.fillText("Aphylia", textX, top + logoSize / 2 + 9);

  // accent dot
  const dotX = textX + ctx.measureText("Aphylia").width + 14;
  ctx.beginPath();
  ctx.arc(dotX, top + logoSize / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // page indicator right
  ctx.fillStyle = fg;
  ctx.font = `600 16px ${FONT_MONO}`;
  ctx.textAlign = "right";
  const indicator = `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")} · ${label}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(indicator, CARD_W - padX, top + logoSize / 2 + 6);
  ctx.letterSpacing = "0px";
}

function drawBrandFooter(
  ctx: CanvasRenderingContext2D,
  fg: string,
  accent: string,
) {
  const padX = 64;
  const bottom = CARD_H - 56;

  ctx.fillStyle = fg;
  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "4px";
  ctx.fillText("APHYLIA.APP", padX, bottom);
  ctx.letterSpacing = "0px";

  // arrow → on the right
  ctx.fillStyle = accent;
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.textAlign = "right";
  ctx.letterSpacing = "3px";
  ctx.fillText("DISCOVER →", CARD_W - padX, bottom);
  ctx.letterSpacing = "0px";
}

// — card 1: COVER --------------------------------------------------------

// Draws a floating teaser pill on the cover photo. Each pill carries a Lucide
// icon + an uppercase mono label and lives at semi-transparent dark fill so
// the photo still reads behind it. The icons are pre-rasterized at the
// component level (see lucideImage / IconSet).
function drawTeaserChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: HTMLImageElement | null,
  text: string,
): { width: number; height: number } {
  const padX = 22;
  const padY = 14;
  const iconSize = 28;
  const gap = 10;
  ctx.font = `700 14px ${FONT_MONO}`;
  ctx.letterSpacing = "3px";
  const textW = ctx.measureText(text).width;
  const w =
    padX + (icon ? iconSize + gap : 0) + textW + ctx.measureText(" ").width + padX;
  const h = Math.max(iconSize, 14) + padY * 2;
  // shadow pad
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(6,18,11,0.72)";
  ctx.fill();
  ctx.restore();
  // hairline ring
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = "rgba(168,240,204,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // icon
  if (icon) {
    ctx.drawImage(icon, x + padX, y + (h - iconSize) / 2, iconSize, iconSize);
  }
  // text
  ctx.fillStyle = C.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX + (icon ? iconSize + gap : 0), y + h / 2 + 1);
  ctx.letterSpacing = "0px";
  return { width: w, height: h };
}

function drawCardCover(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  hero: HTMLImageElement | null,
  variety: string,
  icons: IconSet | null,
  logoWhite: HTMLImageElement | null,
  origin: string[],
) {
  // 1. Base fill (matches palette so empty image areas don't flash white).
  ctx.fillStyle = C.forestDeep;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 2. Full-bleed plant photo. The image dominates the card — magazine-cover
  //    style — and a heavy bottom gradient carries the title type.
  if (hero) {
    drawCoverImage(ctx, hero, 0, 0, CARD_W, CARD_H);
  }

  // 3. Top vignette so the brand chrome reads on bright photos.
  const topG = ctx.createLinearGradient(0, 0, 0, 280);
  topG.addColorStop(0, "rgba(6,18,11,0.7)");
  topG.addColorStop(1, "rgba(6,18,11,0)");
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, CARD_W, 280);

  // 4. Heavy bottom gradient — covers ~55% of the card to back the title block
  //    and the bottom-anchored brand footer.
  const botStart = Math.round(CARD_H * 0.42);
  const botG = ctx.createLinearGradient(0, botStart, 0, CARD_H);
  botG.addColorStop(0, "rgba(6,18,11,0)");
  botG.addColorStop(0.45, "rgba(6,18,11,0.6)");
  botG.addColorStop(1, "rgba(6,18,11,0.96)");
  ctx.fillStyle = botG;
  ctx.fillRect(0, botStart, CARD_W, CARD_H - botStart);

  // 5. Brand chrome (logo + 01/04 indicator).
  drawBrandHeader(ctx, 1, 4, "COVER", C.cream, C.mint, logoWhite);

  // 6. Floating teaser chips on the photo — peek at what's inside cards 2 & 3
  //    to invite a swipe. Stacked vertically left-side, mid-card, so they
  //    don't fight the title block below.
  const teasers: Array<{ icon: HTMLImageElement | null; text: string }> = [];
  if (origin[0]) {
    teasers.push({
      icon: icons?.mapPin ?? null,
      text: tidy(origin[0]).toUpperCase(),
    });
  }
  const sun = asArr(plant.sunlight);
  if (sun[0]) {
    teasers.push({
      icon: icons?.sunCream ?? null,
      text: tidy(sun[0]).toUpperCase(),
    });
  }
  const care = asArr(plant.care_level)[0];
  if (care) {
    teasers.push({
      icon: icons?.sproutCream ?? null,
      text: tidy(care).toUpperCase(),
    });
  }
  // Position: stacked left, vertically centered around y=560.
  let chipY = 380;
  for (const t of teasers.slice(0, 3)) {
    const sz = drawTeaserChip(ctx, 64, chipY, t.icon, t.text);
    chipY += sz.height + 16;
  }

  // 7. Right-edge vertical decorative strip — "PLANT NO. 01 · APHYLIA STUDIO"
  //    rotated 90° downward. Adds editorial / poster vibe.
  ctx.save();
  ctx.translate(CARD_W - 50, 380);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "rgba(245,239,226,0.55)";
  ctx.font = `500 14px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "8px";
  ctx.fillText("PLANT NO. 01 · APHYLIA STUDIO", 0, 0);
  ctx.letterSpacing = "0px";
  ctx.restore();

  // 8. Title block — anchored bottom-left of the card.
  const padX = 64;
  const titleBaseline = CARD_H - 290;

  // Eyebrow
  ctx.fillStyle = C.mint;
  ctx.font = `600 15px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "8px";
  ctx.fillText("APHYLIA STUDIO · COVER", padX, titleBaseline - 175);
  ctx.letterSpacing = "0px";

  // Accent hairline
  ctx.strokeStyle = C.mint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, titleBaseline - 152);
  ctx.lineTo(padX + 64, titleBaseline - 152);
  ctx.stroke();

  // Big title — auto-fit, uppercase, tracked.
  const name = tidy(plant.name || "Plant").toUpperCase();
  const titleSize = fitText(ctx, name, CARD_W - 128, 130, 64, "700", FONT_MONO);
  ctx.font = `700 ${titleSize}px ${FONT_MONO}`;
  ctx.fillStyle = C.cream;
  ctx.letterSpacing = "5px";
  ctx.fillText(name, padX, titleBaseline);
  ctx.letterSpacing = "0px";

  // Variety / sci-name subtitle
  const variantTextRaw = variety && variety.trim() ? variety.trim() : "";
  const sci = String(plant.scientific_name_species || "").trim();
  const sub = variantTextRaw
    ? `'${variantTextRaw}' · ${sci}`
    : sci;
  if (sub) {
    ctx.font = `400 26px ${FONT_MONO}`;
    ctx.fillStyle = "rgba(245,239,226,0.85)";
    ctx.fillText(sub, padX, titleBaseline + 50);
  }

  // Family + plant_type chips on a single row.
  const family = tidy(plant.family || "");
  const plantType = tidy(plant.plant_type || "");
  const chipsRowY = titleBaseline + 80;
  let cursorX = padX;
  if (family) {
    const sz = drawChip(ctx, cursorX, chipsRowY, family.toUpperCase(), {
      bg: C.mint,
      fg: C.forestDeep,
      size: 13,
      family: FONT_MONO,
      weight: "700",
      paddingX: 16,
      paddingY: 10,
    });
    cursorX += sz.width + 10;
  }
  if (plantType) {
    drawChip(ctx, cursorX, chipsRowY, plantType.toUpperCase(), {
      bg: "rgba(0,0,0,0.55)",
      fg: C.cream,
      border: "rgba(245,239,226,0.5)",
      size: 13,
      family: FONT_MONO,
      weight: "700",
      paddingX: 16,
      paddingY: 10,
    });
  }

  // 9. Decorative corner ticks (top + bottom).
  ctx.strokeStyle = "rgba(245,239,226,0.5)";
  ctx.lineWidth = 1.5;
  const t = 28;
  const inset = 36;
  ctx.beginPath();
  ctx.moveTo(inset, inset + t);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + t, inset);
  ctx.moveTo(CARD_W - inset - t, inset);
  ctx.lineTo(CARD_W - inset, inset);
  ctx.lineTo(CARD_W - inset, inset + t);
  ctx.moveTo(inset, CARD_H - inset - t);
  ctx.lineTo(inset, CARD_H - inset);
  ctx.lineTo(inset + t, CARD_H - inset);
  ctx.moveTo(CARD_W - inset - t, CARD_H - inset);
  ctx.lineTo(CARD_W - inset, CARD_H - inset);
  ctx.lineTo(CARD_W - inset, CARD_H - inset - t);
  ctx.stroke();

  drawGrain(ctx, CARD_W, CARD_H, 0.04, 600);
  drawBrandFooter(ctx, C.cream, C.mint);
}

// — card 2: IDENTITY -----------------------------------------------------

// Repeats a single icon image N times across a row, switching between filled
// and empty variants based on `level` (e.g. 3 of 5 droplets filled). Used for
// the Sun and Water gauges on the identity card.
function drawIconRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  level: number,
  filled: HTMLImageElement | null,
  empty: HTMLImageElement | null,
  size = 32,
  gap = 14,
) {
  for (let i = 0; i < count; i++) {
    const img = i < level ? filled : empty;
    const dx = x + i * (size + gap);
    if (img) {
      ctx.drawImage(img, dx, y, size, size);
    } else {
      // Fallback dot if the icon failed to rasterize.
      ctx.beginPath();
      ctx.arc(dx + size / 2, y + size / 2, size * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = i < level ? C.mint : "rgba(0,0,0,0.15)";
      ctx.fill();
    }
  }
}

function drawCardIdentity(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  hero: HTMLImageElement | null,
  colors: ColorRow[],
  commonNames: string[],
  icons: IconSet | null,
  logoBlack: HTMLImageElement | null,
) {
  // Paper background with a soft top-light gradient.
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const bgG = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bgG.addColorStop(0, "rgba(255,255,255,0.6)");
  bgG.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawBrandHeader(ctx, 2, 4, "IDENTITY", C.ink, C.mintDim, logoBlack);

  // Hero crop — circular, top-right corner. Tucked next to title block.
  if (hero) {
    const r = 130;
    const cx = CARD_W - 170;
    const cy = 285;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, hero, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = C.mintDim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // — Title block ------------------------------------------------------
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.inkDim;
  ctx.font = `600 14px ${FONT_MONO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("IDENTITY · 02", 64, 195);
  ctx.letterSpacing = "0px";

  // Hairline accent under eyebrow.
  ctx.strokeStyle = C.mintDim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64, 208);
  ctx.lineTo(140, 208);
  ctx.stroke();

  const name = tidy(plant.name || "Plant").toUpperCase();
  const nameSize = fitText(ctx, name, 600, 56, 32, "700", FONT_MONO);
  ctx.font = `700 ${nameSize}px ${FONT_MONO}`;
  ctx.fillStyle = C.ink;
  ctx.letterSpacing = "3px";
  ctx.fillText(name, 64, 230 + nameSize);
  ctx.letterSpacing = "0px";

  const sci = String(plant.scientific_name_species || "").trim();
  let nextY = 230 + nameSize + 50;
  if (sci) {
    ctx.font = `400 22px ${FONT_MONO}`;
    ctx.fillStyle = C.inkDim;
    ctx.fillText(sci, 64, nextY);
    nextY += 34;
  }

  // Family + Type chips.
  const family = tidy(plant.family || "");
  const plantType = tidy(plant.plant_type || "");
  let cursorX = 64;
  if (family) {
    const sz = drawChip(ctx, cursorX, nextY, family.toUpperCase(), {
      bg: C.ink,
      fg: C.cream,
      size: 12,
      family: FONT_MONO,
      weight: "700",
      paddingX: 14,
      paddingY: 8,
    });
    cursorX += sz.width + 10;
  }
  if (plantType) {
    drawChip(ctx, cursorX, nextY, plantType.toUpperCase(), {
      bg: "transparent",
      fg: C.ink,
      border: C.ink,
      size: 12,
      family: FONT_MONO,
      weight: "700",
      paddingX: 14,
      paddingY: 8,
    });
  }
  nextY += 50;

  // — Common Names -----------------------------------------------------
  if (commonNames.length > 0) {
    ctx.fillStyle = C.inkDim;
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.letterSpacing = "5px";
    ctx.fillText("ALSO KNOWN AS", 64, nextY);
    ctx.letterSpacing = "0px";
    nextY += 24;

    ctx.font = `500 19px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    const list = commonNames.slice(0, 4).join("  ·  ");
    drawWrap(ctx, list, 64, nextY, CARD_W - 128, 28, 2);
    nextY += 60;
  }

  // — Field Guide section ---------------------------------------------
  const guideY = Math.max(nextY + 20, 620);

  // Section header.
  ctx.fillStyle = C.inkDim;
  ctx.font = `600 13px ${FONT_MONO}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("FIELD GUIDE", 64, guideY);
  ctx.letterSpacing = "0px";
  ctx.strokeStyle = "rgba(21,32,26,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(216, guideY - 5);
  ctx.lineTo(CARD_W - 64, guideY - 5);
  ctx.stroke();

  // 4 × 2 grid of stat boxes — 8 stats give the card real depth.
  const gridX = 64;
  const gridY = guideY + 24;
  const cellW = 224;
  const cellH = 140;
  const cellGap = 16;

  const drawStatBox = (
    col: number,
    row: number,
    icon: HTMLImageElement | null,
    label: string,
    drawValue: (cx: number, cy: number, cw: number, ch: number) => void,
  ) => {
    const x = gridX + col * (cellW + cellGap);
    const y = gridY + row * (cellH + cellGap);
    roundRectPath(ctx, x, y, cellW, cellH, 18);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(21,32,26,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (icon) {
      ctx.drawImage(icon, x + 18, y + 16, 26, 26);
    }
    ctx.fillStyle = C.inkDim;
    ctx.font = `600 10px ${FONT_MONO}`;
    ctx.letterSpacing = "4px";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label.toUpperCase(), x + 52, y + 35);
    ctx.letterSpacing = "0px";
    drawValue(x, y, cellW, cellH);
  };

  // BOX 1: Sun
  const sun = sunLevel(asArr(plant.sunlight));
  drawStatBox(0, 0, icons?.sunFilled ?? null, "Sun", (x, y, w) => {
    drawIconRow(
      ctx,
      x + 18,
      y + 60,
      5,
      sun,
      icons?.sunFilled ?? null,
      icons?.sunEmpty ?? null,
      22,
      8,
    );
    const v = tidy(asArr(plant.sunlight)[0] || "—").toUpperCase();
    const sz = fitText(ctx, v, w - 36, 18, 12, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.fillText(v, x + 18, y + 118);
  });

  // BOX 2: Water
  const water = waterLevel(plant);
  const warmFreq = Number(plant.watering_frequency_warm) || 0;
  drawStatBox(1, 0, icons?.dropletFilled ?? null, "Water", (x, y, w) => {
    drawIconRow(
      ctx,
      x + 18,
      y + 60,
      5,
      water,
      icons?.dropletFilled ?? null,
      icons?.dropletEmpty ?? null,
      22,
      8,
    );
    const v = warmFreq > 0 ? `${warmFreq}× / WEEK` : "—";
    const sz = fitText(ctx, v, w - 36, 18, 12, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.fillText(v, x + 18, y + 118);
  });

  // BOX 3: Humidity
  const hyg = Number(plant.hygrometry) || 0;
  drawStatBox(2, 0, icons?.wind ?? null, "Humidity", (x, y, w) => {
    const bx = x + 18;
    const by = y + 64;
    const bw = w - 36;
    const bh = 16;
    roundRectPath(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = "rgba(21,32,26,0.08)";
    ctx.fill();
    if (hyg > 0) {
      const pct = Math.max(0, Math.min(1, hyg / 100));
      roundRectPath(ctx, bx, by, Math.max(bh, bw * pct), bh, bh / 2);
      const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
      grad.addColorStop(0, C.mint);
      grad.addColorStop(1, C.mintDim);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.font = `700 22px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(hyg > 0 ? `${hyg}%` : "—", x + 18, y + 118);
  });

  // BOX 4: Care level
  const care = tidy(asArr(plant.care_level)[0] || "");
  drawStatBox(3, 0, icons?.sproutInk ?? null, "Care", (x, y, w) => {
    if (care) {
      const careColor =
        care.toLowerCase().includes("easy")
          ? C.mintDim
          : care.toLowerCase().includes("complex")
            ? C.coral
            : C.gold;
      const upper = care.toUpperCase();
      ctx.font = `700 16px ${FONT_MONO}`;
      const cw = Math.min(w - 36, ctx.measureText(upper).width + 28);
      const cx = x + 18;
      const cy = y + 60;
      roundRectPath(ctx, cx, cy, cw, 32, 16);
      ctx.fillStyle = careColor;
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(upper, cx + cw / 2, cy + 17);
    }

    // Toxicity inside the care box, small footnote.
    const toxRaw = String(plant.toxicity_pets || plant.toxicity_human || "");
    const toxLow = toxRaw.toLowerCase();
    if (
      toxLow &&
      !toxLow.includes("non_toxic") &&
      !toxLow.includes("non-toxic") &&
      !toxLow.includes("undetermined")
    ) {
      const isDanger = /toxic|deadly|severe|high/.test(toxLow);
      const tox = tidy(toxRaw).toUpperCase();
      ctx.font = `600 11px ${FONT_MONO}`;
      ctx.fillStyle = isDanger ? C.warning : C.inkDim;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.letterSpacing = "3px";
      let tx = x + 18;
      if (isDanger && icons?.alert) {
        ctx.drawImage(icons.alert, x + 18, y + 105, 18, 18);
        tx = x + 42;
      }
      ctx.fillText(tox, tx, y + 119);
      ctx.letterSpacing = "0px";
    }
  });

  // Row 2 — taxonomy / lifecycle stats.
  const lifecycle = tidy(asArr(plant.life_cycle)[0] || "—");
  drawStatBox(0, 1, icons?.clock ?? null, "Lifecycle", (x, y, w) => {
    const sz = fitText(ctx, lifecycle.toUpperCase(), w - 36, 22, 13, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(lifecycle.toUpperCase(), x + 18, y + 90);
  });

  const foliage = tidy(asArr(plant.foliage_persistence)[0] || "—");
  drawStatBox(1, 1, icons?.leaf ?? null, "Foliage", (x, y, w) => {
    const sz = fitText(ctx, foliage.toUpperCase(), w - 36, 22, 13, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(foliage.toUpperCase(), x + 18, y + 90);
  });

  const habit = tidy(asArr(plant.plant_habit)[0] || "—");
  drawStatBox(2, 1, icons?.sproutInk ?? null, "Form", (x, y, w) => {
    const sz = fitText(ctx, habit.toUpperCase(), w - 36, 22, 13, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(habit.toUpperCase(), x + 18, y + 90);
  });

  const heightCm = Number(plant.height_cm) || 0;
  const heightStr =
    heightCm > 0
      ? heightCm >= 100
        ? `${(heightCm / 100).toFixed(heightCm >= 1000 ? 0 : 1)} M`
        : `${heightCm} CM`
      : "—";
  drawStatBox(3, 1, icons?.ruler ?? null, "Height", (x, y, w) => {
    const sz = fitText(ctx, heightStr, w - 36, 32, 16, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(heightStr, x + 18, y + 90);
  });

  // — Palette + Utility row -------------------------------------------
  const paletteY = gridY + 2 * (cellH + cellGap) + 24;

  if (colors.length > 0) {
    ctx.fillStyle = C.inkDim;
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.letterSpacing = "5px";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("PALETTE", 64, paletteY);
    ctx.letterSpacing = "0px";
    drawColorSwatches(
      ctx,
      170,
      paletteY - 10,
      colors,
      "rgba(21,32,26,0.25)",
      C.inkDim,
    );
  }

  // Utility chips (ornamental, edible, medicinal, …) on the right side.
  const utilities = asArr(plant.utility);
  if (utilities.length > 0) {
    let uX = CARD_W - 64;
    const uY = paletteY - 18;
    for (const u of utilities.slice(0, 3).reverse()) {
      ctx.font = `700 11px ${FONT_MONO}`;
      const lbl = tidy(u).toUpperCase();
      const w = ctx.measureText(lbl).width + 28;
      uX -= w;
      drawChip(ctx, uX, uY, lbl, {
        bg: "transparent",
        fg: C.ink,
        border: "rgba(21,32,26,0.5)",
        size: 11,
        family: FONT_MONO,
        weight: "700",
        paddingX: 14,
        paddingY: 6,
      });
      uX -= 8;
    }
  }

  drawBrandFooter(ctx, C.ink, C.mintDim);
}

// — card 3: DEEP KNOWLEDGE ----------------------------------------------

function drawCardDeep(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  origin: string[],
  worldMapFallback: HTMLImageElement | null,
  originMap: HTMLImageElement | null,
  historicalFact: string,
  logoWhite: HTMLImageElement | null,
) {
  // Background.
  ctx.fillStyle = C.forest;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const rg = ctx.createRadialGradient(
    CARD_W / 2,
    CARD_H * 0.35,
    100,
    CARD_W / 2,
    CARD_H * 0.5,
    900,
  );
  rg.addColorStop(0, "rgba(91,211,148,0.10)");
  rg.addColorStop(1, "rgba(6,18,11,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawBrandHeader(ctx, 3, 4, "SCIENCE", C.cream, C.mint, logoWhite);

  // — Title ----------------------------------------------------------
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.mint;
  ctx.font = `600 14px ${FONT_MONO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("DEEP KNOWLEDGE · 03", 64, 195);
  ctx.letterSpacing = "0px";
  ctx.strokeStyle = "rgba(91,211,148,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64, 207);
  ctx.lineTo(140, 207);
  ctx.stroke();

  const originText = (
    origin.length ? joinPretty(origin, " · ", 2) : "Cultivated Worldwide"
  ).toUpperCase();
  ctx.font = `700 44px ${FONT_MONO}`;
  ctx.fillStyle = C.cream;
  ctx.letterSpacing = "3px";
  const originBottom = drawWrap(ctx, originText, 64, 250, CARD_W - 128, 56, 2);
  ctx.letterSpacing = "0px";

  ctx.font = `500 14px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(168,240,204,0.7)";
  ctx.letterSpacing = "5px";
  ctx.fillText(
    `◯ ${origin.length > 1 ? "NATIVE RANGE" : "NATIVE TO"}`,
    64,
    originBottom + 28,
  );
  ctx.letterSpacing = "0px";

  // — Map block ------------------------------------------------------
  // Same map asset (and pin coordinates) the public Plant Info page uses, so
  // the carousel reads as part of the same visual system.
  const mapTop = originBottom + 64;
  const mapX = 64;
  const mapW = CARD_W - 128;
  const mapAR = ORIGIN_MAP_VIEW_W / ORIGIN_MAP_VIEW_H; // 1.637
  const mapH = Math.round(mapW / mapAR);

  // Backing card so the map sits on its own surface.
  roundRectPath(ctx, mapX, mapTop, mapW, mapH, 22);
  ctx.fillStyle = "rgba(22,39,29,0.7)";
  ctx.fill();
  ctx.strokeStyle = "rgba(91,211,148,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundRectPath(ctx, mapX, mapTop, mapW, mapH, 22);
  ctx.clip();
  const mapImg = originMap || worldMapFallback;
  if (mapImg) {
    ctx.globalAlpha = 0.35;
    drawCoverImage(ctx, mapImg, mapX, mapTop, mapW, mapH);
    ctx.globalAlpha = 1;
  }
  // Plot a glowing pin per recognised origin country.
  const sx = mapW / ORIGIN_MAP_VIEW_W;
  const sy = mapH / ORIGIN_MAP_VIEW_H;
  for (const o of origin) {
    const coords = matchOriginToCoords(o);
    if (!coords) continue;
    const px = mapX + (coords[0] - ORIGIN_MAP_VIEW_X) * sx;
    const py = mapTop + (coords[1] - ORIGIN_MAP_VIEW_Y) * sy;
    // pulse halo
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(91,211,148,0.18)";
    ctx.fill();
    // glow
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(91,211,148,0.32)";
    ctx.fill();
    // pin dot
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = C.mint;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // Origin tags below the map.
  let tagY = mapTop + mapH + 22;
  if (origin.length > 0) {
    let tagX = 64;
    for (const o of origin.slice(0, 4)) {
      const lbl = tidy(o).toUpperCase();
      ctx.font = `700 12px ${FONT_MONO}`;
      const w = ctx.measureText(lbl).width + 28;
      if (tagX + w > CARD_W - 64) break;
      drawChip(ctx, tagX, tagY, lbl, {
        bg: "rgba(91,211,148,0.15)",
        fg: C.mintGlow,
        border: "rgba(91,211,148,0.5)",
        size: 12,
        family: FONT_MONO,
        weight: "700",
        paddingX: 14,
        paddingY: 7,
      });
      tagX += w + 8;
    }
    tagY += 36;
  }

  // — Historical fact callout ---------------------------------------
  if (historicalFact) {
    const factTop = tagY + 12;
    const factX = 64;
    const factW = CARD_W - 128;
    const factH = 280;
    roundRectPath(ctx, factX, factTop, factW, factH, 22);
    ctx.fillStyle = "rgba(245,239,226,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(245,239,226,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eyebrow with tracked accent.
    ctx.fillStyle = C.gold;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "6px";
    ctx.fillText("◇ HISTORICAL · ARCHIVED", factX + 24, factTop + 36);
    ctx.letterSpacing = "0px";

    // Big quote-mark accent.
    ctx.font = `700 110px ${FONT_MONO}`;
    ctx.fillStyle = "rgba(224,178,82,0.18)";
    ctx.fillText('"', factX + 24, factTop + 130);

    // Fact body.
    ctx.fillStyle = C.cream;
    ctx.font = `500 22px ${FONT_MONO}`;
    drawWrap(ctx, historicalFact, factX + 24, factTop + 90, factW - 48, 32, 6);

    // Source line.
    ctx.fillStyle = "rgba(168,240,204,0.6)";
    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.letterSpacing = "5px";
    ctx.fillText("VERIFIED HISTORICAL RECORD", factX + 24, factTop + factH - 24);
    ctx.letterSpacing = "0px";
  } else if (plant) {
    // No fact returned — fall back to a presentation snippet so the card
    // doesn't have a yawning gap.
    const presentation = String(
      (plant as { presentation?: string }).presentation || "",
    ).trim();
    if (presentation) {
      const bx = 64;
      const by = tagY + 24;
      ctx.fillStyle = "rgba(168,240,204,0.5)";
      ctx.font = `600 12px ${FONT_MONO}`;
      ctx.letterSpacing = "5px";
      ctx.fillText("FIELD NOTES", bx, by);
      ctx.letterSpacing = "0px";
      ctx.fillStyle = C.cream;
      ctx.font = `400 20px ${FONT_MONO}`;
      drawWrap(ctx, presentation, bx, by + 36, CARD_W - 128, 28, 4);
    }
  }

  drawBrandFooter(ctx, C.cream, C.mintGlow);
}

// — card 4: WILD CARD CTA ------------------------------------------------

function drawCardWild(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  images: HTMLImageElement[],
  logoWhite: HTMLImageElement | null,
) {
  // Mesh gradient background — multiple radial stops
  ctx.fillStyle = C.forestDeep;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const blobs: Array<{ x: number; y: number; r: number; c: string }> = [
    { x: CARD_W * 0.85, y: CARD_H * 0.18, r: 700, c: "rgba(91,211,148,0.55)" },
    { x: CARD_W * 0.15, y: CARD_H * 0.4, r: 620, c: "rgba(255,138,101,0.32)" },
    { x: CARD_W * 0.6, y: CARD_H * 0.85, r: 800, c: "rgba(168,240,204,0.4)" },
    { x: CARD_W * 0.3, y: CARD_H * 0.95, r: 500, c: "rgba(224,178,82,0.28)" },
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, "rgba(6,18,11,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  // dark overlay to keep text legible
  ctx.fillStyle = "rgba(6,18,11,0.4)";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawBrandHeader(ctx, 4, 4, "DISCOVER", C.cream, C.mintGlow, logoWhite);

  // Photo collage — 5 circular orbs scattered, rotating through every
  // available plant photo so multi-image plants get genuine visual variety.
  if (images.length > 0) {
    const orbs: Array<{ x: number; y: number; r: number; alpha: number }> = [
      { x: 720, y: 360, r: 130, alpha: 0.92 },
      { x: 220, y: 480, r: 95, alpha: 0.78 },
      { x: 880, y: 620, r: 70, alpha: 0.62 },
      { x: 380, y: 720, r: 60, alpha: 0.5 },
      { x: 140, y: 290, r: 50, alpha: 0.45 },
    ];
    orbs.forEach((o, i) => {
      const img = images[i % images.length];
      ctx.save();
      ctx.globalAlpha = o.alpha;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.clip();
      drawCoverImage(ctx, img, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245,239,226,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  // Eyebrow
  ctx.fillStyle = C.mintGlow;
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "10px";
  ctx.fillText("YOUR NEXT PLANT", 64, 220);
  ctx.letterSpacing = "0px";

  // hairline
  ctx.strokeStyle = "rgba(168,240,204,0.5)";
  ctx.beginPath();
  ctx.moveTo(64, 240);
  ctx.lineTo(360, 240);
  ctx.stroke();

  // big stacked headline — uppercase mono with strong tracking
  ctx.fillStyle = C.cream;
  ctx.font = `700 110px ${FONT_MONO}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("DISCOVER", 64, 400);

  ctx.font = `400 110px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(245,239,226,0.65)";
  ctx.fillText("MORE  →", 64, 530);
  ctx.letterSpacing = "0px";

  // sub-headline
  ctx.fillStyle = C.cream;
  ctx.font = `500 22px ${FONT_MONO}`;
  ctx.letterSpacing = "5px";
  ctx.fillText("SWIPE · LEARN · GROW", 64, 600);
  ctx.letterSpacing = "0px";

  // body
  ctx.fillStyle = "rgba(245,239,226,0.78)";
  ctx.font = `400 22px ${FONT_MONO}`;
  drawWrap(
    ctx,
    "A daily encyclopedia of plants — from the windowsill jungle to the wild meadow. Curated cards, real care advice, zero noise.",
    64,
    660,
    700,
    34,
    4,
  );

  // CTA chip
  const ctaY = 1100;
  ctx.font = `700 38px ${FONT_MONO}`;
  const ctaText = "aphylia.app";
  const ctaW = ctx.measureText(ctaText).width + 80;
  roundRectPath(ctx, 64, ctaY, ctaW, 88, 44);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.fillStyle = C.forestDeep;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(ctaText, 64 + 40, ctaY + 46);

  // arrow circle next to chip
  const arrCx = 64 + ctaW + 36;
  const arrCy = ctaY + 44;
  ctx.beginPath();
  ctx.arc(arrCx, arrCy, 44, 0, Math.PI * 2);
  ctx.fillStyle = C.mint;
  ctx.fill();
  ctx.strokeStyle = C.cream;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(arrCx - 14, arrCy);
  ctx.lineTo(arrCx + 14, arrCy);
  ctx.moveTo(arrCx + 4, arrCy - 10);
  ctx.lineTo(arrCx + 14, arrCy);
  ctx.lineTo(arrCx + 4, arrCy + 10);
  ctx.stroke();

  // tiny stat row
  const statsY = 1240;
  const statName = tidy(plant.name || "this plant");
  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(168,240,204,0.7)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "5px";
  ctx.fillText(`FEATURING · ${statName.toUpperCase()}`, 64, statsY);
  ctx.letterSpacing = "0px";

  drawGrain(ctx, CARD_W, CARD_H, 0.04, 700);
}

// — orchestration --------------------------------------------------------

type Bundle = {
  plant: PlantRow;
  variety: string;
  presentation: string;
  origin: string[];
  commonNames: string[];
  colors: ColorRow[];
  /**
   * Up to 4 plant photos, sorted by `use` priority. `images[0]` is the lead
   * (primary/card/cover/hero/thumbnail in that preference). Cards that need a
   * single hero pull `images[0]`; the wild card rotates through all of them
   * in the orb collage so multi-photo plants get visible variety.
   */
  images: HTMLImageElement[];
  worldMap: HTMLImageElement | null;
  /**
   * Pixelated origin map used by the public Plant Info page; same asset, same
   * coordinate system, so card 3's pins line up identically. Null until the
   * remote SVG finishes loading (Card 3 falls back to the local silhouette).
   */
  originMap: HTMLImageElement | null;
  /**
   * AI-generated, verified historical fact about the plant — surfaced on Card
   * 3 (Deep Knowledge). Empty string when generation fails or returns
   * low-confidence output (better to show no fact than a fabricated one).
   */
  historicalFact: string;
  icons: IconSet | null;
  logoWhite: HTMLImageElement | null;
  logoBlack: HTMLImageElement | null;
};

// Country → [x, y] coords in the same SVG viewBox the Plant Info page uses
// (103.51 165.78 → 924, 667). Synced from PlantInfoPage.tsx — keep in sync if
// new entries are added there.
const ORIGIN_MAP_URL =
  "https://media.aphylia.app/UTILITY/admin/uploads/svg/worldlow-pixels-46c63cb3-22eb-45ec-be41-55843a3b1093.svg";
const ORIGIN_MAP_VIEW_X = 103.51;
const ORIGIN_MAP_VIEW_Y = 165.78;
const ORIGIN_MAP_VIEW_W = 820.44;
const ORIGIN_MAP_VIEW_H = 501.3;
const ORIGIN_COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [215.6, 272.1], "United Kingdom": [472.2, 241.3], France: [482.6, 264.6],
  Germany: [502.1, 249.1], Netherlands: [490.4, 249.1], Canada: [259.8, 225.5], Australia: [828.6, 491.3],
  Brazil: [334.6, 444.6], India: [686.5, 336.7], China: [738.3, 296.1], Japan: [825.1, 291.9],
  "South Korea": [801.7, 295.8], Russia: [686.2, 221.3], Italy: [508.5, 272.4], Spain: [473.3, 283.3],
  Mexico: [207.4, 334.4], Argentina: [313.7, 519.8], Sweden: [513.7, 216.2], Norway: [502.1, 215.4],
  Denmark: [498.2, 233.5], Finland: [534.0, 210.2], Poland: [521.5, 245.2], Switzerland: [498.2, 264.6],
  Austria: [513.7, 264.6], Belgium: [490.4, 249.1], Portugal: [459.2, 284.1], Ireland: [459.2, 241.3],
  "Czech Republic": [513.7, 256.9], Czechia: [513.7, 256.9], Romania: [537.1, 266.6], Greece: [537.1, 280.2],
  Turkey: [564.7, 288.0], "South Africa": [542.7, 499.9], Nigeria: [499.0, 379.7], Egypt: [553.4, 326.2],
  Kenya: [579.9, 408.6], Morocco: [461.2, 311.4], Israel: [568.2, 311.4], "Saudi Arabia": [594.2, 333.6],
  "United Arab Emirates": [618.8, 334.7], Thailand: [747.2, 364.3], Vietnam: [758.9, 356.1],
  Indonesia: [801.4, 417.6], Philippines: [801.7, 361.9], Malaysia: [776.4, 400.9],
  Singapore: [776.4, 400.9], "New Zealand": [908.1, 534.5], Colombia: [280.8, 398.6],
  Chile: [298.2, 523.3], Peru: [276.3, 439.8], Ukraine: [550.9, 255.1], Hungary: [521.5, 264.6],
  Croatia: [513.7, 264.6], Bulgaria: [544.9, 272.4], Serbia: [529.3, 272.4], Slovakia: [525.4, 256.9],
  Lithuania: [533.2, 233.5], Latvia: [533.2, 233.5], Estonia: [537.1, 225.7], Iceland: [439.8, 210.2],
  Luxembourg: [490.4, 249.1], Taiwan: [794.0, 334.7], Pakistan: [653.8, 315.2], Bangladesh: [716.1, 334.7],
  "Sri Lanka": [692.8, 381.4], Nepal: [692.8, 319.1], Algeria: [483.9, 321.6], Tunisia: [498.2, 299.7],
  Ghana: [474.8, 385.3], Senegal: [439.8, 365.8], Ethiopia: [583.8, 381.4], Tanzania: [570.3, 430.9],
  "Côte d'Ivoire": [464.0, 385.3], Cameroon: [504.0, 391.0], "Democratic Republic of the Congo": [542.0, 415.0],
  Angola: [524.0, 446.0], Mozambique: [570.0, 470.0], Zimbabwe: [553.0, 468.0], Uganda: [570.3, 408.6],
  Rwanda: [565.0, 415.0], "Ivory Coast": [464.0, 385.3], Mali: [475.0, 355.0], "Burkina Faso": [478.0, 368.0],
  Niger: [500.0, 355.0], Chad: [520.0, 360.0], Sudan: [560.0, 355.0], Libya: [520.0, 320.0],
  Venezuela: [298.0, 381.0], Ecuador: [265.0, 415.0], Bolivia: [304.0, 465.0], Paraguay: [318.0, 480.0],
  Uruguay: [326.0, 508.0], "Costa Rica": [237.0, 370.0], Panama: [250.0, 375.0], Guatemala: [220.0, 350.0],
  Honduras: [230.0, 354.0], "El Salvador": [223.0, 358.0], Nicaragua: [235.0, 362.0], Cuba: [252.0, 330.0],
  "Dominican Republic": [278.0, 338.0], Jamaica: [261.0, 340.0], "Puerto Rico": [286.0, 338.0],
  "Trinidad and Tobago": [298.0, 368.0], Haiti: [273.0, 338.0],
  Iraq: [590.0, 305.0], Iran: [618.0, 308.0], Afghanistan: [644.0, 305.0], Myanmar: [733.0, 348.0],
  Cambodia: [756.0, 370.0], Laos: [750.0, 348.0], "North Korea": [801.0, 280.0], Mongolia: [740.0, 264.0],
  Kazakhstan: [645.0, 260.0], Uzbekistan: [635.0, 275.0], Turkmenistan: [625.0, 285.0],
  Kyrgyzstan: [658.0, 275.0], Tajikistan: [650.0, 285.0], Georgia: [568.0, 275.0], Armenia: [575.0, 280.0],
  Azerbaijan: [580.0, 278.0], Jordan: [568.0, 318.0], Lebanon: [565.0, 305.0], Syria: [573.0, 298.0],
  Kuwait: [600.0, 320.0], Bahrain: [607.0, 325.0], Qatar: [610.0, 328.0], Oman: [620.0, 345.0],
  Yemen: [600.0, 350.0], "Papua New Guinea": [868.0, 430.0], Fiji: [920.0, 465.0],
  Madagascar: [585.0, 470.0], Mauritius: [605.0, 468.0], Réunion: [600.0, 472.0],
  "Bosnia and Herzegovina": [521.0, 272.0], Slovenia: [513.0, 264.0], "North Macedonia": [533.0, 275.0],
  Albania: [529.0, 278.0], Montenegro: [525.0, 274.0], Kosovo: [530.0, 273.0], Moldova: [545.0, 258.0],
  Belarus: [540.0, 240.0], "Hong Kong": [778.0, 332.0], Macau: [775.0, 335.0],
};

function normalizeCountryName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_ORIGIN_COORDS: Array<{ normalized: string; coords: [number, number] }> =
  Object.entries(ORIGIN_COUNTRY_COORDS).map(([country, coords]) => ({
    normalized: normalizeCountryName(country),
    coords,
  }));

function matchOriginToCoords(origin: string): [number, number] | null {
  const trimmed = origin.trim();
  if (ORIGIN_COUNTRY_COORDS[trimmed]) return ORIGIN_COUNTRY_COORDS[trimmed];
  const base = trimmed.replace(/\s*\(.*?\)\s*$/, "").trim();
  if (ORIGIN_COUNTRY_COORDS[base]) return ORIGIN_COUNTRY_COORDS[base];
  const norm = normalizeCountryName(base);
  for (const entry of NORMALIZED_ORIGIN_COORDS) {
    if (entry.normalized === norm) return entry.coords;
  }
  for (const entry of NORMALIZED_ORIGIN_COORDS) {
    if (entry.normalized.includes(norm) || norm.includes(entry.normalized)) {
      return entry.coords;
    }
  }
  return null;
}

// Pick the first defined image from the bundle, falling back through the array
// so an off-by-one (e.g. plant has only 1 image, identity wants index 1) still
// renders something instead of leaving a hole.
function pickImage(images: HTMLImageElement[], preferred: number): HTMLImageElement | null {
  if (preferred < images.length) return images[preferred];
  return images[0] ?? null;
}

async function renderCardCanvas(
  index: number,
  b: Bundle,
): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  switch (index) {
    case 0:
      // Cover always leads with the primary photo.
      drawCardCover(
        ctx,
        b.plant,
        pickImage(b.images, 0),
        b.variety,
        b.icons,
        b.logoWhite,
        b.origin,
      );
      break;
    case 1:
      // Identity uses the second photo when available so it doesn't repeat
      // the cover; falls back to the primary on single-photo plants.
      drawCardIdentity(
        ctx,
        b.plant,
        pickImage(b.images, 1),
        b.colors,
        b.commonNames,
        b.icons,
        b.logoBlack,
      );
      break;
    case 2:
      drawCardDeep(
        ctx,
        b.plant,
        b.origin,
        b.worldMap,
        b.originMap,
        b.historicalFact,
        b.logoWhite,
      );
      break;
    case 3:
      // Wild card rotates through every available image in the orb collage.
      drawCardWild(ctx, b.plant, b.images, b.logoWhite);
      break;
  }
  return c;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png", 1),
  );
}

// — component ------------------------------------------------------------

const CARD_LABELS = ["Cover", "Identity", "Deep Knowledge", "Wild Card"] as const;

export function AdminExportPanel() {
  const [picked, setPicked] = React.useState<SearchItemOption | null>(null);
  const [options, setOptions] = React.useState<SearchItemOption[]>([]);
  const [bundle, setBundle] = React.useState<Bundle | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [worldMap, setWorldMap] = React.useState<HTMLImageElement | null>(null);
  // The pixelated world map used by the public Plant Info page. Loaded once
  // and shared with Card 3's origin map. Falls through to the existing
  // worldMapDarkUrl fallback if the asset can't be fetched (CORS, offline).
  const [originMap, setOriginMap] = React.useState<HTMLImageElement | null>(null);
  const [icons, setIcons] = React.useState<IconSet | null>(null);
  const [logoWhite, setLogoWhite] = React.useState<HTMLImageElement | null>(null);
  const [logoBlack, setLogoBlack] = React.useState<HTMLImageElement | null>(null);
  const previewRefs = React.useRef<Array<HTMLCanvasElement | null>>([]);

  // Preload static assets once: world map silhouette, fonts, the Aphylia logo
  // glyphs (white + black variants for dark/light cards), and every Lucide
  // icon the cards draw. All rasterized to HTMLImageElement so the canvas can
  // ctx.drawImage them like any plant photo.
  React.useEffect(() => {
    let cancelled = false;
    void ensureFontsReady();
    void loadImage(worldMapDarkUrl, { crossOrigin: null }).then((img) => {
      if (!cancelled) setWorldMap(img);
    });
    // Plant Info's pixelated origin map. Goes through loadCanvasImage so a
    // missing CORS header on media.aphylia.app falls back to /api/image-proxy.
    void loadCanvasImage(ORIGIN_MAP_URL).then((img) => {
      if (!cancelled) setOriginMap(img);
    });
    void loadImage("/icons/icon-500_transparent_white.png", { crossOrigin: null }).then(
      (img) => {
        if (!cancelled) setLogoWhite(img);
      },
    );
    void loadImage("/icons/icon-500_transparent_black.png", { crossOrigin: null }).then(
      (img) => {
        if (!cancelled) setLogoBlack(img);
      },
    );
    void (async () => {
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
        sunCream,
      ] = await Promise.all([
        lucideImage(Sun, C.gold, 64, 2.4),
        lucideImage(Sun, "rgba(21,32,26,0.18)", 64, 2),
        lucideImage(Droplet, C.mint, 64, 2.4),
        lucideImage(Droplet, "rgba(21,32,26,0.18)", 64, 2),
        lucideImage(Wind, C.ink, 64, 2),
        lucideImage(Palette, C.ink, 64, 2),
        lucideImage(Sprout, C.ink, 64, 2),
        lucideImage(Sprout, C.cream, 64, 2),
        lucideImage(AlertTriangle, C.warning, 64, 2.4),
        lucideImage(MapPin, C.cream, 64, 2.2),
        lucideImage(Leaf, C.ink, 64, 2),
        lucideImage(Thermometer, C.ink, 64, 2),
        lucideImage(Clock, C.ink, 64, 2),
        lucideImage(Ruler, C.ink, 64, 2),
        lucideImage(Sun, C.cream, 64, 2.2),
      ]);
      if (cancelled) return;
      setIcons({
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
        sunCream,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchPlants = React.useCallback(
    async (query: string): Promise<SearchItemOption[]> => {
      // Hide in-progress plants — they're missing the fields the cards rely on
      // (colors, watering frequencies, family, origin, …) so the export comes
      // out with a lot of em-dashes. `or(status.is.null,status.neq.in_progress)`
      // also keeps legacy rows where status was never set.
      let q = supabase
        .from("plants")
        .select("id,name,scientific_name_species,status")
        .or("status.is.null,status.neq.in_progress")
        .order("name")
        .limit(30);
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      const { data } = await q;
      if (!data?.length) {
        setOptions([]);
        return [];
      }
      const ids = (data as PlantRow[]).map((p) => p.id as string);
      const { data: imgs } = await supabase
        .from("plant_images")
        .select("plant_id,link")
        .in("plant_id", ids)
        .eq("use", "primary");
      const map = new Map(
        ((imgs as { plant_id: string; link: string }[]) || []).map((i) => [
          i.plant_id,
          i.link,
        ]),
      );
      const rows: SearchItemOption[] = (data as PlantRow[]).map((p) => ({
        id: p.id as string,
        label: (p.name as string) || "Unknown",
        description: (p.scientific_name_species as string) || "",
        icon: map.get(p.id as string) ? (
          <img
            src={map.get(p.id as string) as string}
            className="h-9 w-9 rounded object-cover"
            alt=""
          />
        ) : undefined,
      }));
      setOptions(rows);
      return rows;
    },
    [],
  );

  const generate = React.useCallback(async () => {
    if (!picked?.id) return;
    setLoading(true);
    try {
      const { data: plantData } = await supabase
        .from("plants")
        .select("*")
        .eq("id", picked.id)
        .single();
      if (!plantData) {
        setBundle(null);
        return;
      }
      const plant = plantData as PlantRow;

      const [
        imgsRes,
        translationsRes,
        colorLinksRes,
      ] = await Promise.all([
        supabase
          .from("plant_images")
          .select("link, use")
          .eq("plant_id", picked.id),
        supabase
          .from("plant_translations")
          .select("language, variety, presentation, common_names, origin")
          .eq("plant_id", picked.id),
        supabase
          .from("plant_colors")
          .select("color_id, colors:color_id (name, hex_code)")
          .eq("plant_id", picked.id),
      ]);

      const translations = (translationsRes.data || []) as Translation[];
      const tEn =
        translations.find((t) => (t.language || "").toLowerCase() === "en") ||
        translations[0] ||
        null;
      const variety = (tEn?.variety || "").trim();
      const presentation = (tEn?.presentation || "").trim();
      const origin: string[] =
        tEn && Array.isArray(tEn.origin)
          ? tEn.origin.map(tidy).filter(Boolean)
          : [];
      const commonNames: string[] =
        tEn && Array.isArray(tEn.common_names)
          ? tEn.common_names.map(tidy).filter(Boolean)
          : [];

      const colorLinks =
        (colorLinksRes.data as Array<{ colors: ColorRow | ColorRow[] | null }>) ||
        [];
      const colors: ColorRow[] = colorLinks
        .map((l) => (Array.isArray(l.colors) ? l.colors[0] : l.colors))
        .filter((c): c is ColorRow => !!c && !!c.hex_code);

      // Sort plant_images by use-priority so the lead photo is the strongest
      // candidate (primary first, then card/cover/hero/thumbnail, then any).
      // Take the top 4 to load in parallel — that's enough variety for the
      // wild-card collage without bloating the export beyond what feed posts
      // need.
      const USE_PRIORITY: Record<string, number> = {
        primary: 0,
        card: 1,
        cover: 2,
        hero: 3,
        thumbnail: 4,
      };
      const rawImgs =
        ((imgsRes.data as Array<{ link: string; use: string | null }> | null) ||
          [])
          .filter((r) => !!r?.link)
          .sort(
            (a, b) =>
              (USE_PRIORITY[a.use ?? ""] ?? 99) -
              (USE_PRIORITY[b.use ?? ""] ?? 99),
          )
          .slice(0, 4);
      // Fire image loads + AI fact in parallel so the slow OpenAI hop
      // overlaps with the network round-trips for the photos.
      const plantNameStr = String(plant.name || "").trim();
      const sciNameStr = String(plant.scientific_name_species || "").trim();
      const familyStr = String(plant.family || "").trim();
      const [loaded, historicalFact] = await Promise.all([
        Promise.all(rawImgs.map((r) => loadCanvasImage(r.link))),
        fetchHistoricalFact(plantNameStr, sciNameStr, familyStr),
      ]);
      const images = loaded.filter((i): i is HTMLImageElement => !!i);

      setBundle({
        plant,
        variety,
        presentation,
        origin,
        commonNames,
        colors,
        images,
        worldMap,
        originMap,
        historicalFact,
        icons,
        logoWhite,
        logoBlack,
      });
    } finally {
      setLoading(false);
    }
  }, [picked, worldMap, originMap, icons, logoWhite, logoBlack]);

  // Splice late-loading static assets back into the active bundle so the
  // previews repaint when icons/logos/maps finish loading after generate.
  React.useEffect(() => {
    if (!bundle) return;
    let changed = false;
    const next = { ...bundle };
    if (worldMap && bundle.worldMap !== worldMap) {
      next.worldMap = worldMap;
      changed = true;
    }
    if (originMap && bundle.originMap !== originMap) {
      next.originMap = originMap;
      changed = true;
    }
    if (icons && bundle.icons !== icons) {
      next.icons = icons;
      changed = true;
    }
    if (logoWhite && bundle.logoWhite !== logoWhite) {
      next.logoWhite = logoWhite;
      changed = true;
    }
    if (logoBlack && bundle.logoBlack !== logoBlack) {
      next.logoBlack = logoBlack;
      changed = true;
    }
    if (changed) setBundle(next);
  }, [worldMap, originMap, icons, logoWhite, logoBlack, bundle]);

  // Single source of truth for preview rendering. Re-fires whenever the bundle
  // changes — including after the worldMap effect above splices in the map.
  // Runs in an effect so React has mounted the canvas refs before we draw.
  React.useEffect(() => {
    if (!bundle) return;
    let cancelled = false;
    void (async () => {
      await ensureFontsReady();
      if (cancelled) return;
      for (let i = 0; i < 4; i++) {
        if (cancelled) return;
        const target = previewRefs.current[i];
        if (!target) continue;
        const off = await renderCardCanvas(i, bundle);
        if (cancelled) return;
        const tctx = target.getContext("2d");
        if (tctx) {
          tctx.clearRect(0, 0, target.width, target.height);
          tctx.drawImage(off, 0, 0, target.width, target.height);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const exportZip = React.useCallback(async () => {
    if (!bundle) return;
    setExporting(true);
    try {
      await ensureFontsReady();
      const zip = new JSZip();
      const stem = slug(String(bundle.plant.name || "plant"));
      for (let i = 0; i < 4; i++) {
        const c = await renderCardCanvas(i, bundle);
        const blob = await canvasToBlob(c);
        zip.file(
          `${String(i + 1).padStart(2, "0")}-${slug(CARD_LABELS[i])}-${stem}.png`,
          blob,
        );
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      a.download = `${stem}-aphylia-cards.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } finally {
      setExporting(false);
    }
  }, [bundle]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 bg-white/90 dark:bg-[#17171a]">
        <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">
          Plant Export Studio · 1080×1350
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <SearchItem
            value={picked?.id ?? null}
            onSelect={setPicked}
            onSearch={searchPlants}
            options={options}
            initialOption={picked}
            placeholder="Pick a plant"
            title="Search plants by name"
            description="Select a plant — we generate four Instagram-ready cards"
            searchPlaceholder="Search plants by name"
            className="min-w-[280px]"
          />
          <Button onClick={() => void generate()} disabled={!picked || loading}>
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <WandSparkles className="h-4 w-4 mr-2" />
            )}
            {loading ? "Generating…" : "Generate cards"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void generate()}
            disabled={!bundle || loading}
            title="Regenerate previews"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => void exportZip()} disabled={!bundle || exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Packing…" : "Download .zip"}
          </Button>
        </div>
      </div>

      {bundle && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="rounded-2xl overflow-hidden bg-black/30 border border-stone-700/30 shadow-xl">
                <canvas
                  ref={(el) => {
                    previewRefs.current[i] = el;
                  }}
                  width={CARD_W}
                  height={CARD_H}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-mono tracking-[0.2em] uppercase">
                  {String(i + 1).padStart(2, "0")} · {CARD_LABELS[i]}
                </span>
                <span className="font-mono opacity-70">1080×1350</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
