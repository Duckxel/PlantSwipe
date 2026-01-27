import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const SwipeCardSkeleton = () => {
  const desktopCardHeight = "min(720px, calc(100vh - 12rem))"

  return (
    <>
      {/* Mobile Skeleton */}
      <div className="md:hidden relative w-full px-2" style={{ height: 'calc(100dvh - 120px)', minHeight: '450px', marginBottom: '8px' }}>
          <Card className="h-full w-full rounded-[24px] bg-stone-100 dark:bg-stone-900 overflow-hidden relative border border-stone-200 dark:border-[#3e3e42]">
              <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 z-20">
                 {/* Badges */}
                 <div className="flex gap-2 mb-3">
                   <Skeleton className="h-6 w-20 rounded-full bg-white/30" />
                   <Skeleton className="h-6 w-16 rounded-full bg-white/30" />
                 </div>
                 {/* Title */}
                 <Skeleton className="h-10 w-3/4 mb-2 rounded-xl bg-white/30" />
                 {/* Subtitle */}
                 <Skeleton className="h-5 w-1/2 mb-5 rounded-md bg-white/30" />
                 {/* Buttons */}
                 <div className="grid grid-cols-3 gap-2">
                   <Skeleton className="h-11 rounded-2xl bg-white/20" />
                   <Skeleton className="h-11 rounded-2xl bg-white/20" />
                   <Skeleton className="h-11 rounded-2xl bg-white/20" />
                 </div>
              </div>
          </Card>
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden md:block max-w-5xl mx-auto mt-6 px-4 md:px-0 pb-16">
          <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-[#3e3e42] bg-gradient-to-br from-white via-emerald-50/60 to-stone-100 dark:from-[#1e1e1e] dark:via-[#252526] dark:to-[#171717] p-6 md:p-12 space-y-6 shadow-[0_30px_80px_-40px_rgba(16,185,129,0.45)]">
              <div className="relative mx-auto w-full max-w-3xl" style={{ height: desktopCardHeight }}>
                  <Card className="h-full w-full rounded-[24px] bg-stone-100 dark:bg-stone-900 overflow-hidden relative border border-white/20 dark:border-white/10">
                      <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
                      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 z-20">
                         {/* Badges */}
                         <div className="flex gap-2 mb-3">
                           <Skeleton className="h-6 w-20 rounded-full bg-white/30" />
                           <Skeleton className="h-6 w-16 rounded-full bg-white/30" />
                         </div>
                         {/* Title */}
                         <Skeleton className="h-10 w-3/4 mb-2 rounded-xl bg-white/30" />
                         {/* Subtitle */}
                         <Skeleton className="h-5 w-1/2 mb-5 rounded-md bg-white/30" />
                         {/* Buttons */}
                         <div className="grid grid-cols-3 gap-2">
                           <Skeleton className="h-11 rounded-2xl bg-white/20" />
                           <Skeleton className="h-11 rounded-2xl bg-white/20" />
                           <Skeleton className="h-11 rounded-2xl bg-white/20" />
                         </div>
                      </div>
                  </Card>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Skeleton className="h-10 w-40 rounded-2xl" />
                <Skeleton className="h-10 w-40 rounded-2xl" />
              </div>
          </section>
      </div>
    </>
  )
}
