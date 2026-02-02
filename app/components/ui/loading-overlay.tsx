"use client"

import { useLoading } from "@/contexts/loading-context"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  DashboardStatsSkeleton, 
  JobCardSkeleton, 
  ResultCardSkeleton, 
  JobDetailsSkeleton,
  ContentViewerSkeleton,
  PageSkeleton
} from "./skeleton-loaders"

export function LoadingOverlay() {
  const { isLoading, loadingMessage, loadingPage } = useLoading()

  if (!isLoading) return null

  // Show appropriate skeleton based on the page being loaded
  const renderPageSkeleton = () => {
    switch (loadingPage) {
      case '/dashboard':
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
            
            <main className="flex-1 p-6">
              <div className="space-y-6">
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
            </main>
          </div>
        )
      
      case '/jobs':
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
                    <div className="h-10 w-32 bg-muted animate-pulse-slow rounded-md" />
                    <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
                  </div>
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
                      <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                    </div>
                  </div>
                </div>

                {/* Jobs list skeleton */}
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
                          <div className="h-8 w-24 bg-muted animate-pulse-slow rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        )
      
      case '/results':
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
      
      case '/create':
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
      
      default:
        return <PageSkeleton />
    }
  }

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-200">
      <div className="w-full h-full overflow-auto animate-in fade-in-0 duration-200">
        {renderPageSkeleton()}
      </div>
    </div>
  )
}
