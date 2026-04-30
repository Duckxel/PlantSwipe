import * as React from "react";
import JSZip from "jszip";
import { ArrowRight, Download, Sparkles, WandSparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchItem, type SearchItemOption } from "@/components/ui/search-item";

type PlantRow = Record<string, unknown>;
const CARD = { w: 1080, h: 1350 };
const pretty = (v: unknown) => String(v ?? "—").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url;
  });
}

async function renderCardBlob(index: number, plant: PlantRow, wildFact: string): Promise<Blob> {
  const c = document.createElement("canvas"); c.width = CARD.w; c.height = CARD.h;
  const ctx = c.getContext("2d"); if (!ctx) throw new Error("canvas unavailable");
  const name = pretty(plant.name || "Plant"); const sci = String(plant.scientific_name_species || "");
  const image = await loadImage(String(plant.image || ""));
  const drawHeader = () => { ctx.fillStyle = "#ffffff"; ctx.font = "700 34px 'Fira Code', monospace"; ctx.fillText("Aphylia", 44, 58); ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "600 18px 'Fira Code', monospace"; ctx.fillText(`${String(index+1).padStart(2,"0")} / 04`, CARD.w-140, 58); };
  if (index===0) {
    ctx.fillStyle="#07120d";ctx.fillRect(0,0,CARD.w,CARD.h);
    if (image) {ctx.drawImage(image,0,0,CARD.w,CARD.h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,CARD.w,CARD.h);} 
    drawHeader(); ctx.fillStyle='#fff';ctx.font="700 96px 'Fira Code', monospace";ctx.fillText(name,64,1040);ctx.font="500 36px 'Fira Code', monospace";ctx.fillText(sci,64,1090);
  } else if (index===1) {
    ctx.fillStyle='#f3f3f3';ctx.fillRect(0,0,CARD.w,CARD.h); drawHeader(); ctx.fillStyle='#111';ctx.font="700 78px 'Fira Code', monospace";ctx.fillText('Surface Care',64,170);
    const rows=[["Light",pretty(plant.sunlight)],["Soil",pretty(plant.substrate)],["Humidity",pretty(plant.humidity)],["Care",pretty(plant.maintenance)]];
    rows.forEach((r,i)=>{const y=220+i*220;ctx.fillStyle='#fff';ctx.strokeStyle='#ddd';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(64,y,952,180,20);ctx.fill();ctx.stroke();ctx.fillStyle='#666';ctx.font="500 20px 'Fira Code', monospace";ctx.fillText(r[0],96,y+48);ctx.fillStyle='#000';ctx.font="700 46px 'Fira Code', monospace";ctx.fillText(r[1],96,y+118);});
  } else if (index===2) {
    ctx.fillStyle='#081014';ctx.fillRect(0,0,CARD.w,CARD.h); drawHeader(); ctx.fillStyle='#64f0c2';ctx.font="700 72px 'Fira Code', monospace";ctx.fillText('Science & Origin',64,160);
    const rows=[["Origin",pretty(plant.origin)],["Family",pretty(plant.family)],["Genus",pretty(plant.genus)],["Species",pretty(plant.species)],["Temp",`${plant.temperature_min ?? '?'}-${plant.temperature_max ?? '?'}°C`],["Toxicity",pretty(plant.toxicity_pets||plant.toxicity)]];
    rows.forEach((r,i)=>{const x=64+(i%2)*476,y=210+Math.floor(i/2)*300;ctx.fillStyle='rgba(14,40,30,.8)';ctx.strokeStyle='rgba(100,240,194,.35)';ctx.beginPath();ctx.roundRect(x,y,440,250,18);ctx.fill();ctx.stroke();ctx.fillStyle='#86ffd8';ctx.font="500 18px 'Fira Code', monospace";ctx.fillText(r[0],x+24,y+42);ctx.fillStyle='#fff';ctx.font="700 38px 'Fira Code', monospace";ctx.fillText(String(r[1]).slice(0,22),x+24,y+118);});
  } else {
    ctx.fillStyle='#2f9f73';ctx.fillRect(0,0,CARD.w,CARD.h); drawHeader(); ctx.fillStyle='#fff';ctx.font="700 140px 'Fira Code', monospace";ctx.fillText('12',64,180);
    ctx.font="600 18px 'Fira Code', monospace";ctx.fillText('MONTHS TO REMEMBER',72,220);
    ctx.fillStyle='rgba(15,18,17,.86)';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(50,330,980,360,18);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font="600 34px 'Fira Code', monospace";ctx.fillText(wildFact.slice(0,95),80,430);
    ctx.font="700 34px 'Fira Code', monospace";ctx.fillText('Go to APHYLIA.APP',730,1280);
  }
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob failed')),'image/png',1));
}

const PreviewFrame = ({ children, setRef }: { children: React.ReactNode; setRef: (el: HTMLDivElement | null) => void }) => {
  const scale = 0.28;
  return <div className="rounded-xl border bg-black/20 p-2 overflow-hidden"><div className="origin-top-left" style={{ width: CARD.w * scale, height: CARD.h * scale }}><div ref={setRef} style={{ width: CARD.w, height: CARD.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div></div></div>;
};

export function AdminExportPanel() {
  const [picked, setPicked] = React.useState<SearchItemOption | null>(null);
  const [generated, setGenerated] = React.useState<PlantRow | null>(null);
  const [wildFact, setWildFact] = React.useState("");
  const [options, setOptions] = React.useState<SearchItemOption[]>([]);
  const cardRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const searchPlants = React.useCallback(async (query: string): Promise<SearchItemOption[]> => {
    let q = supabase.from("plants").select("id,name,scientific_name_species").order("name").limit(30);
    if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
    const { data } = await q;
    if (!data?.length) return [];
    const ids = data.map((p: Record<string, unknown>) => p.id as string);
    const { data: imgs } = await supabase.from("plant_images").select("plant_id,link").in("plant_id", ids).eq("use", "primary");
    const map = new Map((imgs || []).map((i: { plant_id: string; link: string }) => [i.plant_id, i.link]));
    const rows = data.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      label: (p.name as string) || "Unknown",
      description: (p.scientific_name_species as string) || "",
      icon: map.get(p.id as string) ? <img src={map.get(p.id as string)} className="h-9 w-9 rounded object-cover" /> : undefined,
    }));
    setOptions(rows);
    return rows;
  }, []);

  const generate = React.useCallback(async () => {
    if (!picked?.id) return;
    const { data } = await supabase.from("plants").select("*").eq("id", picked.id).single();
    const { data: img } = await supabase.from("plant_images").select("link").eq("plant_id", picked.id).eq("use", "primary").maybeSingle();
    const d = { ...(data || {}), image: img?.link || null };
    setGenerated(d);
    setWildFact((d.fun_fact as string) || `${d.name} is a statement plant that makes every room feel curated.`);
  }, [picked]);

  const exportZip = React.useCallback(async () => {
    if (!generated) return;
    const zip = new JSZip();
    for (let i = 0; i < 4; i++) {
      zip.file(`${String(i + 1).padStart(2, "0")}-${slug(String(generated.name || "plant"))}.png`, await renderCardBlob(i, generated, wildFact));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = `${slug(String(generated.name || "plant"))}-cards.zip`; a.click(); URL.revokeObjectURL(a.href);
  }, [generated]);

  const heroName = pretty(generated?.name || "Plant");
  const sci = String(generated?.scientific_name_species || "");
  const image = String(generated?.image || "");

  return <div className="space-y-4">
    <div className="rounded-2xl border p-4 bg-white/90 dark:bg-[#17171a]">
      <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">Export Studio</div>
      <div className="flex flex-wrap gap-2 items-center">
        <SearchItem value={picked?.id ?? null} onSelect={setPicked} onSearch={searchPlants} options={options} initialOption={picked} placeholder="Pick plant" title="Search plants by name" description="Choose a plant then generate 4 social cards" searchPlaceholder="Search plants by name" className="min-w-[280px]" />
        <Button onClick={() => void generate()} disabled={!picked}><WandSparkles className="h-4 w-4 mr-2"/>Generate 4 cards</Button>
        <Button variant="outline" onClick={() => setWildFact(`Did you know? ${heroName} can transform a dull corner into a lush highlight.`)} disabled={!generated}><Sparkles className="h-4 w-4 mr-2"/>Wild refresh</Button>
        <Button onClick={() => void exportZip()} disabled={!generated}><Download className="h-4 w-4 mr-2"/>Download .zip</Button>
      </div>
    </div>

    {generated && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {[0,1,2,3].map((i) => <div key={i}><PreviewFrame setRef={(el) => { cardRefs.current[i] = el; }}>
        <div style={{ width: CARD.w, height: CARD.h }} className={`relative overflow-hidden rounded-[28px] font-mono p-12 ${i===1?"bg-[#f2f2f2] text-black":i===2?"bg-[#081014] text-emerald-100":i===3?"bg-[#2f9f73] text-white":"bg-[#07120d] text-white"}`}>
          <img src="/assets/logo-dark.png" className="absolute left-8 top-8 h-10 opacity-90"/><div className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/35 rounded-full p-2"><ArrowRight className="h-5 w-5"/></div>
          {i===0 && <><img src={image} className="absolute inset-0 h-full w-full object-cover opacity-60"/><div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent"/><div className="relative mt-[62%]"><h2 className="text-7xl font-bold leading-[0.92]">{heroName}</h2><p className="opacity-80 mt-2">{sci}</p></div></>}
          {i===1 && <><h3 className="text-6xl font-bold">Surface Care</h3><div className="mt-8 space-y-4">{[["Light",String(generated.sunlight ?? "")],["Soil",String(generated.substrate ?? "")],["Humidity",String(generated.humidity ?? "")],["Care",String(generated.maintenance ?? "")]].map(([k,v])=><div key={String(k)} className="rounded-2xl border bg-white p-5"><div className="text-xs tracking-[0.2em] uppercase">{k}</div><div className="text-4xl font-bold mt-1 break-words">{pretty(v)}</div></div>)}</div></>}
          {i===2 && <><h3 className="text-5xl font-bold text-emerald-300">Science & Origin</h3><div className="mt-8 grid grid-cols-2 gap-3">{[["Origin",String(generated.origin ?? "")],["Family",String(generated.family ?? "")],["Genus",String(generated.genus ?? "")],["Species",String(generated.species ?? "")],["Temp",`${generated.temperature_min ?? "?"}–${generated.temperature_max ?? "?"}°C`],["Toxicity",String((generated.toxicity_pets || generated.toxicity || ""))]].map(([k,v])=><div key={String(k)} className="rounded-xl border border-emerald-800/40 bg-black/25 p-4"><div className="text-xs uppercase text-emerald-300">{k}</div><div className="text-2xl font-bold mt-1 break-words">{pretty(v)}</div></div>)}</div></>}
          {i===3 && <><h3 className="text-7xl italic font-bold">12</h3><p className="uppercase tracking-[0.25em] text-xs">Months to remember</p><Input className="mt-8 h-14 bg-black/80 border-white text-white" value={wildFact} onChange={(e)=>setWildFact(e.target.value)}/><div className="mt-5 rounded-xl border border-white/80 bg-black/80 p-4 text-sm">"{wildFact}"</div><div className="absolute bottom-8 right-8 text-lg font-bold">Go to APHYLIA.APP</div></>}
        </div>
      </PreviewFrame><div className="text-xs mt-2 text-stone-500">{i+1}. {['Cover','Essentials','Deep','Wild'][i]}</div></div>)}
    </div>}
  </div>;
}
