// Shared, platform-agnostic Aphylia card-renderer. Both the in-app
// Admin Export Studio (browser HTMLCanvasElement) and the server-side
// cron job that posts to Buffer (@napi-rs/canvas in Node) consume this
// module so the two surfaces always emit identical bytes for the same
// plant.
//
// The module knows nothing about how images are loaded or how the final
// canvas is serialised — those steps are platform-specific and stay with
// the caller. It only consumes:
//   - a 2D context (`ctx`) that follows the standard Canvas API,
//   - already-decoded image objects (browser HTMLImageElement or
//     @napi-rs/canvas Image — both work with ctx.drawImage),
//   - a `createCanvas(w, h)` factory used to allocate any temp canvas
//     (currently unused by the renderer but kept for parity with the
//     Aphydle shared module so the call sites match).
//
// Mirrors the architecture used by /tmp/aphydle/src/shared/cardRenderer.js
// and /tmp/aphydle/server/puzzleApi.mjs.

import {
  ORIGIN_MAP_VIEW_X,
  ORIGIN_MAP_VIEW_Y,
  ORIGIN_MAP_VIEW_W,
  ORIGIN_MAP_VIEW_H,
  resolveOriginPins,
  type OriginPin,
} from "../lib/originCoords";

export type PlantRow = Record<string, unknown>;
export type ColorRow = { name?: string; hex_code?: string };

// Generic drawable image — covers HTMLImageElement, HTMLCanvasElement, and
// @napi-rs/canvas Image / Canvas. We only call ctx.drawImage with these.
export type AnyImage = {
  width: number;
  height: number;
} & object;

export type IconSet = {
  sunFilled: AnyImage | null;
  sunEmpty: AnyImage | null;
  dropletFilled: AnyImage | null;
  dropletEmpty: AnyImage | null;
  wind: AnyImage | null;
  palette: AnyImage | null;
  sproutInk: AnyImage | null;
  sproutCream: AnyImage | null;
  alert: AnyImage | null;
  mapPin: AnyImage | null;
  leaf: AnyImage | null;
  thermo: AnyImage | null;
  clock: AnyImage | null;
  ruler: AnyImage | null;
  scroll: AnyImage | null;
  scrollGold: AnyImage | null;
  chevDown: AnyImage | null;
  chevDownInk: AnyImage | null;
  shovel: AnyImage | null;
  sunCream: AnyImage | null;
};

// Subset of the Canvas 2D API we actually call. Both the browser
// CanvasRenderingContext2D and @napi-rs/canvas's SKRSContext2D satisfy this
// shape — declaring it loosely means we don't pull DOM types into Node.
export type Ctx = {
  fillStyle: string | CanvasGradient | CanvasPattern | unknown;
  strokeStyle: string | CanvasGradient | CanvasPattern | unknown;
  lineWidth: number;
  lineCap?: string;
  lineJoin?: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  letterSpacing?: string;
  globalAlpha: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetY?: number;
  imageSmoothingEnabled?: boolean;
  imageSmoothingQuality?: string;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (cx: number, cy: number, r: number, a0: number, a1: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => void;
  ellipse: (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    a0: number,
    a1: number,
  ) => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  fill: () => void;
  stroke: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  measureText: (text: string) => { width: number };
  drawImage: (
    image: AnyImage,
    sxOrDx: number,
    syOrDy: number,
    swOrDw?: number,
    shOrDh?: number,
    dx?: number,
    dy?: number,
    dw?: number,
    dh?: number,
  ) => void;
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  rotate: (a: number) => void;
  clip: () => void;
  createLinearGradient: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => CanvasGradientLike;
  createRadialGradient: (
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ) => CanvasGradientLike;
};

type CanvasGradientLike = {
  addColorStop: (offset: number, color: string) => void;
};

export type CreateCanvasFn = (
  w: number,
  h: number,
) => { width: number; height: number; getContext: (id: "2d") => unknown };

export const CARD_W = 1080;
export const CARD_H = 1350;

export const FONT_MONO =
  '"Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const C = {
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

// — utils ----------------------------------------------------------------

const tidy = (s: unknown): string =>
  String(s ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

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

function roundRectPath(
  ctx: Ctx,
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
  ctx: Ctx,
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

export function drawCoverImage(
  ctx: Ctx,
  img: AnyImage,
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

export function drawWrap(
  ctx: Ctx,
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

export function drawColorSwatches(
  ctx: Ctx,
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

export function drawChip(
  ctx: Ctx,
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

export function drawGrain(
  ctx: Ctx,
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

export function drawBrandHeader(
  ctx: Ctx,
  page: number,
  total: number,
  label: string,
  fg: string,
  accent: string,
  logo: AnyImage | null,
) {
  const padX = 64;
  const top = 56;
  const logoSize = 56;

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

  const dotX = textX + ctx.measureText("Aphylia").width + 14;
  ctx.beginPath();
  ctx.arc(dotX, top + logoSize / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.font = `600 16px ${FONT_MONO}`;
  ctx.textAlign = "right";
  const indicator = `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")} · ${label}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(indicator, CARD_W - padX, top + logoSize / 2 + 6);
  ctx.letterSpacing = "0px";
}

export function drawBrandFooter(ctx: Ctx, fg: string, accent: string) {
  const padX = 64;
  const bottom = CARD_H - 56;

  ctx.fillStyle = fg;
  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "4px";
  ctx.fillText("APHYLIA.APP", padX, bottom);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = accent;
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.textAlign = "right";
  ctx.letterSpacing = "3px";
  ctx.fillText("DISCOVER →", CARD_W - padX, bottom);
  ctx.letterSpacing = "0px";
}

// — card 1: COVER --------------------------------------------------------

export function drawTeaserChip(
  ctx: Ctx,
  x: number,
  y: number,
  icon: AnyImage | null,
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
    padX +
    (icon ? iconSize + gap : 0) +
    textW +
    ctx.measureText(" ").width +
    padX;
  const h = Math.max(iconSize, 14) + padY * 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(6,18,11,0.72)";
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = "rgba(168,240,204,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (icon) {
    ctx.drawImage(icon, x + padX, y + (h - iconSize) / 2, iconSize, iconSize);
  }
  ctx.fillStyle = C.cream;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX + (icon ? iconSize + gap : 0), y + h / 2 + 1);
  ctx.letterSpacing = "0px";
  return { width: w, height: h };
}

export function drawCardCover(
  ctx: Ctx,
  plant: PlantRow,
  hero: AnyImage | null,
  variety: string,
  icons: IconSet | null,
  logoWhite: AnyImage | null,
  origin: string[],
) {
  ctx.fillStyle = C.forestDeep;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  if (hero) {
    drawCoverImage(ctx, hero, 0, 0, CARD_W, CARD_H);
  }

  const topG = ctx.createLinearGradient(0, 0, 0, 280);
  topG.addColorStop(0, "rgba(6,18,11,0.7)");
  topG.addColorStop(1, "rgba(6,18,11,0)");
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, CARD_W, 280);

  const botStart = Math.round(CARD_H * 0.42);
  const botG = ctx.createLinearGradient(0, botStart, 0, CARD_H);
  botG.addColorStop(0, "rgba(6,18,11,0)");
  botG.addColorStop(0.45, "rgba(6,18,11,0.6)");
  botG.addColorStop(1, "rgba(6,18,11,0.96)");
  ctx.fillStyle = botG;
  ctx.fillRect(0, botStart, CARD_W, CARD_H - botStart);

  drawBrandHeader(ctx, 1, 4, "COVER", C.cream, C.mint, logoWhite);

  const teasers: Array<{ icon: AnyImage | null; text: string }> = [];
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
  const warmFreq = Number(plant.watering_frequency_warm) || 0;
  if (warmFreq > 0) {
    teasers.push({
      icon: icons?.dropletFilled ?? null,
      text: `${warmFreq}× / WEEK`,
    });
  }
  const care = asArr(plant.care_level)[0];
  if (care) {
    teasers.push({
      icon: icons?.sproutCream ?? null,
      text: tidy(care).toUpperCase(),
    });
  }
  const toxLow = String(
    plant.toxicity_pets || plant.toxicity_human || "",
  ).toLowerCase();
  if (
    toxLow &&
    !toxLow.includes("non_toxic") &&
    !toxLow.includes("non-toxic") &&
    !toxLow.includes("undetermined") &&
    /toxic|deadly|severe|high/.test(toxLow)
  ) {
    teasers.push({
      icon: icons?.alert ?? null,
      text: `${tidy(toxLow).toUpperCase()}`,
    });
  }
  let chipY = 320;
  for (const t of teasers.slice(0, 5)) {
    const sz = drawTeaserChip(ctx, 64, chipY, t.icon, t.text);
    chipY += sz.height + 14;
  }

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

  const padX = 64;
  const titleBaseline = CARD_H - 290;

  ctx.fillStyle = C.mint;
  ctx.font = `600 15px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "8px";
  ctx.fillText("APHYLIA STUDIO · COVER", padX, titleBaseline - 175);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = C.mint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, titleBaseline - 152);
  ctx.lineTo(padX + 64, titleBaseline - 152);
  ctx.stroke();

  const name = tidy(plant.name || "Plant").toUpperCase();
  const titleSize = fitText(ctx, name, CARD_W - 128, 130, 64, "700", FONT_MONO);
  ctx.font = `700 ${titleSize}px ${FONT_MONO}`;
  ctx.fillStyle = C.cream;
  ctx.letterSpacing = "5px";
  ctx.fillText(name, padX, titleBaseline);
  ctx.letterSpacing = "0px";

  const variantTextRaw = variety && variety.trim() ? variety.trim() : "";
  let cursorBaseline = titleBaseline;
  if (variantTextRaw) {
    const variantUpper = variantTextRaw.toUpperCase();
    const varietySize = fitText(
      ctx,
      variantUpper,
      CARD_W - 128,
      Math.round(titleSize * 0.55),
      28,
      "600",
      FONT_MONO,
    );
    ctx.font = `600 ${varietySize}px ${FONT_MONO}`;
    ctx.fillStyle = C.mint;
    ctx.letterSpacing = "4px";
    cursorBaseline = titleBaseline + Math.round(titleSize * 0.7);
    ctx.fillText(variantUpper, padX, cursorBaseline);
    ctx.letterSpacing = "0px";
  }

  const sci = String(plant.scientific_name_species || "").trim();
  if (sci) {
    ctx.font = `400 26px ${FONT_MONO}`;
    ctx.fillStyle = "rgba(245,239,226,0.85)";
    ctx.fillText(sci, padX, cursorBaseline + 44);
  }

  const family = tidy(plant.family || "");
  const plantType = tidy(plant.plant_type || "");
  const chipsRowY = cursorBaseline + 78;
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

export function drawIconRow(
  ctx: Ctx,
  x: number,
  y: number,
  count: number,
  level: number,
  filled: AnyImage | null,
  empty: AnyImage | null,
  size = 32,
  gap = 14,
) {
  for (let i = 0; i < count; i++) {
    const img = i < level ? filled : empty;
    const dx = x + i * (size + gap);
    if (img) {
      ctx.drawImage(img, dx, y, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(dx + size / 2, y + size / 2, size * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = i < level ? C.mint : "rgba(0,0,0,0.15)";
      ctx.fill();
    }
  }
}

export function drawCardIdentity(
  ctx: Ctx,
  plant: PlantRow,
  hero: AnyImage | null,
  colors: ColorRow[],
  commonNames: string[],
  variety: string,
  gardenerTip: string,
  icons: IconSet | null,
  logoBlack: AnyImage | null,
) {
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const bgG = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bgG.addColorStop(0, "rgba(255,255,255,0.6)");
  bgG.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawBrandHeader(ctx, 2, 4, "IDENTITY", C.ink, C.mintDim, logoBlack);

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

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.inkDim;
  ctx.font = `600 14px ${FONT_MONO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("IDENTITY · 02", 64, 195);
  ctx.letterSpacing = "0px";

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

  let nextY = 230 + nameSize + 14;
  const variantTextRaw = variety && variety.trim() ? variety.trim() : "";
  if (variantTextRaw) {
    const variantUpper = variantTextRaw.toUpperCase();
    const varietySize = fitText(
      ctx,
      variantUpper,
      600,
      Math.round(nameSize * 0.55),
      18,
      "600",
      FONT_MONO,
    );
    ctx.font = `600 ${varietySize}px ${FONT_MONO}`;
    ctx.fillStyle = C.mintDim;
    ctx.letterSpacing = "3px";
    nextY += varietySize;
    ctx.fillText(variantUpper, 64, nextY);
    ctx.letterSpacing = "0px";
    nextY += 22;
  } else {
    nextY += 36;
  }

  const sci = String(plant.scientific_name_species || "").trim();
  if (sci) {
    ctx.font = `400 22px ${FONT_MONO}`;
    ctx.fillStyle = C.inkDim;
    ctx.fillText(sci, 64, nextY);
    nextY += 34;
  }

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

  const guideY = Math.max(nextY + 20, 620);

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

  const gridX = 64;
  const gridY = guideY + 24;
  const cellW = 224;
  const cellH = 140;
  const cellGap = 16;

  const drawStatBox = (
    col: number,
    row: number,
    icon: AnyImage | null,
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

  const water = waterLevel(plant);
  const warmFreq = Number(plant.watering_frequency_warm) || 0;
  const coldFreq = Number(plant.watering_frequency_cold) || 0;
  const primaryWaterFreq = warmFreq || coldFreq;
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
    const v = primaryWaterFreq > 0 ? `${primaryWaterFreq}× / WEEK` : "—";
    const sz = fitText(ctx, v, w - 36, 18, 12, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.fillText(v, x + 18, y + 118);
  });

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

  const care = tidy(asArr(plant.care_level)[0] || "");
  drawStatBox(3, 0, icons?.sproutInk ?? null, "Care", (x, y, w) => {
    if (care) {
      const careColor = care.toLowerCase().includes("easy")
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
  });

  const substrate = tidy(asArr(plant.substrate)[0] || "—");
  drawStatBox(0, 1, icons?.shovel ?? null, "Soil", (x, y, w) => {
    const sz = fitText(
      ctx,
      substrate.toUpperCase(),
      w - 36,
      22,
      13,
      "700",
      FONT_MONO,
    );
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(substrate.toUpperCase(), x + 18, y + 90);
  });

  const toxRaw = String(plant.toxicity_pets || plant.toxicity_human || "");
  const toxLow = toxRaw.toLowerCase();
  const toxIsKnown =
    toxLow &&
    !toxLow.includes("non_toxic") &&
    !toxLow.includes("non-toxic") &&
    !toxLow.includes("undetermined");
  const toxIsDanger = /toxic|deadly|severe|high/.test(toxLow);
  drawStatBox(1, 1, icons?.alert ?? null, "Toxicity", (x, y, w) => {
    if (toxIsKnown) {
      const upper = tidy(toxRaw).toUpperCase();
      ctx.font = `700 14px ${FONT_MONO}`;
      const cw = Math.min(w - 36, ctx.measureText(upper).width + 28);
      const cy = y + 60;
      const cx = x + 18;
      roundRectPath(ctx, cx, cy, cw, 32, 16);
      ctx.fillStyle = toxIsDanger ? C.warning : C.gold;
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(upper, cx + cw / 2, cy + 17);
      ctx.fillStyle = C.inkDim;
      ctx.font = `500 10px ${FONT_MONO}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.letterSpacing = "3px";
      const who =
        plant.toxicity_pets && plant.toxicity_human
          ? "PETS + HUMANS"
          : plant.toxicity_pets
            ? "PETS"
            : "HUMANS";
      ctx.fillText(who, x + 18, y + 118);
      ctx.letterSpacing = "0px";
    } else {
      ctx.fillStyle = C.mintDim;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("SAFE", x + 18, y + 78);
      ctx.fillStyle = C.inkDim;
      ctx.font = `500 11px ${FONT_MONO}`;
      ctx.fillText("PETS + HUMANS", x + 18, y + 110);
    }
  });

  const habit = tidy(asArr(plant.plant_habit)[0] || "—");
  drawStatBox(2, 1, icons?.sproutInk ?? null, "Form", (x, y, w) => {
    const sz = fitText(
      ctx,
      habit.toUpperCase(),
      w - 36,
      22,
      13,
      "700",
      FONT_MONO,
    );
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(habit.toUpperCase(), x + 18, y + 90);
  });

  const utilities = asArr(plant.utility);
  const topUtility = tidy(utilities[0] || "—").toUpperCase();
  drawStatBox(3, 1, icons?.palette ?? null, "Best Use", (x, y, w) => {
    const sz = fitText(ctx, topUtility, w - 36, 22, 13, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(topUtility, x + 18, y + 90);
  });

  const paletteY = gridY + 2 * (cellH + cellGap) + 22;

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
      160,
      paletteY - 10,
      colors,
      "rgba(21,32,26,0.25)",
      C.inkDim,
    );
  }

  const utilityY = paletteY + 38;
  if (utilities.length > 0) {
    ctx.fillStyle = C.inkDim;
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.letterSpacing = "5px";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("UTILITY", 64, utilityY);
    ctx.letterSpacing = "0px";

    let uX = 160;
    const utilTop = utilityY - 24;
    for (const u of utilities.slice(0, 5)) {
      const lbl = tidy(u).toUpperCase();
      ctx.font = `700 13px ${FONT_MONO}`;
      const w = ctx.measureText(lbl).width + 32;
      if (uX + w > CARD_W - 64) break;
      drawChip(ctx, uX, utilTop, lbl, {
        bg: C.mintDim,
        fg: "#FFFFFF",
        size: 13,
        family: FONT_MONO,
        weight: "700",
        paddingX: 16,
        paddingY: 9,
      });
      uX += w + 8;
    }
  }

  if (gardenerTip) {
    const noteTop = utilityY + 28;
    const noteX = 64;
    const noteW = CARD_W - 128;
    const noteH = 200;
    roundRectPath(ctx, noteX, noteTop, noteW, noteH, 22);
    ctx.fillStyle = "rgba(91,211,148,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(59,127,90,0.45)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (icons?.sproutInk) {
      ctx.drawImage(icons.sproutInk, noteX + 22, noteTop + 24, 36, 36);
    }
    ctx.fillStyle = C.mintDim;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "6px";
    ctx.fillText("◇ GARDENER'S NOTE", noteX + 70, noteTop + 38);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "rgba(21,32,26,0.5)";
    ctx.font = `500 10px ${FONT_MONO}`;
    ctx.letterSpacing = "5px";
    ctx.fillText("FIELD-TESTED ADVICE", noteX + 70, noteTop + 56);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = C.ink;
    ctx.font = `500 19px ${FONT_MONO}`;
    drawWrap(ctx, gardenerTip, noteX + 24, noteTop + 100, noteW - 48, 28, 4);
  }

  drawBrandFooter(ctx, C.ink, C.mintDim);
}

// — card 3: DEEP KNOWLEDGE ----------------------------------------------

export function drawCardDeep(
  ctx: Ctx,
  plant: PlantRow,
  origin: string[],
  worldMapFallback: AnyImage | null,
  originMap: AnyImage | null,
  historicalFact: string,
  icons: IconSet | null,
  logoWhite: AnyImage | null,
) {
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
  ctx.font = `700 36px ${FONT_MONO}`;
  ctx.fillStyle = C.cream;
  ctx.letterSpacing = "3px";
  const originBottom = drawWrap(ctx, originText, 64, 250, CARD_W - 128, 46, 2);
  ctx.letterSpacing = "0px";

  ctx.font = `500 13px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(168,240,204,0.7)";
  ctx.letterSpacing = "5px";
  ctx.fillText(
    `◯ ${origin.length > 1 ? "NATIVE RANGE" : "NATIVE TO"}`,
    64,
    originBottom + 26,
  );
  ctx.letterSpacing = "0px";

  const splitTop = originBottom + 56;
  const padX = 64;
  const splitGap = 24;
  const splitW = (CARD_W - padX * 2 - splitGap) / 2;
  const splitH = 380;

  const mapX = padX;
  const mapY = splitTop;
  const pins: OriginPin[] = resolveOriginPins(origin);
  const hasPins = pins.length > 0;

  roundRectPath(ctx, mapX, mapY, splitW, splitH, 20);
  ctx.fillStyle = "rgba(22,39,29,0.7)";
  ctx.fill();
  ctx.strokeStyle = "rgba(91,211,148,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundRectPath(ctx, mapX, mapY, splitW, splitH, 20);
  ctx.clip();

  if (hasPins) {
    const mapImg = originMap || worldMapFallback;
    if (mapImg) {
      const mapAR = ORIGIN_MAP_VIEW_W / ORIGIN_MAP_VIEW_H;
      const drawW = splitW;
      const drawH = drawW / mapAR;
      const drawY = mapY + (splitH - drawH) / 2;
      ctx.globalAlpha = 0.4;
      drawCoverImage(ctx, mapImg, mapX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;

      const sx = drawW / ORIGIN_MAP_VIEW_W;
      const sy = drawH / ORIGIN_MAP_VIEW_H;
      for (const pin of pins) {
        const px = mapX + (pin.coords[0] - ORIGIN_MAP_VIEW_X) * sx;
        const py = drawY + (pin.coords[1] - ORIGIN_MAP_VIEW_Y) * sy;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(91,211,148,0.18)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(91,211,148,0.35)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = C.mint;
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(168,240,204,0.55)";
    ctx.font = `600 10px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "5px";
    ctx.fillText("◯ NATIVE RANGE", mapX + 16, mapY + 24);
    ctx.letterSpacing = "0px";
  } else {
    const cx = mapX + splitW / 2;
    const cy = mapY + splitH / 2;
    ctx.strokeStyle = "rgba(91,211,148,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 40, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 40, 56, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 96);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();

    ctx.fillStyle = C.cream;
    ctx.font = `700 22px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "3px";
    ctx.fillText(
      origin.length ? "ORIGIN UNCHARTED" : "CULTIVATED WORLDWIDE",
      cx,
      cy + 60,
    );
    ctx.letterSpacing = "0px";

    ctx.font = `500 13px ${FONT_MONO}`;
    ctx.fillStyle = "rgba(168,240,204,0.7)";
    const hint = origin.length
      ? "Listed by region — no specific country to pin."
      : "No documented native range on file.";
    drawWrap(ctx, hint, mapX + 32, cy + 92, splitW - 64, 20, 3);
    ctx.textAlign = "left";
  }
  ctx.restore();

  const statsX = mapX + splitW + splitGap;
  const cellH = (splitH - 8) / 3;
  const cellW = splitW;

  const climate = joinPretty(asArr(plant.climate), " · ", 2);
  const lifecycle = tidy(asArr(plant.life_cycle)[0] || "—");
  const foliage = tidy(asArr(plant.foliage_persistence)[0] || "—");
  const heightCm = Number(plant.height_cm) || 0;
  const heightStr =
    heightCm > 0
      ? heightCm >= 100
        ? `${(heightCm / 100).toFixed(heightCm >= 1000 ? 0 : 1)} M`
        : `${heightCm} CM`
      : "—";
  const tMin = plant.temperature_min as number | null | undefined;
  const tMax = plant.temperature_max as number | null | undefined;
  const tempStr =
    tMin != null && tMax != null
      ? `${tMin}° / ${tMax}°C`
      : tMin != null
        ? `MIN ${tMin}°C`
        : tMax != null
          ? `MAX ${tMax}°C`
          : "—";
  const conservation = tidy(asArr(plant.conservation_status)[0] || "—");

  const cells: Array<{
    icon: AnyImage | null;
    label: string;
    value: string;
  }> = [
    {
      icon: icons?.thermo ?? null,
      label: "Climate",
      value: climate.toUpperCase(),
    },
    { icon: icons?.thermo ?? null, label: "Temperature", value: tempStr },
    {
      icon: icons?.clock ?? null,
      label: "Lifecycle",
      value: lifecycle.toUpperCase(),
    },
    {
      icon: icons?.leaf ?? null,
      label: "Foliage",
      value: foliage.toUpperCase(),
    },
    { icon: icons?.ruler ?? null, label: "Height", value: heightStr },
    {
      icon: icons?.alert ?? null,
      label: "Conservation",
      value: conservation.toUpperCase(),
    },
  ];
  const innerCols = 2;
  const innerCellW = (cellW - 8) / innerCols;
  const innerCellH = cellH - 8;

  for (let i = 0; i < cells.length; i++) {
    const col = i % innerCols;
    const row = Math.floor(i / innerCols);
    const cx = statsX + col * (innerCellW + 8);
    const cy = splitTop + row * (innerCellH + 8);
    roundRectPath(ctx, cx, cy, innerCellW, innerCellH, 14);
    ctx.fillStyle = "rgba(22,39,29,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(91,211,148,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const cell = cells[i];
    if (cell.icon) {
      ctx.beginPath();
      ctx.arc(cx + 30, cy + 30, 16, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(91,211,148,0.18)";
      ctx.fill();
      ctx.drawImage(cell.icon, cx + 18, cy + 18, 24, 24);
    }
    ctx.fillStyle = "rgba(168,240,204,0.7)";
    ctx.font = `600 10px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "4px";
    ctx.fillText(cell.label.toUpperCase(), cx + 56, cy + 28);
    ctx.letterSpacing = "0px";

    const valSize = fitText(
      ctx,
      cell.value,
      innerCellW - 24,
      22,
      11,
      "700",
      FONT_MONO,
    );
    ctx.font = `700 ${valSize}px ${FONT_MONO}`;
    ctx.fillStyle = C.cream;
    ctx.fillText(cell.value, cx + 16, cy + innerCellH - 18);
  }

  const factTop = splitTop + splitH + 32;
  const factX = padX;
  const factW = CARD_W - padX * 2;
  const factH = 240;
  roundRectPath(ctx, factX, factTop, factW, factH, 22);
  ctx.fillStyle = "rgba(224,178,82,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(224,178,82,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (icons?.scrollGold) {
    ctx.drawImage(icons.scrollGold, factX + 24, factTop + 24, 56, 56);
  }

  ctx.fillStyle = C.gold;
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "6px";
  ctx.fillText("◇ FROM THE ARCHIVES", factX + 96, factTop + 44);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "rgba(224,178,82,0.7)";
  ctx.font = `500 11px ${FONT_MONO}`;
  ctx.letterSpacing = "5px";
  ctx.fillText("HISTORY · MYTH · MEANING", factX + 96, factTop + 66);
  ctx.letterSpacing = "0px";

  if (historicalFact) {
    ctx.fillStyle = C.cream;
    ctx.font = `500 20px ${FONT_MONO}`;
    drawWrap(ctx, historicalFact, factX + 24, factTop + 110, factW - 48, 30, 4);
  } else {
    const presentation = String(
      (plant as { presentation?: string }).presentation || "",
    ).trim();
    if (presentation) {
      ctx.fillStyle = C.cream;
      ctx.font = `400 18px ${FONT_MONO}`;
      drawWrap(ctx, presentation, factX + 24, factTop + 110, factW - 48, 28, 4);
    } else {
      ctx.fillStyle = "rgba(245,239,226,0.55)";
      ctx.font = `400 16px ${FONT_MONO}`;
      ctx.fillText(
        "No verified history, myth, or naming story surfaced for this plant.",
        factX + 24,
        factTop + 130,
      );
    }
  }

  drawBrandFooter(ctx, C.cream, C.mintGlow);
}

// — card 4: WILD CARD CTA ------------------------------------------------

export function drawCardWild(
  ctx: Ctx,
  plant: PlantRow,
  images: AnyImage[],
  variety: string,
  icons: IconSet | null,
  logoWhite: AnyImage | null,
) {
  const APP_EMERALD = "#10B981";
  const APP_EMERALD_DARK = "#059669";
  const APP_EMERALD_DEEPER = "#047857";
  const APP_PAPER = C.cream;
  const APP_INK = "#0F1F1F";

  ctx.fillStyle = APP_PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const heroH = 700;
  const hero = images[0] ?? null;
  if (hero) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CARD_W, heroH);
    ctx.clip();
    drawCoverImage(ctx, hero, 0, 0, CARD_W, heroH);

    const topScrim = ctx.createLinearGradient(0, 0, 0, 180);
    topScrim.addColorStop(0, "rgba(15,31,31,0.78)");
    topScrim.addColorStop(1, "rgba(15,31,31,0)");
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, CARD_W, 180);

    const overlay = ctx.createLinearGradient(0, heroH * 0.35, 0, heroH);
    overlay.addColorStop(0, "rgba(15,31,31,0)");
    overlay.addColorStop(0.45, "rgba(15,31,31,0.65)");
    overlay.addColorStop(1, "rgba(15,31,31,0.96)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, CARD_W, heroH);

    const glow = ctx.createRadialGradient(
      CARD_W,
      heroH * 0.25,
      0,
      CARD_W,
      heroH * 0.25,
      CARD_W * 0.6,
    );
    glow.addColorStop(0, "rgba(16,185,129,0.30)");
    glow.addColorStop(1, "rgba(16,185,129,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, heroH);
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, heroH);
    g.addColorStop(0, APP_EMERALD);
    g.addColorStop(1, APP_EMERALD_DEEPER);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, heroH);
  }

  drawBrandHeader(
    ctx,
    4,
    4,
    "DISCOVER",
    C.cream,
    "rgba(168,240,204,0.85)",
    logoWhite,
  );

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(168,240,204,0.95)";
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.letterSpacing = "9px";
  ctx.fillText("LOVED THIS PLANT?", 64, heroH - 180);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = APP_EMERALD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, heroH - 165);
  ctx.lineTo(120, heroH - 165);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 64px ${FONT_MONO}`;
  ctx.letterSpacing = "2px";
  ctx.fillText("FIND YOUR NEXT", 64, heroH - 100);
  ctx.fillStyle = "rgba(168,240,204,0.95)";
  ctx.fillText("FAVOURITE.", 64, heroH - 40);
  ctx.letterSpacing = "0px";

  const reasonsTop = heroH + 60;

  ctx.fillStyle = APP_EMERALD_DEEPER;
  ctx.font = `700 12px ${FONT_MONO}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("WHY APHYLIA", 64, reasonsTop);
  ctx.letterSpacing = "0px";

  ctx.strokeStyle = APP_EMERALD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, reasonsTop + 12);
  ctx.lineTo(120, reasonsTop + 12);
  ctx.stroke();

  const reasons: string[] = [
    "CURATED PLANT CARDS",
    "STRAIGHTFORWARD CARE GUIDES",
    "FREE TO BROWSE, NO ACCOUNT NEEDED",
  ];
  const reasonY = reasonsTop + 50;
  const reasonRowH = 64;
  for (let i = 0; i < reasons.length; i++) {
    const label = reasons[i];
    const ry = reasonY + i * reasonRowH;

    const cx = 80;
    const cy = ry + 18;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = APP_EMERALD;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 8, cy - 6);
    ctx.stroke();

    ctx.fillStyle = APP_INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const sz = fitText(ctx, label, CARD_W - 64 - 116, 19, 13, "700", FONT_MONO);
    ctx.font = `700 ${sz}px ${FONT_MONO}`;
    ctx.letterSpacing = "3px";
    ctx.fillText(label, 116, ry + 28);
    ctx.letterSpacing = "0px";
  }

  const ctaY = reasonY + reasons.length * reasonRowH + 30;
  const ctaH = 96;
  const ctaX = 64;
  const ctaW = CARD_W - 128;

  const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
  ctaGrad.addColorStop(0, APP_EMERALD_DARK);
  ctaGrad.addColorStop(1, APP_EMERALD);
  roundRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  ctx.save();
  ctx.shadowColor = "rgba(16,185,129,0.40)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  ctx.fillStyle = ctaGrad;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 36px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "1px";
  const ctaText = "aphylia.app";
  ctx.fillText(ctaText, ctaX + 36, ctaY + ctaH / 2);
  ctx.letterSpacing = "0px";

  const arrCx = ctaX + ctaW - ctaH / 2 - 4;
  const arrCy = ctaY + ctaH / 2;
  const arrR = ctaH / 2 - 12;
  ctx.beginPath();
  ctx.arc(arrCx, arrCy, arrR, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.strokeStyle = APP_EMERALD_DEEPER;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(arrCx - 11, arrCy);
  ctx.lineTo(arrCx + 11, arrCy);
  ctx.moveTo(arrCx + 3, arrCy - 8);
  ctx.lineTo(arrCx + 11, arrCy);
  ctx.lineTo(arrCx + 3, arrCy + 8);
  ctx.stroke();

  ctx.fillStyle = APP_INK;
  ctx.font = `500 15px ${FONT_MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const nameForLine = tidy(plant.name || "this plant").toUpperCase();
  const variantForLine =
    variety && variety.trim() ? variety.trim().toUpperCase() : "";
  const fullName = variantForLine
    ? `${nameForLine} · ${variantForLine}`
    : nameForLine;
  const personalLine = `STARTED WITH ${fullName} · KEEP EXPLORING`;
  const personalY = ctaY + ctaH + 40;
  ctx.letterSpacing = "4px";
  ctx.fillText(personalLine, CARD_W / 2, personalY);
  ctx.letterSpacing = "0px";

  const cueTop = personalY + 40;
  ctx.fillStyle = APP_EMERALD_DARK;
  ctx.font = `700 13px ${FONT_MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "8px";
  ctx.fillText("READ THE FULL POST BELOW", CARD_W / 2, cueTop);
  ctx.letterSpacing = "0px";

  if (icons?.chevDownInk) {
    const sizes = [
      { y: cueTop + 14, op: 0.9, sz: 36 },
      { y: cueTop + 38, op: 0.55, sz: 30 },
    ];
    for (const s of sizes) {
      ctx.save();
      ctx.globalAlpha = s.op;
      ctx.drawImage(
        icons.chevDownInk,
        CARD_W / 2 - s.sz / 2,
        s.y,
        s.sz,
        s.sz,
      );
      ctx.restore();
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, heroH, CARD_W, CARD_H - heroH);
  ctx.clip();
  drawGrain(ctx, CARD_W, CARD_H, 0.025, 500);
  ctx.restore();
}

// Pick the first defined image from the array, falling back through it so an
// off-by-one (e.g. plant has only 1 image, identity wants index 1) still
// renders something instead of leaving a hole.
export function pickImage(
  images: AnyImage[],
  preferred: number,
): AnyImage | null {
  if (preferred < images.length) return images[preferred];
  return images[0] ?? null;
}

// — top-level entry point ------------------------------------------------

export type RenderAphyliaCardOpts = {
  ctx: Ctx;
  cardIndex: 0 | 1 | 2 | 3;
  plant: PlantRow;
  images: AnyImage[];
  variety: string;
  commonNames: string[];
  origin: string[];
  colors: ColorRow[];
  icons: IconSet | null;
  logoWhite: AnyImage | null;
  logoBlack: AnyImage | null;
  originMap: AnyImage | null;
  worldMap: AnyImage | null;
  ai: { historicalFact: string; gardenerTip: string };
};

export function renderAphyliaCard(opts: RenderAphyliaCardOpts): void {
  const {
    ctx,
    cardIndex,
    plant,
    images,
    variety,
    commonNames,
    origin,
    colors,
    icons,
    logoWhite,
    logoBlack,
    originMap,
    worldMap,
    ai,
  } = opts;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  switch (cardIndex) {
    case 0:
      drawCardCover(ctx, plant, pickImage(images, 0), variety, icons, logoWhite, origin);
      break;
    case 1:
      drawCardIdentity(
        ctx,
        plant,
        pickImage(images, 1),
        colors,
        commonNames,
        variety,
        ai.gardenerTip,
        icons,
        logoBlack,
      );
      break;
    case 2:
      drawCardDeep(
        ctx,
        plant,
        origin,
        worldMap,
        originMap,
        ai.historicalFact,
        icons,
        logoWhite,
      );
      break;
    case 3:
      drawCardWild(ctx, plant, images, variety, icons, logoWhite);
      break;
  }
}
