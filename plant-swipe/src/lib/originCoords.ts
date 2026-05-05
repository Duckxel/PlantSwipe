// Shared origin → map coordinate matcher. Used by:
//   - PlantInfoPage (SVG world map with pulsing pins)
//   - AdminExportPanel (canvas social cards "Science" page)
//
// Coordinates live in the SVG viewBox of the pixelated origin map at
// ORIGIN_MAP_URL: x=103.51, y=165.78, w=820.44, h=501.3.
//
// Two layered dictionaries: countries first, then macro-regions (Asia,
// Mediterranean, Tropical Africa, Caribbean, …). Plant origin fields are
// often filled with regions or climate bands rather than countries — without
// the regions tier those pins silently drop.

export const ORIGIN_MAP_URL =
  "https://media.aphylia.app/UTILITY/admin/uploads/svg/worldlow-pixels-46c63cb3-22eb-45ec-be41-55843a3b1093.svg";

export const ORIGIN_MAP_VIEW_X = 103.51;
export const ORIGIN_MAP_VIEW_Y = 165.78;
export const ORIGIN_MAP_VIEW_W = 820.44;
export const ORIGIN_MAP_VIEW_H = 501.3;
export const ORIGIN_MAP_VIEWBOX = `${ORIGIN_MAP_VIEW_X} ${ORIGIN_MAP_VIEW_Y} ${ORIGIN_MAP_VIEW_W} ${ORIGIN_MAP_VIEW_H}`;

export const ORIGIN_COUNTRY_COORDS: Record<string, [number, number]> = {
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

// Macro-region centroids. Lots of plant origin fields are filled with regions
// ("Asia", "Mediterranean", "Tropical Africa") instead of countries — without
// this fallback those plants get no pin even though we know roughly where
// they're from.
export const ORIGIN_REGION_COORDS: Record<string, [number, number]> = {
  // Continents / supercontinents
  "asia": [700, 300],
  "europe": [510, 250],
  "africa": [525, 415],
  "oceania": [860, 470],
  "australasia": [855, 475],
  "americas": [280, 380],
  "north america": [230, 260],
  "south america": [310, 470],
  "central america": [235, 360],
  "latin america": [290, 430],
  "antarctica": [490, 640],

  // Asia sub-regions
  "east asia": [770, 300],
  "far east": [800, 300],
  "southeast asia": [770, 380],
  "south east asia": [770, 380],
  "south asia": [680, 340],
  "indian subcontinent": [680, 340],
  "central asia": [640, 270],
  "north asia": [680, 220],
  "siberia": [700, 215],
  "western asia": [590, 320],
  "middle east": [590, 320],
  "near east": [580, 305],
  "asia minor": [565, 290],
  "tropical asia": [750, 380],
  "indomalaya": [770, 380],

  // Europe sub-regions
  "western europe": [480, 260],
  "eastern europe": [540, 250],
  "northern europe": [510, 215],
  "scandinavia": [515, 215],
  "southern europe": [510, 285],
  "central europe": [510, 250],
  "british isles": [465, 240],

  // Mediterranean / connected basins
  "mediterranean": [510, 295],
  "mediterranean basin": [510, 295],
  "mediterranean region": [510, 295],
  "balkans": [528, 274],
  "iberia": [468, 285],
  "iberian peninsula": [468, 285],
  "anatolia": [565, 290],
  "levant": [570, 312],

  // Africa sub-regions
  "north africa": [510, 320],
  "northern africa": [510, 320],
  "saharan africa": [510, 335],
  "sahara": [510, 335],
  "sub saharan africa": [530, 425],
  "subsaharan africa": [530, 425],
  "west africa": [470, 380],
  "western africa": [470, 380],
  "east africa": [580, 410],
  "eastern africa": [580, 410],
  "horn of africa": [600, 390],
  "central africa": [525, 410],
  "southern africa": [540, 485],
  "tropical africa": [520, 410],
  "afrotropical": [520, 410],

  // Americas sub-regions
  "tropical america": [290, 410],
  "neotropical": [290, 410],
  "neotropics": [290, 410],
  "caribbean": [268, 335],
  "west indies": [268, 335],
  "antilles": [275, 340],
  "andes": [290, 460],
  "andean": [290, 460],
  "amazon": [330, 430],
  "amazonia": [330, 430],
  "amazon basin": [330, 430],
  "patagonia": [310, 545],

  // Oceania / Pacific
  "pacific": [920, 440],
  "pacific islands": [920, 440],
  "polynesia": [940, 450],
  "melanesia": [880, 450],
  "micronesia": [875, 400],

  // Climate-band fallbacks (last resort — rough equator pin)
  "tropics": [490, 400],
  "tropical": [490, 400],
  "tropical regions": [490, 400],
  "subtropics": [490, 380],
  "subtropical": [490, 380],
  "temperate": [490, 250],
  "temperate regions": [490, 250],
  "northern hemisphere": [490, 250],
  "southern hemisphere": [490, 480],
  "worldwide": [490, 350],
  "cosmopolitan": [490, 350],
};

export function normalizeOriginName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_COUNTRY_ENTRIES: Array<{ normalized: string; coords: [number, number] }> =
  Object.entries(ORIGIN_COUNTRY_COORDS).map(([country, coords]) => ({
    normalized: normalizeOriginName(country),
    coords,
  }));

export function matchOriginToCoords(origin: string): [number, number] | null {
  const trimmed = origin.trim();
  if (!trimmed) return null;
  if (ORIGIN_COUNTRY_COORDS[trimmed]) return ORIGIN_COUNTRY_COORDS[trimmed];
  const base = trimmed.replace(/\s*\(.*?\)\s*$/, "").trim();
  if (ORIGIN_COUNTRY_COORDS[base]) return ORIGIN_COUNTRY_COORDS[base];
  const norm = normalizeOriginName(base);
  if (!norm) return null;
  for (const entry of NORMALIZED_COUNTRY_ENTRIES) {
    if (entry.normalized === norm) return entry.coords;
  }
  // Region: exact normalized — checked before fuzzy country contains so a
  // bare "Asia" doesn't accidentally fuzz-match a country with "asia" in it.
  if (ORIGIN_REGION_COORDS[norm]) return ORIGIN_REGION_COORDS[norm];
  for (const region of Object.keys(ORIGIN_REGION_COORDS)) {
    if (norm.includes(region) || region.includes(norm)) {
      return ORIGIN_REGION_COORDS[region];
    }
  }
  // Country: fuzzy contains (last resort). Filter very short normalized
  // entries to avoid spurious matches.
  for (const entry of NORMALIZED_COUNTRY_ENTRIES) {
    if (entry.normalized.length < 5) continue;
    if (entry.normalized.includes(norm) || norm.includes(entry.normalized)) {
      return entry.coords;
    }
  }
  return null;
}

export type OriginPin = {
  label: string;
  coords: [number, number];
};

// Resolve a list of origin strings to pin positions, dropping unmatched
// entries. Use the result's length to decide whether the map is worth
// showing — if it's 0, render an empty-state badge instead.
export function resolveOriginPins(origins: string[] | null | undefined): OriginPin[] {
  if (!origins || origins.length === 0) return [];
  const pins: OriginPin[] = [];
  for (const o of origins) {
    const label = typeof o === "string" ? o.trim() : "";
    if (!label) continue;
    const coords = matchOriginToCoords(label);
    if (!coords) continue;
    pins.push({ label, coords });
  }
  return pins;
}
