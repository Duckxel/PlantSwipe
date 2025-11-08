import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const SwipePageSkeleton = () => (
  <div className="max-w-3xl mx-auto mt-8 px-4 md:px-0 mb-4">
    <div className="relative" style={{ height: 'min(650px, calc(100vh - 16rem))' }}>
      <Card className="h-full rounded-3xl overflow-hidden shadow-xl">
        <div className="h-2/3 relative">
          <Skeleton className="absolute inset-0 rounded-t-3xl" />
          <div className="absolute bottom-0 p-5 w-full space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-xl" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
        <CardContent className="h-1/3 p-4 flex flex-col gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-xl" />
            <Skeleton className="h-6 w-20 rounded-xl" />
            <Skeleton className="h-6 w-14 rounded-xl" />
            <Skeleton className="h-6 w-18 rounded-xl" />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <Skeleton className="h-10 flex-1 rounded-2xl" />
            <Skeleton className="h-10 flex-1 rounded-2xl" />
            <Skeleton className="h-10 flex-1 rounded-2xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
)
