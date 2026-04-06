import { useEffect, useRef, useMemo, useState } from "react";
import { SPRITE_DEFS, TILE_SIZE, type SpriteName } from "./sprite-definitions";
import { cn } from "@/lib/utils";

export interface PixelSpriteProps {
  /** Name of the sprite as defined in sprite-definitions.ts */
  name: SpriteName;
  /** Which state (frame) to display. Defaults to 0. */
  state?: number;
  /** Display scale multiplier. e.g. 4 → a 16 px tile renders at 64 px. Default 4. */
  scale?: number;
  /** Add a 1px (sprite-pixel) outline around the visible pixels. Scales with the sprite. */
  outline?: boolean;
  /** Outline color. Defaults to white. */
  outlineColor?: string;
  /** Additional CSS classes. Use w/h utilities to override size (set scale to 0). */
  className?: string;
}

// Cache loaded images so we only fetch each sheet once.
const imageCache = new Map<string, HTMLImageElement>();
function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Renders a pixel-art sprite from a Sprout Lands sprite sheet.
 *
 * When `outline` is false, uses CSS background (no canvas, no image load).
 * When `outline` is true, draws to a canvas for a pixel-perfect uniform outline.
 */
export function PixelSprite({
  name,
  state = 0,
  scale = 4,
  outline = false,
  outlineColor = "white",
  className,
}: PixelSpriteProps) {
  const def = SPRITE_DEFS[name];
  const [tilesW, tilesH] = def.tiles ?? [1, 1];
  const coord = def.states[state];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resolvedOutlineColor, setResolvedOutlineColor] = useState<string>(outlineColor);

  // --- CSS-only path (no outline) ---
  const style = useMemo(() => {
    if (!coord || outline) return undefined;

    const [tileX, tileY] = coord;
    const sheetTilesX = def.sheetWidth / (tilesW * TILE_SIZE);
    const sheetTilesY = def.sheetHeight / (tilesH * TILE_SIZE);
    const topLeftTileY = sheetTilesY - 1 - tileY;

    const bgSizeX = sheetTilesX * 100;
    const bgSizeY = sheetTilesY * 100;
    const bgPosX = sheetTilesX > 1 ? (tileX / (sheetTilesX - 1)) * 100 : 0;
    const bgPosY = sheetTilesY > 1 ? (topLeftTileY / (sheetTilesY - 1)) * 100 : 0;

    const base: React.CSSProperties = {
      backgroundImage: `url(${def.src})`,
      backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
      backgroundPosition: `${bgPosX}% ${bgPosY}%`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
    };

    if (scale > 0) {
      base.width = tilesW * TILE_SIZE * scale;
      base.height = tilesH * TILE_SIZE * scale;
    }

    return base;
  }, [name, state, scale, coord, def, tilesW, tilesH, outline]);

  // --- Canvas path (with outline) ---
  useEffect(() => {
    if (!outline || !coord || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const [tileX, tileY] = coord;
    const sheetTilesY = def.sheetHeight / (tilesH * TILE_SIZE);
    const topLeftTileY = sheetTilesY - 1 - tileY;

    // Source rect in the sprite sheet
    const sx = tileX * tilesW * TILE_SIZE;
    const sy = topLeftTileY * tilesH * TILE_SIZE;
    const sw = tilesW * TILE_SIZE;
    const sh = tilesH * TILE_SIZE;

    // The canvas is the tile size + 2px (1px outline on each side)
    const cw = sw + 2;
    const ch = sh + 2;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw, ch);

    // Resolve CSS variable colors
    let color = outlineColor;
    if (outlineColor.startsWith("var(")) {
      const varName = outlineColor.slice(4, -1).trim();
      color = getComputedStyle(canvas).getPropertyValue(varName).trim() || "white";
    }
    setResolvedOutlineColor(color);

    loadImage(def.src).then((img) => {
      // Draw sprite into a temp canvas to read pixel data
      const tmp = document.createElement("canvas");
      tmp.width = sw;
      tmp.height = sh;
      const tmpCtx = tmp.getContext("2d")!;
      tmpCtx.imageSmoothingEnabled = false;
      tmpCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const data = tmpCtx.getImageData(0, 0, sw, sh).data;

      // Helper: is pixel at (x, y) opaque (alpha > 0)?
      const isOpaque = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= sw || y >= sh) return false;
        return data[(y * sw + x) * 4 + 3] > 0;
      };

      // Draw outline: for each transparent pixel adjacent to an opaque pixel
      ctx.fillStyle = color;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (!isOpaque(x, y)) {
            // Check 4 neighbors
            if (isOpaque(x - 1, y) || isOpaque(x + 1, y) || isOpaque(x, y - 1) || isOpaque(x, y + 1)) {
              ctx.fillRect(x + 1, y + 1, 1, 1); // +1 offset for the border padding
            }
          } else {
            // Also draw outline at sheet edges if pixel is opaque
            if (x === 0 || x === sw - 1 || y === 0 || y === sh - 1) {
              if (x === 0) ctx.fillRect(0, y + 1, 1, 1);
              if (x === sw - 1) ctx.fillRect(sw + 1, y + 1, 1, 1);
              if (y === 0) ctx.fillRect(x + 1, 0, 1, 1);
              if (y === sh - 1) ctx.fillRect(x + 1, sh + 1, 1, 1);
            }
          }
        }
      }

      // Draw the sprite on top (offset by 1 for border padding)
      ctx.drawImage(img, sx, sy, sw, sh, 1, 1, sw, sh);
    });
  }, [name, state, outline, outlineColor, coord, def, tilesW, tilesH]);

  if (!coord) {
    console.warn(`PixelSprite: "${name}" has no state ${state}`);
    return null;
  }

  // --- Outline: render canvas ---
  if (outline) {
    const pw = tilesW * TILE_SIZE + 2; // +2 for outline
    const ph = tilesH * TILE_SIZE + 2;

    const canvasStyle: React.CSSProperties = {
      imageRendering: "pixelated",
    };

    if (scale > 0) {
      canvasStyle.width = pw * scale;
      canvasStyle.height = ph * scale;
    }

    return (
      <canvas
        ref={canvasRef}
        className={cn("inline-block", className)}
        style={canvasStyle}
      />
    );
  }

  // --- No outline: render div with CSS background ---
  return <div className={cn("inline-block", className)} style={style} />;
}

export default PixelSprite;
