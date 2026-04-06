/**
 * Sprite Definitions for Sprout Lands pixel art assets.
 *
 * Coordinate system:
 *   - Origin (0, 0) is the BOTTOM-LEFT tile of the sprite sheet.
 *   - X increases to the right, Y increases upward.
 *   - Each tile is TILE_SIZE × TILE_SIZE pixels (16 × 16).
 *
 * Adding a new sprite:
 *   1. Import the sprite sheet image.
 *   2. Add an entry to SPRITE_DEFS with:
 *        - src:    the imported image module
 *        - tiles:  [width, height] in tile units (default [1,1])
 *        - states: array of [x, y] bottom-left coordinates, one per state.
 *                  For multi-tile sprites each state's coord is still the
 *                  bottom-left tile of that frame.
 */

import FarmingPlants from "@/assets/SproutLands/Objects/Farming Plants.png";
// Import more sheets here as needed:
// import Trees from "@/assets/SproutLands/Objects/Trees, stumps and bushes.png";
// import Mushrooms from "@/assets/SproutLands/Objects/Mushrooms, Flowers, Stones.png";

export const TILE_SIZE = 16; // px – every Sprout Lands asset is 16 × 16

export interface SpriteDef {
  /** Imported image source (URL resolved by Vite) */
  src: string;
  /** Width of the full sprite sheet in pixels (needed for coordinate math) */
  sheetWidth: number;
  /** Height of the full sprite sheet in pixels */
  sheetHeight: number;
  /** Size of this element in tiles: [tilesWide, tilesTall]. Defaults to [1,1] */
  tiles?: [number, number];
  /** Each state is a [x, y] coordinate (in tiles, bottom-left origin) */
  states: [number, number][];
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export const SPRITE_DEFS = {
  /**
   * Growing_Plant_00 – 4 growth stages (state 0‑3).
   * Located in "Farming Plants.png" (80 × 240, i.e. 5 × 15 tiles).
   * Bottom row of the sheet is y = 0. The first plant column is x = 0.
   * States go from (0,0) up to (0,3).
   */
  Growing_Plant_00: {
    src: FarmingPlants,
    sheetWidth: 80,
    sheetHeight: 240,
    tiles: [1, 1],
    states: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
  },
} as const satisfies Record<string, SpriteDef>;

export type SpriteName = keyof typeof SPRITE_DEFS;
