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
