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
  /** Additional CSS classes. Use w/h utilities to override size (set scale to 0). */
  className?: string;
}

/**
 * Renders a pixel-art sprite from a Sprout Lands sprite sheet.
 *
 * - Crops the correct tile(s) via `background-position` + `background-size`.
 * - Uses `image-rendering: pixelated` so the art stays crisp at any scale.
 * - Coordinates use a bottom-left origin (y = 0 is the bottom row).
 *
 * For responsive sizing: pass `scale={0}` and control size via className
 * (e.g. `className="w-full h-full"`). The background percentages will
 * handle cropping at any container size.
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
  }, [name, state, scale, coord, def, tilesW, tilesH]);

  if (!coord) {
    console.warn(`PixelSprite: "${name}" has no state ${state}`);
    return null;
  }

  return <div className={cn("inline-block", className)} style={style} />;
}

export default PixelSprite;
