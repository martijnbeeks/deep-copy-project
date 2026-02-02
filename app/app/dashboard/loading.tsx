import { DashboardStatsSkeleton } from "@/components/ui/skeleton-loaders"

export default function Loading() {
  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-muted animate-pulse-slow rounded-md" />
        <div className="h-10 w-32 bg-muted animate-pulse-slow rounded-md" />
      </div>
      <DashboardStatsSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="h-6 w-32 bg-muted animate-pulse-slow rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-muted animate-pulse-slow rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-3/4 bg-muted animate-pulse-slow rounded-md" />
                  <div className="h-3 w-1/2 bg-muted animate-pulse-slow rounded-md" />
                </div>
                <div className="h-6 w-16 bg-muted animate-pulse-slow rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 w-32 bg-muted animate-pulse-slow rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse-slow rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
