import React from "react";
import type { Plant, PlantSeason } from "@/types/plant";
import { rarityTone, seasonBadge } from "@/constants/badges";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface SearchPageProps {
  plants: Plant[];
  openInfo: (p: Plant) => void;
  likedIds?: string[];
}

export const SearchPage: React.FC<SearchPageProps> = ({
  plants,
  openInfo,
  likedIds = [],
}) => {
  const { t } = useTranslation("common");
  const cardSurface =
    "relative rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_35px_95px_-45px_rgba(16,185,129,0.65)]";

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0 pb-16 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plants.map((p) => (
          <Card
            key={p.id}
            className={cardSurface}
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
                ) : null}
              </div>
                <div className="p-4 space-y-2 flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={`${rarityTone[p.rarity ?? "Common"]} rounded-xl`}
                  >
                    {p.rarity}
                  </Badge>
                  {p.seasons.map((s: PlantSeason) => {
                    const badgeClass =
                      seasonBadge[s] ??
                      "bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100";
                    return (
                      <span
                        key={s}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}
                      >
                        {s}
                      </span>
                    );
                  })}
                  {likedIds.includes(p.id) && (
                    <Badge className="rounded-xl bg-rose-600 dark:bg-rose-500 text-white">
                      {t("plant.liked")}
                    </Badge>
                  )}
                </div>
                <div>
                  <div className="font-semibold truncate text-lg">{p.name}</div>
                  <div className="text-xs italic opacity-60 truncate">
                    {p.scientificName}
                  </div>
                </div>
                <p className="text-sm line-clamp-2 text-stone-600 dark:text-stone-300 flex-1">
                  {p.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.colors.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="rounded-xl text-[11px]"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {plants.length === 0 && (
        <div className="text-center py-12 rounded-[28px] border border-dashed border-stone-200 dark:border-[#3e3e42] text-sm text-stone-500 dark:text-stone-300">
          {t("plant.noResults")}
        </div>
      )}
    </div>
  );
};
