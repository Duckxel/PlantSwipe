import * as React from "react";
import JSZip from "jszip";
import { Download, Sparkles, WandSparkles, RefreshCw } from "lucide-react";
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

function drawSunGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  level: number,
  fillColor = C.gold,
  emptyColor = "rgba(0,0,0,0.08)",
) {
  const r = 13;
  const gap = 30;
  for (let i = 0; i < 5; i++) {
    const cx = x + r + i * (r * 2 + gap);
    const filled = i < level;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fillStyle = filled ? fillColor : emptyColor;
    ctx.fill();
    if (filled) {
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const r1 = r + 5;
        const r2 = r + 13;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
        ctx.lineTo(cx + Math.cos(ang) * r2, y + Math.sin(ang) * r2);
        ctx.stroke();
      }
    }
  }
}

function drawDropGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  level: number,
  fillColor = C.mint,
  emptyColor = "rgba(0,0,0,0.18)",
) {
  const w = 22,
    h = 30,
    gap = 20;
  for (let i = 0; i < 5; i++) {
    const dx = x + i * (w + gap);
    const cx = dx + w / 2;
    ctx.beginPath();
    ctx.moveTo(cx, y - h / 2);
    ctx.bezierCurveTo(dx + w, y - h / 6, dx + w, y + h / 2, cx, y + h / 2);
    ctx.bezierCurveTo(dx, y + h / 2, dx, y - h / 6, cx, y - h / 2);
    ctx.closePath();
    if (i < level) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    } else {
      ctx.strokeStyle = emptyColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
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
) {
  const padX = 64;
  const top = 64;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fg;
  ctx.font = `700 30px ${FONT_MONO}`;
  ctx.fillText("Aphylia", padX, top + 28);

  // dot
  ctx.beginPath();
  ctx.arc(padX + ctx.measureText("Aphylia").width + 16, top + 18, 4, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // page indicator right
  ctx.fillStyle = fg;
  ctx.font = `600 16px ${FONT_MONO}`;
  ctx.textAlign = "right";
  const indicator = `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")} · ${label}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(indicator, CARD_W - padX, top + 26);
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

function drawCardCover(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  hero: HTMLImageElement | null,
  variety: string,
) {
  // Base
  ctx.fillStyle = C.forestDeep;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Layer 1: blurred backdrop image, oversized
  if (hero) {
    ctx.save();
    if ("filter" in ctx) {
      (ctx as CanvasRenderingContext2D & { filter: string }).filter =
        "blur(40px) saturate(1.1)";
    }
    drawCoverImage(ctx, hero, -80, -80, CARD_W + 160, CARD_H + 160);
    if ("filter" in ctx) {
      (ctx as CanvasRenderingContext2D & { filter: string }).filter = "none";
    }
    ctx.restore();

    // forest tint to keep palette cohesive
    ctx.fillStyle = "rgba(11,26,18,0.55)";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  // Layer 2: sharp framed hero
  if (hero) {
    const px = 96;
    const py = 240;
    const fw = CARD_W - px * 2;
    const fh = 660;
    ctx.save();
    // soft shadow
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    roundRectPath(ctx, px, py, fw, fh, 36);
    ctx.fillStyle = C.forestDeep;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, px, py, fw, fh, 36);
    ctx.clip();
    drawCoverImage(ctx, hero, px, py, fw, fh);
    // bottom gradient inside frame for legibility
    const g = ctx.createLinearGradient(0, py + fh - 200, 0, py + fh);
    g.addColorStop(0, "rgba(6,18,11,0)");
    g.addColorStop(1, "rgba(6,18,11,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(px, py + fh - 200, fw, 200);
    ctx.restore();

    // hairline border on the frame
    roundRectPath(ctx, px, py, fw, fh, 36);
    ctx.strokeStyle = "rgba(245,239,226,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawBrandHeader(ctx, 1, 4, "COVER", C.cream, C.mint);

  // Bottom-bottom: bottom of card holds title/variety/family
  const titleAreaTop = 940;

  // small eyebrow
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.fillStyle = C.mintGlow;
  ctx.letterSpacing = "8px";
  ctx.fillText("PLANT STUDIO · 01", CARD_W / 2, titleAreaTop);
  ctx.letterSpacing = "0px";

  // title — auto-fit. Fira Code is wide; cap at 92px and uppercase for impact.
  const nameRaw = tidy(plant.name || "Plant");
  const name = nameRaw.toUpperCase();
  const titleSize = fitText(ctx, name, CARD_W - 200, 92, 48, "700", FONT_MONO);
  ctx.font = `700 ${titleSize}px ${FONT_MONO}`;
  ctx.fillStyle = C.cream;
  ctx.textAlign = "center";
  ctx.letterSpacing = "4px";
  ctx.fillText(name, CARD_W / 2, titleAreaTop + titleSize + 36);
  ctx.letterSpacing = "0px";

  // variety pill (italic) — only if present
  const variantTextRaw = variety && variety.trim() ? variety.trim() : "";
  if (variantTextRaw) {
    const variantText = `'${variantTextRaw}'`;
    ctx.font = `400 32px ${FONT_MONO}`;
    const tw = ctx.measureText(variantText).width + 56;
    const ty = titleAreaTop + titleSize + 84;
    roundRectPath(ctx, (CARD_W - tw) / 2, ty, tw, 60, 30);
    ctx.fillStyle = "rgba(245,239,226,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(168,240,204,0.45)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.textBaseline = "middle";
    ctx.fillText(variantText, CARD_W / 2, ty + 32);
  } else {
    // sci name fallback
    const sci = String(plant.scientific_name_species || "");
    if (sci) {
      ctx.font = `400 30px ${FONT_MONO}`;
      ctx.fillStyle = "rgba(245,239,226,0.7)";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(sci, CARD_W / 2, titleAreaTop + titleSize + 100);
    }
  }

  // family chip
  const family = tidy(plant.family || "");
  if (family) {
    ctx.font = `600 14px ${FONT_MONO}`;
    const lbl = `FAMILY · ${family.toUpperCase()}`;
    const cw = ctx.measureText(lbl).width + 36;
    const cy = CARD_H - 158;
    roundRectPath(ctx, (CARD_W - cw) / 2, cy, cw, 42, 21);
    ctx.fillStyle = "rgba(91,211,148,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(91,211,148,0.55)";
    ctx.stroke();
    ctx.fillStyle = C.mintGlow;
    ctx.textBaseline = "middle";
    ctx.fillText(lbl, (CARD_W - cw) / 2 + 18, cy + 22);
  }

  // corner ticks (decorative)
  ctx.strokeStyle = "rgba(245,239,226,0.35)";
  ctx.lineWidth = 1.5;
  const t = 28;
  const inset = 36;
  ctx.beginPath();
  // TL
  ctx.moveTo(inset, inset + t);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + t, inset);
  // TR
  ctx.moveTo(CARD_W - inset - t, inset);
  ctx.lineTo(CARD_W - inset, inset);
  ctx.lineTo(CARD_W - inset, inset + t);
  // BL
  ctx.moveTo(inset, CARD_H - inset - t);
  ctx.lineTo(inset, CARD_H - inset);
  ctx.lineTo(inset + t, CARD_H - inset);
  // BR
  ctx.moveTo(CARD_W - inset - t, CARD_H - inset);
  ctx.lineTo(CARD_W - inset, CARD_H - inset);
  ctx.lineTo(CARD_W - inset, CARD_H - inset - t);
  ctx.stroke();

  drawGrain(ctx, CARD_W, CARD_H, 0.05, 800);
  drawBrandFooter(ctx, C.cream, C.mint);
}

// — card 2: IDENTITY -----------------------------------------------------

function drawCardIdentity(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  hero: HTMLImageElement | null,
  colors: ColorRow[],
) {
  // Paper
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // subtle vertical paper gradient
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(0,0,0,0.04)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawBrandHeader(ctx, 2, 4, "IDENTITY", C.ink, C.mintDim);

  // hero image circle (top-right)
  if (hero) {
    const r = 200;
    const cx = CARD_W - 220;
    const cy = 270;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
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
    const sz = r * 2;
    drawCoverImage(ctx, hero, cx - r, cy - r, sz, sz);
    ctx.restore();

    // ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = C.mintDim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Title block
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.inkDim;
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("IDENTITY", 64, 200);
  ctx.letterSpacing = "0px";

  const name = tidy(plant.name || "Plant").toUpperCase();
  const nameSize = fitText(ctx, name, 600, 64, 36, "700", FONT_MONO);
  ctx.font = `700 ${nameSize}px ${FONT_MONO}`;
  ctx.fillStyle = C.ink;
  ctx.letterSpacing = "3px";
  const titleY = 200 + nameSize + 24;
  ctx.fillText(name, 64, titleY);
  ctx.letterSpacing = "0px";

  // scientific name
  const sci = String(plant.scientific_name_species || "").trim();
  let chipsY = titleY + 56;
  if (sci) {
    ctx.font = `400 24px ${FONT_MONO}`;
    ctx.fillStyle = C.inkDim;
    ctx.fillText(sci, 64, titleY + 40);
    chipsY = titleY + 80;
  }

  // family chip + plant_type chip
  const family = tidy(plant.family || "");
  const plantType = tidy(plant.plant_type || "");
  let cursorX = 64;
  if (family) {
    const sz = drawChip(ctx, cursorX, chipsY, family.toUpperCase(), {
      bg: C.ink,
      fg: C.cream,
      size: 13,
      family: FONT_MONO,
      weight: "700",
      paddingX: 16,
      paddingY: 8,
    });
    cursorX += sz.width + 12;
  }
  if (plantType) {
    drawChip(ctx, cursorX, chipsY, plantType.toUpperCase(), {
      bg: "transparent",
      fg: C.ink,
      border: C.ink,
      size: 13,
      family: FONT_MONO,
      weight: "700",
      paddingX: 16,
      paddingY: 8,
    });
  }

  // — Stat rows below ---------------------------------------------------
  const rowsTop = 590;
  const rowH = 130;
  const rowX = 64;
  const rowW = CARD_W - 128;

  // helper to draw a stat row
  const drawStatRow = (
    i: number,
    label: string,
    drawValue: (yMid: number) => void,
  ) => {
    const y = rowsTop + i * rowH;
    // subtle divider
    ctx.strokeStyle = "rgba(21,32,26,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rowX, y);
    ctx.lineTo(rowX + rowW, y);
    ctx.stroke();

    ctx.fillStyle = C.inkDim;
    ctx.font = `600 14px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "4px";
    ctx.fillText(label.toUpperCase(), rowX, y + 36);
    ctx.letterSpacing = "0px";

    drawValue(y + rowH / 2 + 12);
  };

  // ROW 1: Sun
  const sun = sunLevel(asArr(plant.sunlight));
  drawStatRow(0, "Sun Needs", (yMid) => {
    drawSunGauge(ctx, rowX + 360, yMid - 6, sun);
    ctx.fillStyle = C.ink;
    ctx.font = `700 24px ${FONT_MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(
      tidy(asArr(plant.sunlight)[0] || "—"),
      rowX + rowW,
      yMid + 4,
    );
  });

  // ROW 2: Water
  const water = waterLevel(plant);
  const warmFreq = Number(plant.watering_frequency_warm) || 0;
  drawStatRow(1, "Water Needs", (yMid) => {
    drawDropGauge(ctx, rowX + 360, yMid - 6, water);
    ctx.fillStyle = C.ink;
    ctx.font = `700 24px ${FONT_MONO}`;
    ctx.textAlign = "right";
    const label = warmFreq > 0 ? `${warmFreq}× / week` : "—";
    ctx.fillText(label, rowX + rowW, yMid + 4);
  });

  // ROW 3: Humidity
  const hyg = Number(plant.hygrometry) || 0;
  drawStatRow(2, "Humidity", (yMid) => {
    // bar
    const bx = rowX + 360;
    const by = yMid - 12;
    const bw = 380;
    const bh = 24;
    roundRectPath(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = "rgba(21,32,26,0.08)";
    ctx.fill();
    if (hyg > 0) {
      const pct = Math.max(0, Math.min(1, hyg / 100));
      roundRectPath(ctx, bx, by, bw * pct, bh, bh / 2);
      const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
      grad.addColorStop(0, C.mint);
      grad.addColorStop(1, C.mintDim);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.fillStyle = C.ink;
    ctx.font = `700 24px ${FONT_MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(hyg > 0 ? `${hyg}%` : "—", rowX + rowW, yMid + 4);
  });

  // ROW 4: Colors
  drawStatRow(3, "Signature Colors", (yMid) => {
    drawColorSwatches(
      ctx,
      rowX + 360,
      yMid - 4,
      colors,
      "rgba(21,32,26,0.25)",
      C.inkDim,
    );
    if (colors.length) {
      ctx.fillStyle = C.ink;
      ctx.font = `700 24px ${FONT_MONO}`;
      ctx.textAlign = "right";
      ctx.fillText(
        colors.length === 1
          ? tidy(colors[0].name || "")
          : `${colors.length} hues`,
        rowX + rowW,
        yMid + 4,
      );
    }
  });

  // ROW 5: Care level
  const care = tidy(asArr(plant.care_level)[0] || "");
  drawStatRow(4, "Care Level", (yMid) => {
    if (care) {
      const careColor =
        care.toLowerCase().includes("easy")
          ? C.mintDim
          : care.toLowerCase().includes("complex")
            ? C.coral
            : C.gold;
      ctx.font = `700 22px ${FONT_MONO}`;
      const w = ctx.measureText(care.toUpperCase()).width + 36;
      const cx = rowX + 360;
      const cy = yMid - 22;
      roundRectPath(ctx, cx, cy, w, 44, 22);
      ctx.fillStyle = careColor;
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(care.toUpperCase(), cx + 18, cy + 22);

      // toxicity (only when meaningful)
      const toxRaw = String(plant.toxicity_pets || plant.toxicity_human || "");
      const toxLow = toxRaw.toLowerCase();
      if (
        toxLow &&
        !toxLow.includes("non_toxic") &&
        !toxLow.includes("non-toxic") &&
        !toxLow.includes("undetermined")
      ) {
        const tox = tidy(toxRaw);
        ctx.font = `500 18px ${FONT_MONO}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        const isDanger = /toxic|deadly|severe|high/.test(toxLow);
        ctx.fillStyle = isDanger ? C.warning : C.inkDim;
        ctx.fillText(`${isDanger ? "⚠ " : ""}${tox}`, rowX + rowW, yMid + 4);
      }
    } else {
      ctx.fillStyle = C.inkDim;
      ctx.font = `500 22px ${FONT_MONO}`;
      ctx.textAlign = "left";
      ctx.fillText("—", rowX + 360, yMid + 4);
    }
  });

  // closing divider
  ctx.strokeStyle = "rgba(21,32,26,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rowX, rowsTop + 5 * rowH);
  ctx.lineTo(rowX + rowW, rowsTop + 5 * rowH);
  ctx.stroke();

  drawBrandFooter(ctx, C.ink, C.mintDim);
}

// — card 3: DEEP KNOWLEDGE ----------------------------------------------

function drawCardDeep(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  origin: string[],
  worldMap: HTMLImageElement | null,
  presentation: string,
) {
  // Background
  ctx.fillStyle = C.forest;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // soft radial vignette
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

  // World map silhouette behind origin
  if (worldMap) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    const mw = CARD_W - 120;
    const mh = mw / 2; // SVG is 1024×512
    drawCoverImage(ctx, worldMap, 60, 280, mw, mh);
    ctx.restore();
  }

  drawBrandHeader(ctx, 3, 4, "ORIGIN", C.cream, C.mint);

  // eyebrow
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.mint;
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("DEEP KNOWLEDGE", 64, 200);
  ctx.letterSpacing = "0px";

  // hairline
  ctx.strokeStyle = "rgba(91,211,148,0.5)";
  ctx.beginPath();
  ctx.moveTo(64, 215);
  ctx.lineTo(290, 215);
  ctx.stroke();

  // ORIGIN — uppercase mono with wrapping
  const originText = (
    origin.length ? joinPretty(origin, " · ", 2) : "Cultivated Worldwide"
  ).toUpperCase();
  ctx.font = `700 56px ${FONT_MONO}`;
  ctx.fillStyle = C.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "3px";
  const originBottom = drawWrap(ctx, originText, 64, 290, CARD_W - 128, 70, 3);
  ctx.letterSpacing = "0px";

  // pinpoint coordinates-style row
  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(168,240,204,0.7)";
  ctx.letterSpacing = "5px";
  ctx.fillText(
    `◯ ${origin.length > 1 ? "NATIVE RANGE" : "NATIVE TO"}`,
    64,
    originBottom + 36,
  );
  ctx.letterSpacing = "0px";

  // Stats grid 2 × 3
  const gridTop = 700;
  const gx = 64;
  const gw = (CARD_W - 128 - 24) / 2;
  const gh = 145;
  const gap = 24;

  const climate = joinPretty(asArr(plant.climate));
  const lifecycle = joinPretty(asArr(plant.life_cycle));
  const foliage = joinPretty(asArr(plant.foliage_persistence));
  const heightCm = Number(plant.height_cm) || 0;
  const heightStr =
    heightCm > 0
      ? heightCm >= 100
        ? `${(heightCm / 100).toFixed(heightCm >= 1000 ? 0 : 1)} m`
        : `${heightCm} cm`
      : "—";
  const wingCm = Number(plant.wingspan_cm) || 0;
  const wingStr =
    wingCm > 0
      ? wingCm >= 100
        ? `${(wingCm / 100).toFixed(wingCm >= 1000 ? 0 : 1)} m`
        : `${wingCm} cm`
      : "—";
  const tMin = plant.temperature_min;
  const tMax = plant.temperature_max;
  const tempStr =
    tMin != null && tMax != null
      ? `${tMin}° / ${tMax}°C`
      : tMin != null
        ? `min ${tMin}°C`
        : tMax != null
          ? `max ${tMax}°C`
          : "—";

  const cells: Array<{ k: string; v: string }> = [
    { k: "Climate", v: climate },
    { k: "Life Cycle", v: lifecycle },
    { k: "Foliage", v: foliage },
    { k: "Height", v: heightStr },
    { k: "Wingspan", v: wingStr },
    { k: "Temperature", v: tempStr },
  ];

  cells.forEach((cell, i) => {
    const cx = gx + (i % 2) * (gw + gap);
    const cy = gridTop + Math.floor(i / 2) * (gh + gap);
    roundRectPath(ctx, cx, cy, gw, gh, 18);
    ctx.fillStyle = "rgba(22,39,29,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(91,211,148,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = C.mint;
    ctx.font = `600 13px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.letterSpacing = "5px";
    ctx.fillText(cell.k.toUpperCase(), cx + 22, cy + 36);
    ctx.letterSpacing = "0px";

    const valSize = fitText(
      ctx,
      cell.v,
      gw - 44,
      32,
      18,
      "700",
      FONT_MONO,
    );
    ctx.font = `700 ${valSize}px ${FONT_MONO}`;
    ctx.fillStyle = C.cream;
    ctx.fillText(cell.v, cx + 22, cy + 90);
  });

  // Bottom: presentation snippet (italic serif)
  if (presentation) {
    const bx = 64;
    const by = gridTop + 3 * (gh + gap) + 16;
    ctx.fillStyle = "rgba(168,240,204,0.5)";
    ctx.font = `600 12px ${FONT_MONO}`;
    ctx.letterSpacing = "5px";
    ctx.fillText("FIELD NOTES", bx, by);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = C.cream;
    ctx.font = `400 22px ${FONT_MONO}`;
    drawWrap(ctx, `"${presentation}"`, bx, by + 36, CARD_W - 128, 30, 3);
  }

  drawBrandFooter(ctx, C.cream, C.mintGlow);
}

// — card 4: WILD CARD CTA ------------------------------------------------

function drawCardWild(
  ctx: CanvasRenderingContext2D,
  plant: PlantRow,
  images: HTMLImageElement[],
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

  drawBrandHeader(ctx, 4, 4, "DISCOVER", C.cream, C.mintGlow);

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
  colors: ColorRow[];
  /**
   * Up to 4 plant photos, sorted by `use` priority. `images[0]` is the lead
   * (primary/card/cover/hero/thumbnail in that preference). Cards that need a
   * single hero pull `images[0]`; the wild card rotates through all of them
   * in the orb collage so multi-photo plants get visible variety.
   */
  images: HTMLImageElement[];
  worldMap: HTMLImageElement | null;
};

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
      drawCardCover(ctx, b.plant, pickImage(b.images, 0), b.variety);
      break;
    case 1:
      // Identity uses the second photo when available so it doesn't repeat
      // the cover; falls back to the primary on single-photo plants.
      drawCardIdentity(ctx, b.plant, pickImage(b.images, 1), b.colors);
      break;
    case 2:
      drawCardDeep(ctx, b.plant, b.origin, b.worldMap, b.presentation);
      break;
    case 3:
      // Wild card rotates through every available image in the orb collage.
      drawCardWild(ctx, b.plant, b.images);
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
  const previewRefs = React.useRef<Array<HTMLCanvasElement | null>>([]);

  // preload world map silhouette + warm fonts once
  React.useEffect(() => {
    let cancelled = false;
    void ensureFontsReady();
    void loadImage(worldMapDarkUrl, { crossOrigin: null }).then((img) => {
      if (!cancelled) setWorldMap(img);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchPlants = React.useCallback(
    async (query: string): Promise<SearchItemOption[]> => {
      let q = supabase
        .from("plants")
        .select("id,name,scientific_name_species")
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
      const loaded = await Promise.all(
        rawImgs.map((r) => loadCanvasImage(r.link)),
      );
      const images = loaded.filter(
        (i): i is HTMLImageElement => !!i,
      );

      setBundle({ plant, variety, presentation, origin, colors, images, worldMap });
    } finally {
      setLoading(false);
    }
  }, [picked, worldMap]);

  // Splice in the world-map silhouette once it finishes loading after generate.
  React.useEffect(() => {
    if (!bundle || !worldMap || bundle.worldMap === worldMap) return;
    setBundle({ ...bundle, worldMap });
  }, [worldMap, bundle]);

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
