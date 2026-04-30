import * as React from "react";
import JSZip from "jszip";
import { ArrowRight, Download, Sparkles, WandSparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item";

type PlantLite = {
  id: string; scientific_name: string; common_name: string | null; image_url: string | null;
  watering: string | null; sun_exposure: string | null; temperature_min_c: number | null; temperature_max_c: number | null;
  humidity: string | null; soil_type: string | null; native_area: string | null; family: string | null; genus: string | null;
  species: string | null; toxicity_pets: string | null; toxicity_humans: string | null; fun_fact: string | null;
  description: string | null; growth_rate: string | null; lifecycle: string | null;
};
const CARD_SIZE = { width: 1080, height: 1350 };
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const toPng = (node: HTMLElement) => new Promise<Blob>((resolve, reject) => {
  const xml = new XMLSerializer().serializeToString(node);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_SIZE.width}" height="${CARD_SIZE.height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = CARD_SIZE.width; c.height = CARD_SIZE.height;
    const ctx = c.getContext("2d"); if (!ctx) return reject(new Error("2d context unavailable"));
    ctx.drawImage(img, 0, 0); c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 1);
  }; img.onerror = reject; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});

export function AdminExportPanel() {
  const [plants, setPlants] = React.useState<PlantLite[]>([]);
  const [pickedOption, setPickedOption] = React.useState<SearchItemOption | null>(null);
  const [generatedPlant, setGeneratedPlant] = React.useState<PlantLite | null>(null);
  const [wildFact, setWildFact] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const cardRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  React.useEffect(() => { (async () => {
    const { data, error } = await supabase.from("plants").select("id, scientific_name, common_name, image_url, watering, sun_exposure, temperature_min_c, temperature_max_c, humidity, soil_type, native_area, family, genus, species, toxicity_pets, toxicity_humans, fun_fact, description, growth_rate, lifecycle").order("scientific_name", { ascending: true }).limit(600);
    if (error) console.error(error);
    setPlants((data ?? []) as PlantLite[]); setLoading(false);
  })(); }, []);

  const searchPlants = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    const q = query.toLowerCase().trim();
    return plants.filter((p) => !q || `${p.common_name || ""} ${p.scientific_name}`.toLowerCase().includes(q)).slice(0, 80).map((p) => ({
      id: p.id, label: p.common_name || p.scientific_name, description: p.scientific_name, meta: p.native_area || "Plant",
      icon: p.image_url ? <img src={p.image_url} className="h-8 w-8 rounded object-cover" /> : undefined,
    }));
  }, [plants]);

  const selected = React.useMemo(() => plants.find((p) => p.id === pickedOption?.id) ?? null, [plants, pickedOption]);
  const generate = React.useCallback(() => {
    if (!selected) return;
    setGeneratedPlant(selected);
    setWildFact(selected.fun_fact || selected.description || `${selected.common_name || selected.scientific_name} is the perfect flex: dramatic look, manageable care, instant jungle mood.`);
  }, [selected]);

  const regenerateWildFact = React.useCallback(() => {
    if (!generatedPlant) return;
    const n = generatedPlant.common_name || generatedPlant.scientific_name;
    setWildFact([
      `${n} makes apartments look like a boutique rainforest in weeks.`,
      `${n} is the “looks expensive, cares easy” plant everyone asks about.`,
      `${n} turns low-effort care into high-impact interior vibes.`,
    ][Math.floor(Math.random()*3)]);
  }, [generatedPlant]);

  const exportZip = React.useCallback(async () => {
    if (!generatedPlant) return;
    const zip = new JSZip();
    for (let i = 0; i < 4; i += 1) {
      const node = cardRefs.current[i]; if (!node) continue;
      zip.file(`${String(i + 1).padStart(2, "0")}-${slugify(generatedPlant.common_name || generatedPlant.scientific_name)}.png`, await toPng(node));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = `${slugify(generatedPlant.common_name || generatedPlant.scientific_name)}-instagram-cards.zip`; a.click(); URL.revokeObjectURL(a.href);
  }, [generatedPlant]);

  if (loading) return <div className="text-sm text-stone-500">Loading export studio…</div>;
  return <div className="space-y-4">
    <div className="rounded-2xl border p-4 bg-white/90 dark:bg-[#1b1b1d] space-y-3">
      <div className="text-sm text-stone-500">Choose a plant, then launch generation.</div>
      <div className="flex flex-wrap gap-3 items-center">
        <SearchItem value={pickedOption?.id ?? null} onSelect={setPickedOption} onSearch={searchPlants} initialOption={pickedOption} placeholder="Pick a plant" title="Pick plant" description="Select a plant for social card generation" searchPlaceholder="Search plant" className="min-w-[280px]"/>
        <Button onClick={generate} disabled={!selected}><WandSparkles className="h-4 w-4 mr-2"/>Generate 4 cards</Button>
        <Button variant="outline" onClick={regenerateWildFact} disabled={!generatedPlant}><Sparkles className="h-4 w-4 mr-2"/>New wild fact</Button>
        <Button onClick={exportZip} disabled={!generatedPlant}><Download className="h-4 w-4 mr-2"/>Download .zip</Button>
      </div>
    </div>
    {generatedPlant && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{[1,2,3,4].map((idx) => <div key={idx} className="rounded-2xl border p-3 bg-white dark:bg-[#121215]"><div ref={(el)=>{cardRefs.current[idx-1]=el;}} style={CARD_SIZE} className={`relative overflow-hidden rounded-[28px] border border-emerald-400/40 p-9 font-mono ${idx===2?"bg-[#f7f7f7] text-black":idx===3?"bg-[#041016] text-emerald-100":idx===4?"bg-[#2f9f73] text-white":"bg-[#050f0d] text-white"}`}>
      <img src="/assets/logo-dark.png" className="absolute top-6 left-6 h-8 opacity-90"/><div className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2"><ArrowRight className="h-5 w-5"/></div>
      {idx===1 && <><img src={generatedPlant.image_url || ""} className="absolute inset-0 h-full w-full object-cover opacity-60"/><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent"/><div className="relative mt-[58%]"><h2 className="text-7xl font-bold leading-[0.95]">{generatedPlant.common_name || generatedPlant.scientific_name}</h2><p className="text-lg italic opacity-80 mt-1">{generatedPlant.scientific_name}</p><div className="grid grid-cols-2 gap-2 mt-5 text-sm"><div>💧 {generatedPlant.watering || "Moderate"}</div><div>☀️ {generatedPlant.sun_exposure || "Bright"}</div><div>🌡️ {generatedPlant.temperature_min_c ?? 16}–{generatedPlant.temperature_max_c ?? 28}°C</div><div>💦 {generatedPlant.humidity || "60%"}</div></div></div></>}
      {idx===2 && <><h3 className="text-5xl font-bold italic">Surface Care</h3><div className="mt-4 grid gap-3">{[["Light",generatedPlant.sun_exposure],["Water",generatedPlant.watering],["Soil",generatedPlant.soil_type],["Humidity",generatedPlant.humidity]].map(([k,v])=><div key={String(k)} className="rounded-2xl border border-black/10 bg-white p-5"><div className="text-xs uppercase tracking-[0.2em]">{k}</div><div className="text-3xl font-bold mt-1">{v||"—"}</div></div>)}</div></>}
      {idx===3 && <><h3 className="text-5xl font-bold text-emerald-300">Science & Origin</h3><div className="mt-4 grid grid-cols-2 gap-3">{[["Origin",generatedPlant.native_area],["Family",generatedPlant.family],["Genus",generatedPlant.genus],["Species",generatedPlant.species],["Lifecycle",generatedPlant.lifecycle],["Growth",generatedPlant.growth_rate]].map(([k,v])=><div key={String(k)} className="rounded-xl border border-emerald-700/40 bg-emerald-950/25 p-4"><div className="text-xs uppercase text-emerald-300">{k}</div><div className="text-xl font-semibold">{v||"Unknown"}</div></div>)}</div></>}
      {idx===4 && <><h3 className="text-7xl italic font-bold leading-none">12</h3><p className="uppercase text-xs tracking-[0.28em]">months to explode</p><Input value={wildFact} onChange={(e)=>setWildFact(e.target.value)} className="mt-8 h-14 bg-black/85 border-white text-white"/><div className="mt-6 rounded-xl bg-black/80 border border-white/75 p-4 text-sm">“{wildFact}”</div><div className="mt-auto pt-6 grid grid-cols-3 gap-2 text-xs">{[generatedPlant.native_area,generatedPlant.lifecycle,generatedPlant.toxicity_pets||generatedPlant.toxicity_humans].map((v,i)=><div key={i} className="rounded-lg border border-white/30 bg-white/10 p-2">{v||"—"}</div>)}</div><div className="mt-4 text-right text-lg font-bold">Go to APHYLIA.APP</div></>}
    </div><div className="mt-2 text-xs text-stone-500">{idx===1?"01 · COVER":idx===2?"02 · ESSENTIALS":idx===3?"03 · DEEP":"04 · WILD"}</div></div>)}</div>}
  </div>;
}
