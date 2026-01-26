import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

// Glass card style matching the app's design system
const glassCardClass = "rounded-[24px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#17171a]/90 backdrop-blur-sm shadow-lg"

// Skeleton for Garden List Card
export const GardenCardSkeleton: React.FC = () => {
  return (
    <>
      <Card className="rounded-[24px] overflow-hidden relative border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] shadow-md">
        {/* Progress badge skeleton */}
        <div className="pointer-events-none absolute top-3 right-3 z-20">
          <Skeleton className="w-16 h-7 rounded-xl" />
        </div>
        
        {/* Image area skeleton */}
        <div className="relative aspect-[5/3] overflow-hidden">
          <Skeleton className="w-full h-full rounded-none" />
          {/* Subtle loader in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400/50 dark:text-stone-500/50" />
          </div>
        </div>
        
        {/* Content area skeleton */}
        <div className="p-4 bg-white dark:bg-[#1f1f1f]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-3">
              {/* Title skeleton */}
              <Skeleton className="h-6 w-3/4 rounded-lg" />
              {/* Metadata skeleton */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded-md" />
                  <Skeleton className="h-4 w-20 rounded-md" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              </div>
            </div>
            {/* Arrow icon skeleton */}
            <div className="flex-shrink-0">
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}

// Skeleton for multiple garden cards
export const GardenListSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-2xl" />
      </div>
      
      {/* Grid of garden cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <GardenCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  )
}

// Skeleton for Overview Section Stat Cards
export const OverviewStatCardSkeleton: React.FC = () => {
  return (
    <>
      <Card className="rounded-[20px] p-4 border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur-sm">
        <Skeleton className="h-3 w-20 mb-2 rounded-md" />
        <Skeleton className="h-8 w-16 mb-1 rounded-lg" />
        <Skeleton className="h-3 w-24 rounded-md" />
      </Card>
    </>
  )
}

// Skeleton for Overview Section
export const OverviewSectionSkeleton: React.FC = () => {
  return (
    <>
      <div className="space-y-6">
        {/* Hero Section skeleton */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-50/80 via-white to-stone-100/80 dark:from-[#252526] dark:via-[#1e1e1e] dark:to-[#171717] border border-stone-200/70 dark:border-[#3e3e42]/70 shadow-lg min-h-[200px] p-8 md:p-10">
          {/* Decorative blur elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-6 -right-8 h-32 w-32 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-emerald-100/40 dark:bg-emerald-500/5 blur-3xl" />
          </div>
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-64 rounded-xl" />
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-9 w-32 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          </div>
        </div>

        {/* Members Section skeleton */}
        <Card className={`${glassCardClass} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-6 w-40 rounded-lg" />
          </div>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-stone-50/80 dark:bg-stone-800/50 rounded-2xl px-4 py-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Plants Gallery skeleton */}
        <Card className={`${glassCardClass} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-lg" />
              <Skeleton className="h-6 w-36 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="relative aspect-square">
                <Skeleton className="w-full h-full rounded-2xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-stone-400/30" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 30-Day Calendar skeleton */}
        <Card className={`${glassCardClass} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-lg" />
              <Skeleton className="h-6 w-32 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-7 md:grid-cols-10 gap-2">
            {Array.from({ length: 30 }).map((_, idx) => (
              <Skeleton key={idx} className="aspect-square rounded-xl" />
            ))}
          </div>
        </Card>

        {/* Activity Feed skeleton */}
        <Card className={`${glassCardClass} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-6 w-32 rounded-lg" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-stone-50/80 dark:bg-stone-800/50">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-4 w-40 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
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

// Plant Info Page Skeleton
export const PlantInfoPageSkeleton: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-12 sm:pb-14 space-y-5 sm:space-y-6"
      >
        <span className="sr-only">{label}</span>

        {/* Header buttons */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Skeleton className="h-10 w-32 rounded-2xl" />
          <Skeleton className="h-10 w-24 rounded-2xl" />
        </div>

        {/* Main info card */}
        <div className="rounded-3xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/90 dark:bg-[#0c111b]/90 shadow-lg p-4 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            <div className="flex-1 space-y-4">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-9 w-3/4 rounded-xl" />
              <Skeleton className="h-5 w-2/5 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-6 w-24 rounded-full" />
                ))}
              </div>
            </div>
            <div className="w-full lg:w-96 relative">
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-stone-400/40" />
              </div>
            </div>
          </div>
          
          {/* Stat pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28 rounded-[20px]" />
            ))}
          </div>
        </div>

        {/* More info sections */}
        <section className="space-y-4 sm:space-y-6">
          {/* Dimensions, Palette, Timeline row */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,2fr)]">
            {/* Dimensions card */}
            <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-500/30 bg-white/80 dark:bg-[#0f1f1f]/80 p-4 sm:p-5 space-y-3">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
              <div className="grid md:grid-cols-2 gap-3">
                <Skeleton className="min-h-[240px] rounded-2xl" />
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="space-y-2 rounded-2xl border border-emerald-100/70 dark:border-emerald-500/30 p-3">
                      <Skeleton className="h-3 w-1/3 rounded-full" />
                      <Skeleton className="h-5 w-1/2 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Palette card */}
            <div className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 max-w-[280px]">
              <Skeleton className="h-4 w-24 mb-3 rounded-md" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <Skeleton className="h-14 rounded-xl" />
                    <Skeleton className="h-3 w-3/4 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline card */}
            <div className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6 space-y-4">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-6 w-full rounded-full" />
                ))}
              </div>
              <div className="flex gap-3 flex-wrap">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-3 w-20 rounded-full" />
                ))}
              </div>
            </div>
          </div>

          {/* Map section */}
          <div className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-gradient-to-br from-sky-100/70 via-white/70 to-emerald-100/70 dark:from-[#03191b] dark:via-[#05263a] dark:to-[#081121] p-4 sm:p-6 space-y-4">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-52 w-full rounded-2xl" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-6 w-24 rounded-full" />
              ))}
            </div>
          </div>

          {/* Recipes section */}
          <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 via-orange-50/50 to-amber-50/70 dark:from-emerald-500/20 dark:via-orange-500/10 dark:to-amber-500/10 p-4 sm:p-6 space-y-4">
            <Skeleton className="h-5 w-48 rounded-md" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-32 rounded-2xl" />
              ))}
            </div>
          </div>

          {/* Info cards grid */}
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {[4, 4, 3, 4, 3, 2].map((lines, idx) => (
              <Card key={idx} className="rounded-2xl sm:rounded-3xl h-full border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f]">
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
            ))}
          </div>

          {/* Gallery section */}
          <div className="rounded-2xl border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white dark:bg-[#1f1f1f] p-4 sm:p-6 space-y-3">
            <Skeleton className="h-4 w-32 rounded-md" />
            <div className="flex gap-3 overflow-hidden">
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

          {/* Attribution section */}
          <div className="rounded-2xl border border-stone-200/70 bg-white/90 dark:border-[#3e3e42]/70 dark:bg-[#1f1f1f] p-4 sm:p-5 space-y-3">
            <Skeleton className="h-4 w-44 rounded-md" />
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
        </section>
      </div>
    </>
  )
}
