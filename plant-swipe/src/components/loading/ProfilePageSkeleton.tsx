import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const ProfilePageSkeleton = () => (
  <div className="max-w-4xl mx-auto mt-8 px-4 md:px-0">
    <Card className="rounded-3xl overflow-hidden mb-6">
      <div className="h-32 bg-gradient-to-r from-stone-200 to-stone-300" />
      <CardContent className="p-6 -mt-16">
        <div className="flex flex-col md:flex-row gap-6">
          <Skeleton className="h-32 w-32 rounded-full border-4 border-white flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-2xl p-4">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-8 w-12" />
        </Card>
      ))}
    </div>

    <Card className="rounded-2xl p-6 mb-6">
      <Skeleton className="h-6 w-24 mb-4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </Card>

    <Card className="rounded-2xl p-6">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
      </div>
    </Card>
  </div>
)
