"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { DeepCopyResults } from "@/components/results/deepcopy-results"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Download, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { ContentViewerSkeleton } from "@/components/ui/skeleton-loaders"
import { useJobPolling } from "@/hooks/use-job-polling"


export default function ResultDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { currentJob, fetchJob } = useJobsStore()
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
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16 p-6">
          <ContentViewerSkeleton />
        </main>
      </div>
    )
  }

  if (!user || isLoading) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16 p-6">
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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-16">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">AI</span>
                </div>
                <span className="text-xl font-bold text-foreground">DeepCopy</span>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/dashboard">
                  <Button variant="ghost" asChild>
                    <span>← Back to Dashboard</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Step 3: Content Generation Complete</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold mb-6 text-foreground">
                Content Results
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto">
                Review your generated content, templates, and analysis results
              </p>
            </div>

            {/* Status and Job Info */}
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
              </div>
            </div>

            <DeepCopyResults
              result={currentJob.result}
              jobTitle={currentJob.title}
              jobId={currentJob.id}
              advertorialType={currentJob.advertorial_type}
              templateId={currentJob.template_id}
              customerAvatars={currentJob.customer_avatars}
              salesPageUrl={currentJob.sales_page_url}
            />
          </div>
        </main>
      </div>
    </div>
  )
}