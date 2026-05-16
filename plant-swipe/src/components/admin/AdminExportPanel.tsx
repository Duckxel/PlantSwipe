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
  ScrollText,
  ChevronsDown,
  Shovel,
  Copy,
  Check,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
import {
  AdminExportBufferSchedule,
  canvasesToCardBlobs,
} from "@/components/admin/AdminExportBufferSchedule";
import { AdminExportAphydlePanel } from "@/components/admin/AdminExportAphydlePanel";
import { AdminExportAphyliaAutomation } from "@/components/admin/AdminExportAphyliaAutomation";
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item";
import {
  ImageViewer,
  useImageViewer,
  type ImageViewerImage,
} from "@/components/ui/image-viewer";
import worldMapDarkUrl from "@/assets/world-map-dark.svg";
import { ORIGIN_MAP_URL } from "@/lib/originCoords";
import {
  CARD_W,
  CARD_H,
  C,
  renderAphyliaCard,
  type Ctx as SharedCtx,
  type AnyImage,
  type IconSet as SharedIconSet,
  type PlantRow,
  type ColorRow,
} from "@/shared/aphyliaCardRenderer";

// Browser-side IconSet — same shape as the shared module's, but typed with
// HTMLImageElement so the React component's setState calls keep their DOM
// types. The shared module's IconSet uses the wider AnyImage so the same
// renderer accepts napi-rs/canvas Images server-side.
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
  scroll: HTMLImageElement | null;
  scrollGold: HTMLImageElement | null;
  chevDown: HTMLImageElement | null;
  chevDownInk: HTMLImageElement | null;
  shovel: HTMLImageElement | null;
  sunCream: HTMLImageElement | null;
};

type Translation = {
  language?: string;
  variety?: string | null;
  presentation?: string | null;
  common_names?: string[] | null;
  origin?: string[] | null;
};

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

type ExportAiContent = {
  historicalFact: string;
  gardenerTip: string;
  postDescription: string;
};

const EMPTY_AI_CONTENT: ExportAiContent = {
  historicalFact: "",
  gardenerTip: "",
  postDescription: "",
};

async function fetchExportAiContent(
  plantName: string,
  scientificName: string,
  family: string,
  variety: string,
  signal?: AbortSignal,
): Promise<ExportAiContent> {
  if (!plantName) return EMPTY_AI_CONTENT;
  try {
    const headers = await buildAdminAuthHeaders();
    const res = await fetch("/api/admin/ai/plant-export-content", {
      method: "POST",
      headers,
      body: JSON.stringify({ plantName, scientificName, family, variety }),
      signal,
    });
    if (!res.ok) return EMPTY_AI_CONTENT;
    const data = (await res.json()) as {
      success?: boolean;
      historicalFact?: string;
      factConfidence?: string;
      gardenerTip?: string;
      postDescription?: string;
    };
    if (!data?.success) return EMPTY_AI_CONTENT;
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
  } catch {
    return EMPTY_AI_CONTENT;
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
  /** AI-generated, verified historical fact about the plant — Card 3. */
  historicalFact: string;
  /** One concrete care tip a beginner gardener would miss — Card 2. */
  gardenerTip: string;
  /** Instagram-caption body (without URLs/hashtags). */
  postDescription: string;
  /** Public Aphylia URL of the plant (constructed from plant.id). */
  plantUrl: string;
  icons: IconSet | null;
  logoWhite: HTMLImageElement | null;
  logoBlack: HTMLImageElement | null;
};

async function renderCardCanvas(
  index: number,
  b: Bundle,
): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  // The shared renderer types Ctx/AnyImage/IconSet loosely so the same
  // module accepts both HTMLCanvasElement contexts here and @napi-rs/canvas
  // contexts in the server-side renderer. The browser types are a strict
  // structural subset; cast through unknown to bridge the two.
  renderAphyliaCard({
    ctx: ctx as unknown as SharedCtx,
    cardIndex: index as 0 | 1 | 2 | 3,
    plant: b.plant,
    images: b.images as unknown as AnyImage[],
    variety: b.variety,
    commonNames: b.commonNames,
    origin: b.origin,
    colors: b.colors,
    icons: b.icons as unknown as SharedIconSet | null,
    logoWhite: b.logoWhite as unknown as AnyImage | null,
    logoBlack: b.logoBlack as unknown as AnyImage | null,
    originMap: b.originMap as unknown as AnyImage | null,
    worldMap: b.worldMap as unknown as AnyImage | null,
    ai: { historicalFact: b.historicalFact, gardenerTip: b.gardenerTip },
  });
  return c;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png", 1),
  );
}

// — component ------------------------------------------------------------

const CARD_LABELS = ["Cover", "Identity", "Deep Knowledge", "Wild Card"] as const;

type ExportMode = "aphylia" | "aphydle";

const EXPORT_MODE_TABS: Array<{ key: ExportMode; label: string }> = [
  { key: "aphylia", label: "Aphylia" },
  { key: "aphydle", label: "Aphydle" },
];

export function AdminExportPanel() {
  const [mode, setMode] = React.useState<ExportMode>("aphylia");
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
  const viewer = useImageViewer();
  const [captionCopied, setCaptionCopied] = React.useState(false);

  // Build the full Instagram caption: AI-generated body + plant page link +
  // aphylia.app CTA + a small hashtag set so the post is shareable as-is.
  const fullCaption = React.useMemo(() => {
    if (!bundle) return "";
    const lines: string[] = [];
    if (bundle.postDescription) lines.push(bundle.postDescription.trim());
    lines.push("");
    lines.push(`🔗 Full plant guide → ${bundle.plantUrl}`);
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
    return lines.join("\n");
  }, [bundle]);

  const copyCaption = React.useCallback(async () => {
    if (!fullCaption) return;
    try {
      await navigator.clipboard.writeText(fullCaption);
      setCaptionCopied(true);
      window.setTimeout(() => setCaptionCopied(false), 1800);
    } catch {
      // Older browsers — fallback via a temp textarea.
      const ta = document.createElement("textarea");
      ta.value = fullCaption;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCaptionCopied(true);
        window.setTimeout(() => setCaptionCopied(false), 1800);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }, [fullCaption]);

  // Snapshot every preview canvas to a PNG data URL and open the shared
  // ImageViewer at the clicked card. Lazy: built on click so the data URLs
  // always reflect the latest paint (post-AI fact arrival, post-asset splice)
  // instead of going stale next to React state.
  const openFullPreview = React.useCallback(
    (clickedIndex: number) => {
      const imgs: ImageViewerImage[] = [];
      for (let i = 0; i < 4; i++) {
        const c = previewRefs.current[i];
        if (!c) continue;
        try {
          imgs.push({
            src: c.toDataURL("image/png"),
            alt: `Aphylia card ${i + 1} — ${CARD_LABELS[i]}`,
          });
        } catch {
          // Tainted canvas (a plant image failed CORS, fallback also blocked)
          // — skip the card rather than throw the whole gallery.
        }
      }
      if (imgs.length === 0) return;
      const start = Math.min(Math.max(clickedIndex, 0), imgs.length - 1);
      viewer.openGallery(imgs, start);
    },
    [viewer],
  );

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
        scroll,
        scrollGold,
        chevDown,
        chevDownInk,
        shovel,
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
        lucideImage(ScrollText, C.cream, 64, 2),
        lucideImage(ScrollText, C.gold, 96, 2.2),
        lucideImage(ChevronsDown, C.cream, 96, 2.5),
        // Emerald-dark chevron for Card 4's cream surface — using the
        // cream-tinted version on the light bg made the cue invisible.
        lucideImage(ChevronsDown, "#059669", 96, 2.5),
        lucideImage(Shovel, C.ink, 64, 2),
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
        scroll,
        scrollGold,
        chevDown,
        chevDownInk,
        shovel,
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
      // Fetch primary image AND English variety in parallel — variety is the
      // common "Cherry" / "Beefsteak" suffix that disambiguates two rows
      // sharing the same `name` (Tomato + Tomato), so the picker has to show
      // it inline. Without it, two cards with identical labels are
      // indistinguishable.
      const [imgsRes, transRes] = await Promise.all([
        supabase
          .from("plant_images")
          .select("plant_id,link")
          .in("plant_id", ids)
          .eq("use", "primary"),
        supabase
          .from("plant_translations")
          .select("plant_id,language,variety")
          .in("plant_id", ids)
          .eq("language", "en"),
      ]);
      const imgMap = new Map(
        ((imgsRes.data as { plant_id: string; link: string }[]) || []).map(
          (i) => [i.plant_id, i.link],
        ),
      );
      const varMap = new Map(
        ((transRes.data as { plant_id: string; variety: string | null }[]) ||
          []).map((t) => [t.plant_id, (t.variety || "").trim()]),
      );
      const rows: SearchItemOption[] = (data as PlantRow[]).map((p) => {
        const id = p.id as string;
        const baseName = (p.name as string) || "Unknown";
        const variety = varMap.get(id) || "";
        const photoUrl = imgMap.get(id) || "";
        // Garden-style tile rendering — icon, label, description carry just
        // what the custom renderItem needs. Family / scientific name dropped
        // intentionally so the tile reads cleanly.
        return {
          id,
          label: baseName,
          description: variety,
          meta: photoUrl,
        };
      });
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
      // Fire image loads + AI content in parallel so the slow OpenAI hop
      // overlaps with the network round-trips for the photos.
      const plantNameStr = String(plant.name || "").trim();
      const sciNameStr = String(plant.scientific_name_species || "").trim();
      const familyStr = String(plant.family || "").trim();
      const plantId = String(plant.id || picked.id || "");
      const plantUrl = plantId ? `https://aphylia.app/plants/${plantId}` : "https://aphylia.app";
      const [loaded, ai] = await Promise.all([
        Promise.all(rawImgs.map((r) => loadCanvasImage(r.link))),
        fetchExportAiContent(plantNameStr, sciNameStr, familyStr, variety),
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
        historicalFact: ai.historicalFact,
        gardenerTip: ai.gardenerTip,
        postDescription: ai.postDescription,
        plantUrl,
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
      // info.txt — drop the assembled Instagram caption (AI body + plant
      // link + Aphylia CTA + hashtags) into the zip so the user has the
      // copy-paste post text bundled with the cards. Mirrors what the
      // textarea + Copy button surface in the UI; identical content so a
      // poster can grab the zip on one device, the caption on another.
      const plantName = String(bundle.plant.name || "Plant");
      const sci = String(bundle.plant.scientific_name_species || "").trim();
      const headerLines = [
        `Aphylia · ${plantName}${sci ? ` (${sci})` : ""}`,
        `Plant page: ${bundle.plantUrl}`,
        `Generated: ${new Date().toISOString()}`,
        "",
        "── INSTAGRAM CAPTION ───────────────────────────────",
        "",
      ];
      const captionForFile = fullCaption || "(caption unavailable)";
      const tipBlock = bundle.gardenerTip
        ? [
            "",
            "── GARDENER'S NOTE ─────────────────────────────────",
            "",
            bundle.gardenerTip,
          ]
        : [];
      const factBlock = bundle.historicalFact
        ? [
            "",
            "── HISTORICAL FACT ─────────────────────────────────",
            "",
            bundle.historicalFact,
          ]
        : [];
      const infoText = [
        ...headerLines,
        captionForFile,
        ...tipBlock,
        ...factBlock,
        "",
      ].join("\n");
      zip.file("info.txt", infoText);

      const a = document.createElement("a");
      a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      a.download = `${stem}-aphylia-cards.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } finally {
      setExporting(false);
    }
  }, [bundle]);

  if (mode === "aphydle") {
    return (
      <div className="space-y-4">
        <PillTabs<ExportMode>
          tabs={EXPORT_MODE_TABS}
          activeKey={mode}
          onTabChange={setMode}
        />
        <AdminExportAphydlePanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PillTabs<ExportMode>
        tabs={EXPORT_MODE_TABS}
        activeKey={mode}
        onTabChange={setMode}
      />
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
            renderItem={(option) => {
              const photoUrl = option.meta || "";
              const variety = (option.description || "").trim();
              return (
                <div className="flex flex-col w-full">
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900 overflow-hidden">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={option.label}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-40">
                        🌿
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="font-semibold text-sm text-stone-900 dark:text-white truncate">
                      {option.label}
                    </div>
                    {variety && (
                      <div className="mt-0.5 text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent tracking-tight truncate">
                        &lsquo;{variety}&rsquo;
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
          <Button onClick={() => void generate()} disabled={!picked || loading}>
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <WandSparkles className="h-4 w-4 mr-2" />
            )}
            {loading
              ? "Generating cards + AI fact…"
              : "Generate cards"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void generate()}
            disabled={!bundle || loading}
            title="Re-run plant data + AI fact (same as Generate)"
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
              <button
                type="button"
                onClick={() => openFullPreview(i)}
                title="Click to preview at full size"
                className="block w-full rounded-2xl overflow-hidden bg-black/30 border border-stone-700/30 shadow-xl cursor-zoom-in transition-transform hover:scale-[1.015] hover:border-emerald-500/40 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <canvas
                  ref={(el) => {
                    previewRefs.current[i] = el;
                  }}
                  width={CARD_W}
                  height={CARD_H}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </button>
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

      {bundle && (
        <div className="rounded-2xl border bg-white/90 dark:bg-[#17171a] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
                Instagram caption
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Click the block to select all, or hit Copy. Also saved as
                <code className="mx-1 px-1 py-0.5 rounded bg-stone-200/80 dark:bg-stone-800 text-[11px]">info.txt</code>
                inside the ZIP.
              </div>
            </div>
          </div>
          <div className="group relative rounded-xl border border-stone-300 dark:border-stone-700/60 bg-[#0f1011] shadow-inner overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-[#17181b]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-[11px] uppercase tracking-[0.2em] text-stone-400 font-mono">
                  caption.txt
                </span>
              </div>
              <button
                type="button"
                onClick={() => void copyCaption()}
                disabled={!fullCaption}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
                  captionCopied
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-stone-800/80 hover:bg-stone-700 text-stone-200 border border-stone-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {captionCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
            <pre
              onClick={(e) => {
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                const sel = window.getSelection();
                if (sel) {
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
              }}
              className="m-0 p-4 max-h-[420px] overflow-auto font-mono text-[13px] leading-relaxed text-stone-100 whitespace-pre-wrap break-words cursor-text selection:bg-emerald-500/30"
            >
              {fullCaption || "(caption unavailable)"}
            </pre>
          </div>
        </div>
      )}

      {bundle && (
        <AdminExportBufferSchedule
          caption={fullCaption}
          getCardBlobs={() => canvasesToCardBlobs(previewRefs.current)}
          cardCount={4}
          plantName={String(bundle.plant.name || "")}
          disabled={loading || exporting}
        />
      )}

      <AdminExportAphyliaAutomation />

      <ImageViewer
        {...viewer.props}
        title="Aphylia plant cards preview"
        enableDownload={false}
      />
    </div>
  );
}
