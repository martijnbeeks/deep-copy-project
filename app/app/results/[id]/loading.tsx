import { ContentViewerSkeleton } from "@/components/ui/skeleton-loaders"

export default function Loading() {
  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 border-r bg-card">
        <div className="p-6 space-y-4">
          <div className="h-8 w-32 bg-muted animate-pulse-slow rounded" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-muted animate-pulse-slow rounded" />
            ))}
          </div>
        </div>
      </div>
      <main className="flex-1 p-6">
        <ContentViewerSkeleton />
      </main>
    </div>
  )
}
