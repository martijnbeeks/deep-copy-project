"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { DeepCopyResults } from "@/components/results/deepcopy-results"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { ArrowLeft, RefreshCw, ExternalLink, Menu, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { ContentViewerSkeleton } from "@/components/ui/skeleton-loaders"
import { useJobPolling } from "@/hooks/use-job-polling"


export default function ResultDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { currentJob, fetchJob } = useJobsStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadJob = useCallback(async () => {
    try {
      setIsRefreshing(true)
      await fetchJob(params.id)
      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchJob, params.id])

  // Use client-side polling for job status updates
  const {
    jobStatus,
    isPolling,
    attempts,
    maxAttempts
  } = useJobPolling({
    jobId: params.id,
    enabled: currentJob?.status === 'processing' || currentJob?.status === 'pending',
    interval: 5000, // Poll every 5 seconds
    maxAttempts: 120, // Max 10 minutes
    onStatusChange: (status, progress) => {
      loadJob()
    },
    onComplete: (result) => {
      loadJob()
    },
    onError: (error) => {
      // Silently handle polling errors
    }
  })

  useEffect(() => {
    // Only load job if authenticated, don't redirect
    if (isAuthenticated && user) {
      loadJob()
    }
  }, [isAuthenticated, user, loadJob])

  // Show loading state instead of redirecting
  if (!isAuthenticated || !user) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6">
          <ContentViewerSkeleton />
        </main>
      </div>
    )
  }


  if (!user || isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6">
          <ContentViewerSkeleton />
        </main>
      </div>
    )
  }

  if (!currentJob || !currentJob.result) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Result Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested result could not be found or is not yet available.</p>
            <Link href="/dashboard">
              <Button>Return to Dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto md:ml-0">
        <div className="p-4 md:p-6 pb-20">
          <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold">Content Results</h1>
                  {(isRefreshing || isPolling) && (
                    <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                  )}
                </div>
                <p className="text-sm md:text-base text-muted-foreground">View and analyze your generated content</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0 md:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0 hidden md:flex"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end mb-6">
            <div className="flex items-center gap-3">
              {isPolling && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing ({attempts}/{maxAttempts})</span>
                  {jobStatus.progress && (
                    <span className="text-blue-600 font-medium">
                      {jobStatus.progress}%
                    </span>
                  )}
                </div>
              )}
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {currentJob.status}
              </Badge>
              <Link href={`/jobs/${currentJob.id}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Job Details
                </Button>
              </Link>
            </div>
          </div>

          <DeepCopyResults
            result={currentJob.result}
            jobTitle={currentJob.title}
            advertorialType={currentJob.advertorial_type}
            templateId={currentJob.template_id}
          />
        </div>
      </main>
    </div>
  )
}