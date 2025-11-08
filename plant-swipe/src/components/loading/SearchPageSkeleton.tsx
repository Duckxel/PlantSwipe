import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ListFilter } from "lucide-react"

export const SearchPageSkeleton = () => (
  <div className="max-w-6xl mx-auto mt-8 px-4 md:px-0">
    <div className="flex items-center gap-2 text-sm mb-3">
      <ListFilter className="h-4 w-4" />
      <span className="opacity-60">Refine with filters above. Click a card for full details.</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="relative rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 items-stretch gap-0">
            <Skeleton className="col-span-1 h-full min-h-[148px] rounded-l-2xl" />
            <div className="col-span-2 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-xl" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex flex-wrap gap-1">
                <Skeleton className="h-5 w-12 rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-xl" />
                <Skeleton className="h-5 w-14 rounded-xl" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
)
