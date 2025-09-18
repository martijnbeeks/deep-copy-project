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
          <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
            <div className="flex-1 min-w-0">
              <div className="h-8 w-48 bg-muted animate-pulse-slow rounded-md" />
              <div className="h-4 w-64 bg-muted animate-pulse-slow rounded-md mt-1" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-40 bg-muted animate-pulse-slow rounded-md" />
              <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
            </div>
          </div>

          {/* Stats overview skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-20 bg-muted animate-pulse-slow rounded-md" />
                  <div className="h-4 w-4 bg-muted animate-pulse-slow rounded-md" />
                </div>
                <div className="h-8 w-12 bg-muted animate-pulse-slow rounded-md mb-1" />
                <div className="h-3 w-24 bg-muted animate-pulse-slow rounded-md" />
              </div>
            ))}
          </div>

          {/* Filter card skeleton */}
          <div className="mb-4 md:mb-6">
            <div className="border rounded-lg p-6">
              <div className="h-6 w-32 bg-muted animate-pulse-slow rounded-md mb-2" />
              <div className="h-4 w-64 bg-muted animate-pulse-slow rounded-md mb-4" />
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="h-10 w-full bg-muted animate-pulse-slow rounded-md" />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                  <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                  <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                </div>
              </div>
            </div>
          </div>

          {/* Results list skeleton */}
          <div className="grid gap-3 md:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <div className="h-5 w-3/4 bg-muted animate-pulse-slow rounded-md" />
                      <div className="h-6 w-16 bg-muted animate-pulse-slow rounded-full" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <div className="h-4 w-24 bg-muted animate-pulse-slow rounded-md" />
                      <div className="h-4 w-20 bg-muted animate-pulse-slow rounded-md" />
                      <div className="h-4 w-16 bg-muted animate-pulse-slow rounded-md" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-20 bg-muted animate-pulse-slow rounded-md" />
                    <div className="h-8 w-16 bg-muted animate-pulse-slow rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
