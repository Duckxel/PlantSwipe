import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const GardenListSkeleton = () => (
  <div className="max-w-5xl mx-auto mt-8 px-4 md:px-0">
    <div className="mb-6">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="rounded-2xl overflow-hidden">
          <Skeleton className="h-48 rounded-t-2xl" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex items-center gap-2 pt-2">
              <Skeleton className="h-9 flex-1 rounded-2xl" />
              <Skeleton className="h-9 w-9 rounded-2xl" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
)
