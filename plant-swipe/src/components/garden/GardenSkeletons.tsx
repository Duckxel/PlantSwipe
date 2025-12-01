import React from 'react'
import { Card } from '@/components/ui/card'

// Skeleton component with pulse animation
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-stone-200 dark:bg-stone-700 rounded ${className}`} />
)

// Skeleton for Garden List Card
export const GardenCardSkeleton: React.FC = () => {
  return (
    <Card className="rounded-2xl overflow-hidden relative border-2">
      {/* Progress badge skeleton */}
      <div className="pointer-events-none absolute top-3 right-3 rounded-xl w-16 h-7 z-20">
        <Skeleton className="w-full h-full" />
      </div>
      
      {/* Image area skeleton */}
      <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 dark:from-[#2d2d30] dark:to-[#252526]">
        <Skeleton className="w-full h-full" />
      </div>
      
      {/* Content area skeleton */}
      <div className="p-4 bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title skeleton */}
            <Skeleton className="h-6 w-3/4 mb-2" />
            {/* Metadata skeleton */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
          {/* Arrow icon skeleton */}
          <div className="flex-shrink-0">
            <Skeleton className="w-6 h-6 rounded" />
          </div>
        </div>
      </div>
    </Card>
  )
}

// Skeleton for multiple garden cards
export const GardenListSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <GardenCardSkeleton key={idx} />
      ))}
    </div>
  )
}

// Skeleton for Overview Section Stat Cards
export const OverviewStatCardSkeleton: React.FC = () => {
  return (
    <Card className="rounded-2xl p-4">
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-24" />
    </Card>
  )
}

// Skeleton for Overview Section
export const OverviewSectionSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Hero Section skeleton */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-stone-100 via-stone-50 to-stone-100 dark:from-[#1a1a1a] dark:via-[#1f1f1f] dark:to-[#1a1a1a] min-h-[200px] p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
      </div>

      {/* Members Section skeleton */}
      <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl px-3 py-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Plants Gallery skeleton */}
      <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </Card>

      {/* 30-Day Calendar skeleton */}
      <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="grid grid-cols-7 md:grid-cols-10 gap-2">
          {Array.from({ length: 30 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-square rounded-xl" />
          ))}
        </div>
      </Card>

      {/* Activity Feed skeleton */}
      <Card className="rounded-[28px] border border-stone-200/70 dark:border-[#3e3e42]/70 bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur p-5">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-3 w-16" />
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
    <div className="rounded-xl border p-4 text-center min-w-[120px]">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-12 mx-auto" />
    </div>
  )
}

// Skeleton for Profile Page
export const ProfilePageSkeleton: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0 space-y-4">
      {/* Main profile card skeleton */}
      <Card className="rounded-3xl">
        <div className="p-6 md:p-8 space-y-4">
          <div className="flex items-start gap-4">
            {/* Avatar skeleton */}
            <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
            
            <div className="flex-1 min-w-0">
              {/* Name and badge skeleton */}
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              
              {/* Location skeleton */}
              <div className="flex items-center gap-1 mb-1">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              
              {/* Status and joined date skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            
            {/* Action button skeleton */}
            <div className="ml-auto">
              <Skeleton className="h-10 w-32 rounded-2xl" />
            </div>
          </div>
          
          {/* Bio skeleton */}
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>

      {/* Highlights card skeleton */}
      <Card className="rounded-3xl">
        <div className="p-6 md:p-8 space-y-4">
          {/* Title skeleton */}
          <Skeleton className="h-6 w-32" />
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-0">
            {/* Heatmap skeleton - left side */}
            <div className="flex-1 flex justify-center items-center">
              <div className="grid grid-rows-4 grid-flow-col auto-cols-max gap-1.5 sm:gap-2">
                {Array.from({ length: 28 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-8 w-8 sm:h-10 sm:w-10 rounded-[4px]" />
                ))}
              </div>
            </div>
            
            {/* Divider skeleton */}
            <div className="hidden md:block w-px h-full min-h-[200px] bg-stone-300 dark:bg-[#3e3e42] mx-2" />
            
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
        </div>
      </Card>
    </div>
  )
}
