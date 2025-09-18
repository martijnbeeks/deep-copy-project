export default function Loading() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
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
      
      <main className="flex-1 overflow-auto md:ml-0">
        <div className="p-4 md:p-6">
          {/* Header skeleton */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="h-8 w-64 bg-muted animate-pulse-slow rounded-md" />
                <div className="h-4 w-80 bg-muted animate-pulse-slow rounded-md mt-1" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
              </div>
            </div>
            
            {/* Progress steps skeleton */}
            <div className="flex items-center gap-2 md:gap-4 mt-3 md:mt-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted animate-pulse-slow rounded-full" />
                <div className="h-4 w-24 bg-muted animate-pulse-slow rounded-md" />
              </div>
              <div className="h-3 w-3 bg-muted animate-pulse-slow rounded-md" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted animate-pulse-slow rounded-full" />
                <div className="h-4 w-28 bg-muted animate-pulse-slow rounded-md" />
              </div>
            </div>
          </div>

          {/* Template selection skeleton */}
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <div className="h-6 w-48 bg-muted animate-pulse-slow rounded-md mb-2" />
              <div className="h-4 w-96 bg-muted animate-pulse-slow rounded-md mb-6" />
              
              {/* Template grid skeleton */}
              <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="h-6 w-3/4 bg-muted animate-pulse-slow rounded-md mb-2" />
                    <div className="h-4 w-full bg-muted animate-pulse-slow rounded-md mb-2" />
                    <div className="h-4 w-2/3 bg-muted animate-pulse-slow rounded-md mb-4" />
                    <div className="h-32 w-full bg-muted animate-pulse-slow rounded-md" />
                  </div>
                ))}
              </div>
              
              {/* Next button skeleton */}
              <div className="flex justify-end mt-6">
                <div className="h-10 w-32 bg-muted animate-pulse-slow rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
