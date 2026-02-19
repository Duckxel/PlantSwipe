import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

const gardenCardClass = "rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur shadow-sm"
const glassCardClass = "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#17171a]/90 backdrop-blur-sm shadow-lg"

// Skeleton for Garden List Card — matches 2-col mobile grid with compact cards
export const GardenCardSkeleton: React.FC = () => {
  return (
    <Card className="rounded-[22px] md:rounded-[28px] overflow-hidden relative border border-stone-200/80 dark:border-[#3e3e42]/80 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur shadow-[0_25px_70px_-40px_rgba(15,23,42,0.65)]">
      <div className="pointer-events-none absolute top-2 right-2 z-20">
        <Skeleton className="w-12 h-6 rounded-xl" />
      </div>

      <div className="relative aspect-[4/3] md:aspect-[5/3] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-200 dark:from-[#2d2d30] dark:via-[#2a2a2e] dark:to-[#1f1f1f]">
        <Skeleton className="w-full h-full rounded-none" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400/40 dark:text-stone-500/40" />
        </div>
      </div>

      <div className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 md:h-5 w-3/4 rounded-lg" />
            <div className="flex items-center flex-wrap gap-2 md:gap-3">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-3 md:h-4 w-16 md:w-20 rounded-md" />
              </div>
            </div>
          </div>
          <div className="hidden md:block flex-shrink-0">
            <Skeleton className="w-5 h-5 rounded" />
          </div>
        </div>
      </div>
    </Card>
  )
}

// Skeleton for the full garden list page — 2-col grid matching the actual layout
export const GardenListSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-5">
      {Array.from({ length: 4 }).map((_, idx) => (
        <GardenCardSkeleton key={idx} />
      ))}
    </div>
  )
}

// Skeleton for Overview Section — matches the Garden Dashboard OverviewSection layout
export const OverviewSectionSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Hero Section skeleton — no-cover variant with gradient bg */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50 dark:from-[#1a2e1a] dark:via-[#1a1a1a] dark:to-[#2a1f0a] min-h-[200px] p-8 md:p-10">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <Skeleton className="h-10 w-56 md:w-72 rounded-xl" />
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-26 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Members Section skeleton */}
      <Card className={`${gardenCardClass} p-5 overflow-hidden`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-36 rounded-lg" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl px-3 py-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-3 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Plants Gallery skeleton — grid-cols-2 sm:3 md:4 lg:5 with aspect-[4/5] */}
      <Card className={`${gardenCardClass} p-5 overflow-hidden`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-32 rounded-lg" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30">
              <Skeleton className="w-full h-full rounded-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                <Skeleton className="h-4 w-3/4 rounded-md bg-white/20" />
                <Skeleton className="h-3 w-1/2 rounded-md bg-white/15" />
              </div>
              <div className="absolute top-2 right-2">
                <Skeleton className="h-5 w-8 rounded-full bg-white/20" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 30-Day Calendar skeleton */}
      <Card className={`${gardenCardClass} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-28 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Skeleton className="w-3 h-3 rounded" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="w-3 h-3 rounded" />
              <Skeleton className="h-3 w-14 rounded-md" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 md:grid-cols-10 gap-2">
          {Array.from({ length: 30 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-square rounded-xl" />
          ))}
        </div>
      </Card>

      {/* Activity Feed skeleton */}
      <Card className={`${gardenCardClass} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-28 rounded-lg" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-4 w-36 rounded-md" />
                </div>
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// Skeleton for Profile Page Stat Card
const ProfileStatCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1f1f1f]/50 p-4 text-center min-w-[120px]">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Skeleton className="h-5 w-5 rounded-lg" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <Skeleton className="h-6 w-12 mx-auto rounded-lg" />
    </div>
  )
}

// Profile hero card style
const profileHeroCardClass = "relative overflow-hidden rounded-[32px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-emerald-50/80 via-white to-stone-100/80 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] shadow-lg"

// Skeleton for Profile Page
export const ProfilePageSkeleton: React.FC = () => {
  return (
    <>
      <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 space-y-6">
        {/* Main profile card skeleton */}
        <Card className={profileHeroCardClass}>
          {/* Decorative blur elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-6 -right-8 h-32 w-32 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-emerald-100/40 dark:bg-emerald-500/5 blur-3xl" />
          </div>
          
          <CardContent className="relative z-10 p-6 md:p-8 space-y-4">
            <div className="flex items-start gap-4">
              {/* Avatar skeleton */}
              <div className="relative">
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-stone-400/50" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0 space-y-3">
                {/* Name and badge skeleton */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Skeleton className="h-7 w-48 rounded-xl" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                
                {/* Location skeleton */}
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
                
                {/* Status and joined date skeleton */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-32 rounded-md" />
                </div>
              </div>
              
              {/* Action button skeleton */}
              <div className="ml-auto flex-shrink-0">
                <Skeleton className="h-10 w-10 rounded-2xl" />
              </div>
            </div>
            
            {/* Bio skeleton */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* Highlights card skeleton */}
        <Card className={glassCardClass}>
          <CardContent className="p-6 md:p-8 space-y-6">
            {/* Title skeleton */}
            <Skeleton className="h-6 w-32 rounded-lg" />
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              {/* Heatmap skeleton - left side */}
              <div className="flex-1 flex justify-center items-center">
                <div className="grid grid-rows-4 grid-flow-col auto-cols-max gap-1.5 sm:gap-2">
                  {Array.from({ length: 28 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-8 w-8 sm:h-10 sm:w-10 rounded-[4px]" />
                  ))}
                </div>
              </div>
              
              {/* Divider skeleton */}
              <div className="hidden md:block w-px h-full min-h-[200px] bg-stone-200/70 dark:bg-[#3e3e42]/70" />
              
              {/* Stat cards skeleton - right side, 2x2 grid */}
              <div className="flex-1 flex justify-center items-center">
                <div className="grid grid-cols-2 gap-3">
                  <ProfileStatCardSkeleton />
                  <ProfileStatCardSkeleton />
                  <ProfileStatCardSkeleton />
                  <ProfileStatCardSkeleton />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gardens section skeleton */}
        <Card className={glassCardClass}>
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-lg" />
                <Skeleton className="h-6 w-32 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1f1f1f]/50 overflow-hidden">
                  <Skeleton className="aspect-[16/10] w-full rounded-none" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-5 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bookmarks section skeleton */}
        <Card className={glassCardClass}>
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-lg" />
              <Skeleton className="h-6 w-28 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/50 dark:bg-[#1f1f1f]/50 overflow-hidden">
                  <Skeleton className="aspect-square w-full rounded-none" />
                  <div className="p-2">
                    <Skeleton className="h-4 w-full rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// Plant Info Page Skeleton — matches PlantDetails + MoreInformationSection layout
export const PlantInfoPageSkeleton: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-12 sm:pb-14 space-y-4 sm:space-y-5"
    >
      <span className="sr-only">{label}</span>

      {/* Header — back button + action buttons row */}
      <div className="flex items-center gap-2 justify-between">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-20 sm:w-32 rounded-full" />
        </div>
      </div>

      {/* PlantDetails hero card */}
      <div className="space-y-4 sm:space-y-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-muted/50 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-[#0b1220] dark:via-[#0a0f1a] dark:to-[#05080f] shadow-lg">
          <div className="relative flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 md:p-6 lg:flex-row lg:gap-8 lg:p-8">
            {/* Left: text content */}
            <div className="flex-1 space-y-3 sm:space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-5 sm:h-6 w-16 sm:w-20 rounded-full" />
                <Skeleton className="h-5 sm:h-6 w-20 sm:w-24 rounded-full" />
                <Skeleton className="h-5 sm:h-6 w-24 sm:w-28 rounded-full" />
              </div>
              {/* Title */}
              <div>
                <Skeleton className="h-8 sm:h-10 md:h-12 w-3/4 rounded-xl" />
                <Skeleton className="h-4 sm:h-5 w-2/5 mt-1.5 rounded-md" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-5 w-16 sm:w-20 rounded-full" />
                  ))}
                </div>
              </div>
              {/* Overview text */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
            </div>
            {/* Right: image */}
            <div className="flex w-full justify-center lg:w-auto">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted/60 bg-white/60 sm:w-80 lg:w-96">
                <Skeleton className="h-full w-full rounded-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-stone-400/40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stat chips — flex wrap row of rounded pill skeletons */}
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 lg:gap-3.5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-12 lg:h-14 w-36 lg:w-44 rounded-2xl" />
          ))}
        </div>
      </div>

      {/* MoreInformationSection */}
      <section className="space-y-4 sm:space-y-6">
        {/* Section header */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-7 sm:h-8 w-48 rounded-xl" />
          <Skeleton className="h-3 sm:h-4 w-64 rounded-md" />
        </div>

        {/* Seasonal Timeline — full width first */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 sm:h-5 sm:w-5 rounded" />
              <Skeleton className="h-3 sm:h-4 w-32 rounded-md" />
            </div>
            {/* Gantt rows: month labels + 3 activity rows */}
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-x-1 sm:gap-x-1.5 items-center">
                <div className="w-16 sm:w-20" />
                {Array.from({ length: 12 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-3 w-full rounded" />
                ))}
              </div>
              {Array.from({ length: 3 }).map((_, rowIdx) => (
                <div key={rowIdx} className="grid grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-x-1 sm:gap-x-1.5 items-center">
                  <Skeleton className="h-5 w-16 sm:w-20 rounded-md" />
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-5 sm:h-6 w-full rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dimensions + Color Palette row */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {/* Dimensions card */}
          <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/70 via-white/60 to-white/10 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-transparent dark:to-transparent p-3 sm:p-5 space-y-3">
            <div>
              <Skeleton className="h-3 w-24 rounded-full mb-1" />
              <Skeleton className="h-5 sm:h-6 w-32 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Skeleton className="h-40 sm:h-52 rounded-xl sm:rounded-2xl" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="rounded-xl sm:rounded-2xl border border-emerald-100/70 dark:border-emerald-500/30 p-2 sm:p-3 space-y-1.5">
                    <Skeleton className="h-3 w-1/3 rounded-full" />
                    <Skeleton className="h-4 sm:h-5 w-1/2 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Color palette + Living space */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="space-y-1">
                    <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl" />
                    <Skeleton className="h-2.5 w-10 sm:w-12 rounded-full mx-auto" />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-2xl sm:rounded-3xl" />
          </div>
        </div>

        {/* Habitat Map section */}
        <div className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-sky-100/80 via-white/80 to-emerald-100/80 dark:from-[#03191b]/90 dark:via-[#04263d]/85 dark:to-[#071321]/90 p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 sm:h-5 sm:w-5 rounded" />
            <Skeleton className="h-3 sm:h-4 w-28 rounded-md" />
          </div>
          <Skeleton className="h-48 sm:h-64 w-full rounded-2xl sm:rounded-3xl" />
        </div>

        {/* Recipes section */}
        <div className="rounded-2xl sm:rounded-3xl border-2 border-emerald-400/50 bg-gradient-to-br from-emerald-50/90 via-orange-50/60 to-amber-50/80 dark:border-emerald-500/60 dark:from-emerald-500/15 dark:via-orange-500/10 dark:to-amber-500/10 p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-lg">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 sm:h-6 w-24 rounded-md" />
              <Skeleton className="h-3 sm:h-4 w-36 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-28 sm:w-32 rounded-xl sm:rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Info cards — masonry-like 2-col layout */}
        <div className="space-y-3 sm:space-y-4">
          <div className="columns-1 sm:columns-2 gap-3 sm:gap-4">
            {[4, 3, 4, 3, 3, 2].map((lines, idx) => (
              <div key={idx} className="break-inside-avoid mb-3 sm:mb-4">
                <Card className="rounded-2xl sm:rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f]">
                  <div className="p-4 sm:p-6 pb-2 sm:pb-3">
                    <Skeleton className="h-4 w-1/3 rounded-full" />
                  </div>
                  <div className="space-y-2.5 sm:space-y-3 p-4 sm:p-6 pt-0">
                    {Array.from({ length: lines }).map((_, lineIdx) => (
                      <div key={lineIdx} className="flex items-start gap-3">
                        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-1/3 rounded-full" />
                          <Skeleton className="h-4 w-5/6 rounded-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* Gallery section */}
          <div className="rounded-2xl sm:rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 sm:h-5 sm:w-5 rounded" />
              <Skeleton className="h-3 sm:h-4 w-24 rounded-md" />
            </div>
            <div className="flex gap-3 overflow-hidden max-h-[400px]">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="relative flex-1">
                  <Skeleton className="h-48 w-full rounded-2xl" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-stone-400/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Companion plants section */}
          <div className="rounded-2xl sm:rounded-3xl border border-emerald-200/70 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/80 via-white/60 to-emerald-100/40 dark:from-emerald-950/30 dark:via-[#1f1f1f] dark:to-emerald-900/20 p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 sm:h-5 sm:w-5 rounded" />
              <Skeleton className="h-3 sm:h-4 w-40 rounded-md" />
            </div>
            <Skeleton className="h-3 sm:h-4 w-64 rounded-md" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 w-24 sm:h-32 sm:w-28 flex-shrink-0 rounded-2xl" />
              ))}
            </div>
          </div>

          {/* Attribution footer */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-3">
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="h-3 w-40 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        </div>
      </section>
    </div>
  )
}
