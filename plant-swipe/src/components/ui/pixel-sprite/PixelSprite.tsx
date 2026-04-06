import { useMemo } from "react";
import { SPRITE_DEFS, TILE_SIZE, type SpriteName } from "./sprite-definitions";
import { cn } from "@/lib/utils";

export interface PixelSpriteProps {
  /** Name of the sprite as defined in sprite-definitions.ts */
  name: SpriteName;
  /** Which state (frame) to display. Defaults to 0. */
  state?: number;
  /** Display scale multiplier. e.g. 4 → a 16 px tile renders at 64 px. Default 4. */
  scale?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a pixel-art sprite from a Sprout Lands sprite sheet.
 *
 * - Crops the correct tile(s) via `background-position` + `background-size`.
 * - Uses `image-rendering: pixelated` so the art stays crisp at any scale.
 * - Coordinates use a bottom-left origin (y = 0 is the bottom row).
 */
export function PixelSprite({
  name,
  state = 0,
  scale = 4,
  className,
}: PixelSpriteProps) {
  const def = SPRITE_DEFS[name];
  const [tilesW, tilesH] = def.tiles ?? [1, 1];
  const coord = def.states[state];

  const style = useMemo(() => {
    if (!coord) return undefined;

    const [tileX, tileY] = coord;

    // Convert bottom-left origin Y to top-left origin Y used by CSS.
    // Sheet is sheetHeight px tall. Each tile is TILE_SIZE px.
    // The top-left pixel-Y of the tile = sheetHeight - (tileY + tilesH) * TILE_SIZE
    const pxX = tileX * TILE_SIZE;
    const pxY = def.sheetHeight - (tileY + tilesH) * TILE_SIZE;

    const displayW = tilesW * TILE_SIZE * scale;
    const displayH = tilesH * TILE_SIZE * scale;

    // background-size scales the full sheet proportionally.
    const bgW = (def.sheetWidth / (tilesW * TILE_SIZE)) * displayW;
    const bgH = (def.sheetHeight / (tilesH * TILE_SIZE)) * displayH;

    // background-position offsets (scaled).
    const bgX = -(pxX / (tilesW * TILE_SIZE)) * displayW;
    const bgY = -(pxY / (tilesH * TILE_SIZE)) * displayH;

    return {
      width: displayW,
      height: displayH,
      backgroundImage: `url(${def.src})`,
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated" as const,
    };
  }, [name, state, scale, coord, def, tilesW, tilesH]);

  if (!coord) {
    console.warn(`PixelSprite: "${name}" has no state ${state}`);
    return null;
  }

  return <div className={cn("inline-block", className)} style={style} />;
}

export default PixelSprite;
