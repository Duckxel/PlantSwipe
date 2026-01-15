import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Plant, PlantSeason } from "@/types/plant";
import { rarityTone, seasonBadge } from "@/constants/badges";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Flame, PartyPopper, Sparkles, Loader2, Sprout } from "lucide-react";
import { isNewPlant, isPlantOfTheMonth, isPopularPlant } from "@/lib/plantHighlights";
import { usePageMetadata } from "@/hooks/usePageMetadata";

interface SearchPageProps {
  plants: Plant[];
  openInfo: (p: Plant) => void;
  likedIds?: string[];
  mobileGridCols?: 1 | 2;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  plants,
  openInfo,
  likedIds = [],
  mobileGridCols = 2,
}) => {
  const { t } = useTranslation("common");
  const seoTitle = t("seo.search.title", { defaultValue: "Advanced plant search" });
  const seoDescription = t("seo.search.description", {
    defaultValue: "Filter by color, season, rarity, and uses to pinpoint the right species for your next planting plan.",
  });
  usePageMetadata({ title: seoTitle, description: seoDescription });

  const [visibleCount, setVisibleCount] = useState(20);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change (plants array changes)
  useEffect(() => {
    setVisibleCount(20);
  }, [plants]);

  const showMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + 20, plants.length));
  }, [plants.length]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    // Disconnect previous observer if exists
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          showMore();
        }
      },
      {
        root: null, // viewport
        rootMargin: "100px", // load before it's fully visible
        threshold: 0.1,
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [showMore, visibleCount, plants.length]); // Re-attach when dependencies change

  const cardSurface =
    "group relative rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_35px_95px_-45px_rgba(16,185,129,0.65)]";

  const visiblePlants = plants.slice(0, visibleCount);
  const hasMore = visibleCount < plants.length;

  // Grid class based on mobile column preference
  const gridClass = mobileGridCols === 1 
    ? "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-stretch"
    : "grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6 items-stretch"

  return (
    <div className="max-w-6xl mx-auto mt-8 px-2 md:px-0 pb-16 space-y-6">
      <div className={gridClass}>
        {visiblePlants.map((p) => {
          const highlightBadges: Array<{ key: string; label: string; className: string; icon: React.ReactNode }> = []
          if (isPlantOfTheMonth(p)) {
            highlightBadges.push({
              key: `${p.id}-promotion`,
              label: t("discoveryPage.tags.plantOfMonth"),
              className: "bg-amber-400/90 text-amber-950",
              icon: <Sparkles className="h-4 w-4 mr-1" />,
            })
          }
          if (isNewPlant(p)) {
            highlightBadges.push({
              key: `${p.id}-new`,
              label: t("discoveryPage.tags.new"),
              className: "bg-emerald-500/90 text-white",
              icon: <PartyPopper className="h-4 w-4 mr-1" />,
            })
          }
          if (isPopularPlant(p)) {
            highlightBadges.push({
              key: `${p.id}-popular`,
              label: t("discoveryPage.tags.popular"),
              className: "bg-rose-600/90 text-white",
              icon: <Flame className="h-4 w-4 mr-1" />,
            })
          }
          // Compact card for 2-column mobile grid
          if (mobileGridCols === 2) {
            return (
              <Card
                key={p.id}
                className={`${cardSurface} h-full`}
                onClick={() => openInfo(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter") openInfo(p);
                }}
              >
                <div className="flex flex-col h-full">
                  {/* Image - square aspect on mobile, horizontal on desktop */}
                  <div className="relative w-full aspect-square md:aspect-[4/3] flex-shrink-0 rounded-t-[28px] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        draggable={false}
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover object-center select-none transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                        <Sprout className="h-10 w-10 text-emerald-400/50 dark:text-emerald-500/40" />
                      </div>
                    )}
                    {highlightBadges.length > 0 && (
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        {highlightBadges.slice(0, 1).map((badge) => (
                          <Badge key={badge.key} className={`rounded-xl px-2 py-0.5 text-[9px] font-semibold flex items-center ${badge.className}`}>
                            {badge.icon}
                            <span className="hidden sm:inline">{badge.label}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {likedIds.includes(p.id) && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="rounded-full p-1.5 bg-rose-600 dark:bg-rose-500 text-white">
                          <Flame className="h-3 w-3" />
                        </Badge>
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-3 md:p-4 space-y-1.5 flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`${rarityTone[p.rarity ?? "Common"]} rounded-lg text-[9px] px-1.5 py-0.5`}>{p.rarity}</Badge>
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold truncate text-sm md:text-base">{p.name}</div>
                      <div className="text-[10px] md:text-xs italic opacity-60 truncate">{p.scientificName}</div>
                    </div>
                    <p className="text-xs md:text-sm line-clamp-2 text-stone-600 dark:text-stone-300 flex-1 hidden md:block">{p.description}</p>
                  </div>
                </div>
              </Card>
            )
          }

          // Full card for single column layout
          return (
            <Card
              key={p.id}
              className={`${cardSurface} h-full min-h-[200px]`}
              onClick={() => openInfo(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter") openInfo(p);
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-stretch h-full">
                <div className="relative w-full h-52 sm:w-40 sm:h-full flex-shrink-0 rounded-t-[28px] sm:rounded-l-[28px] sm:rounded-tr-none overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      draggable={false}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-center select-none transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                      <Sprout className="h-12 w-12 text-emerald-400/50 dark:text-emerald-500/40" />
                    </div>
                  )}
                  {highlightBadges.length > 0 && (
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                      {highlightBadges.map((badge) => (
                        <Badge key={badge.key} className={`rounded-2xl px-3 py-1 text-[10px] font-semibold flex items-center ${badge.className}`}>
                          {badge.icon}
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2 flex flex-col h-full min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${rarityTone[p.rarity ?? "Common"]} rounded-xl`}>{p.rarity}</Badge>
                    {(p.seasons ?? []).map((s: PlantSeason) => {
                      const badgeClass =
                        seasonBadge[s] ?? "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100"
                      return (
                        <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>
                          {s}
                        </span>
                      )
                    })}
                    {likedIds.includes(p.id) && (
                      <Badge className="rounded-xl bg-rose-600 dark:bg-rose-500 text-white">{t("plant.liked")}</Badge>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-semibold truncate text-lg">{p.name}</div>
                    <div className="text-xs italic opacity-60 truncate">{p.scientificName}</div>
                  </div>
                  <p className="text-sm line-clamp-2 text-stone-600 dark:text-stone-300 flex-1">{p.description}</p>
                  <div className="flex flex-wrap gap-1 mt-auto max-h-[48px] overflow-hidden">
                    {(p.colors ?? []).map((c) => (
                      <Badge key={c} variant="secondary" className="rounded-xl text-[11px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="py-8 flex justify-center w-full"
        >
          <Button 
            variant="secondary" 
            onClick={showMore}
            className="w-full max-w-md rounded-2xl h-12 shadow-sm bg-white dark:bg-[#2d2d30] hover:bg-stone-50 dark:hover:bg-[#3e3e42] border border-stone-200 dark:border-[#3e3e42] transition-all"
          >
            {t("common.loadMore", { defaultValue: "Load more" })}
            <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-0 group-active:opacity-100" />
          </Button>
        </div>
      )}

      {plants.length === 0 && (
        <div className="text-center py-12 rounded-[28px] border border-dashed border-stone-200 dark:border-[#3e3e42] text-sm text-stone-500 dark:text-stone-300">
          {t("plant.noResults")}
        </div>
      )}
    </div>
  );
};
