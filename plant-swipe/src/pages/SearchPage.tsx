import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Plant } from "@/types/plant";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Flame, PartyPopper, Sparkles, Loader2, Sprout, FlaskConical, ArrowUp, Heart, Bookmark } from "lucide-react";
import { isNewPlant, isPlantOfTheMonth, isPopularPlant } from "@/lib/plantHighlights";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { AddToBookmarkDialog } from "@/components/plant/AddToBookmarkDialog";
import { ScrollingTitle } from "@/components/ui/scrolling-title";

interface SearchPageProps {
  plants: Plant[];
  openInfo: (p: Plant) => void;
  likedIds?: string[];
  toggleLiked?: (plantId: string) => void;
  userId?: string;
  ensureLoggedIn?: () => boolean;
}

export const SearchPage: React.FC<SearchPageProps> = React.memo(({
  plants,
  openInfo,
  likedIds = [],
  toggleLiked,
  userId,
  ensureLoggedIn,
}) => {
  const { t } = useTranslation("common");
  const seoTitle = t("seo.search.title", { defaultValue: "Advanced plant search" });
  const seoDescription = t("seo.search.description", {
    defaultValue: "Filter by color, season, rarity, and uses to pinpoint the right species for your next planting plan.",
  });
  usePageMetadata({ title: seoTitle, description: seoDescription });

  const [visibleCount, setVisibleCount] = useState(20);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Bookmark dialog state
  const [bookmarkPlantId, setBookmarkPlantId] = useState<string | null>(null);

  // Reset visible count when filters change (plants array changes)
  useEffect(() => {
    setVisibleCount(20);
  }, [plants]);

  // Show/hide scroll-to-top button based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling down 300px
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

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

  const handleLike = useCallback((e: React.MouseEvent, plantId: string) => {
    e.stopPropagation();
    if (ensureLoggedIn && !ensureLoggedIn()) return;
    toggleLiked?.(plantId);
  }, [toggleLiked, ensureLoggedIn]);

  const handleBookmark = useCallback((e: React.MouseEvent, plantId: string) => {
    e.stopPropagation();
    if (ensureLoggedIn && !ensureLoggedIn()) return;
    setBookmarkPlantId(plantId);
  }, [ensureLoggedIn]);

  const cardSurface =
    "group relative rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_35px_95px_-45px_rgba(16,185,129,0.65)]";

  const actionBtnBase =
    "p-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

  const visiblePlants = plants.slice(0, visibleCount);
  const hasMore = visibleCount < plants.length;

  return (
    <div className="max-w-6xl mx-auto mt-8 px-2 md:px-4 pb-16 space-y-6">
      {/* 2-column grid on mobile, 2-column on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6 items-stretch">
        {visiblePlants.map((p) => {
          // Check if plant is "in progress"
          const statusStr = (typeof p.status === 'string' ? p.status : typeof p.meta?.status === 'string' ? p.meta.status : '').toLowerCase()
          const isInProgress = statusStr === 'in_progress' || statusStr === 'in progres' || statusStr === 'in progress'
          const isLiked = likedIds.includes(p.id)

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
              {/* Mobile: Compact vertical card */}
              <div className="flex flex-col h-full md:hidden">
                <div className="relative w-full aspect-square flex-shrink-0 rounded-t-[28px] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
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
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isInProgress && (
                    <div className="absolute bottom-2 right-2 z-10">
                      <Badge className="rounded-full p-1.5 bg-amber-400 dark:bg-amber-500/80 text-amber-900 dark:text-amber-100">
                        <FlaskConical className="h-3 w-3" />
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1 min-w-0">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <ScrollingTitle className="font-semibold text-sm">{p.name}</ScrollingTitle>
                    <ScrollingTitle className="text-[10px] italic opacity-60">{p.scientificNameSpecies || p.scientificName}</ScrollingTitle>
                    {p.family && <ScrollingTitle className="text-[10px] opacity-50">{p.family}</ScrollingTitle>}
                    {p.variety && (
                      <ScrollingTitle className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{p.variety}</ScrollingTitle>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button
                      type="button"
                      onClick={(e) => handleLike(e, p.id)}
                      className={`${actionBtnBase} ${isLiked ? "text-rose-500 bg-rose-50 dark:bg-rose-500/10" : "text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"}`}
                      aria-label={isLiked ? t("plant.unlike", { defaultValue: "Unlike" }) : t("plant.like", { defaultValue: "Like" })}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleBookmark(e, p.id)}
                      className={`${actionBtnBase} text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`}
                      aria-label={t("plant.addToBookmark", { defaultValue: "Add to bookmark" })}
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop: Detailed horizontal card */}
              <div className="hidden md:grid md:grid-cols-[160px_1fr] items-stretch h-full min-h-[200px]">
                <div className="relative w-40 h-full flex-shrink-0 rounded-l-[28px] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
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
                  {isInProgress && (
                    <div className="absolute bottom-3 right-3 z-10">
                      <Badge className="rounded-full p-2 bg-amber-400 dark:bg-amber-500/80 text-amber-900 dark:text-amber-100">
                        <FlaskConical className="h-5 w-5" />
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col h-full min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <ScrollingTitle className="font-semibold text-lg">{p.name}</ScrollingTitle>
                      <ScrollingTitle className="text-xs italic opacity-60">{p.scientificNameSpecies || p.scientificName}</ScrollingTitle>
                      {p.family && <ScrollingTitle className="text-xs opacity-50">{p.family}</ScrollingTitle>}
                      {p.variety && (
                        <ScrollingTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{p.variety}</ScrollingTitle>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleLike(e, p.id)}
                        className={`${actionBtnBase} ${isLiked ? "text-rose-500 bg-rose-50 dark:bg-rose-500/10" : "text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"}`}
                        aria-label={isLiked ? t("plant.unlike", { defaultValue: "Unlike" }) : t("plant.like", { defaultValue: "Like" })}
                      >
                        <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleBookmark(e, p.id)}
                        className={`${actionBtnBase} text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`}
                        aria-label={t("plant.addToBookmark", { defaultValue: "Add to bookmark" })}
                      >
                        <Bookmark className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm line-clamp-2 text-stone-600 dark:text-stone-300 flex-1 mt-2">{p.description}</p>
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

      {/* Scroll to top button */}
      <Button
        onClick={scrollToTop}
        size="icon"
        aria-label={t("common.scrollToTop", { defaultValue: "Scroll to top" })}
        className={`fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </Button>

      {/* Bookmark dialog */}
      {userId && bookmarkPlantId && (
        <AddToBookmarkDialog
          open={!!bookmarkPlantId}
          onOpenChange={(open) => { if (!open) setBookmarkPlantId(null) }}
          plantId={bookmarkPlantId}
          userId={userId}
        />
      )}
    </div>
  );
});
