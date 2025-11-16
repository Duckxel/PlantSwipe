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
    <div className="space-y-4">
      {/* Stat cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OverviewStatCardSkeleton />
        <OverviewStatCardSkeleton />
        <OverviewStatCardSkeleton />
      </div>

      {/* Today's Progress card skeleton */}
      <Card className="rounded-2xl p-4">
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-3 w-full rounded-full" />
      </Card>

      {/* Last 30 Days calendar skeleton */}
      <Card className="rounded-2xl p-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid grid-cols-7 gap-x-3 gap-y-3 place-items-center">
          {Array.from({ length: 30 }).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <Skeleton className="w-7 h-7 rounded-md" />
              {idx === 29 && <Skeleton className="mt-1 h-0.5 w-5 rounded-full" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Activity Today card skeleton */}
      <Card className="rounded-2xl p-4">
        <Skeleton className="h-5 w-32 mb-2" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-2" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
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
