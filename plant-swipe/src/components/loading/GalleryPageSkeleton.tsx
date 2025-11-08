import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const GalleryPageSkeleton = () => (
  <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0">
    <Skeleton className="h-4 w-24 mb-3" />
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="rounded-2xl overflow-hidden">
          <Skeleton className="h-36 rounded-t-2xl" />
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-xl" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)
