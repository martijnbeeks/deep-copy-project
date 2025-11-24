"use client"

import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { DeepCopyResults } from "@/components/results/deepcopy-results"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Download, ArrowLeft } from "lucide-react"
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
    if (!isAuthenticated || !user) {
      router.replace("/login")
      return
    }
    loadJob()
  }, [isAuthenticated, user, router, loadJob])

  // Early return if not authenticated to prevent skeleton loader
  if (!isAuthenticated || !user) {
    return null
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

  // Get project info from currentJob
  const projectTitle = currentJob?.title || 'Project'
  const capitalizedTitle = projectTitle.charAt(0).toUpperCase() + projectTitle.slice(1)
  const projectDate = currentJob?.created_at || new Date().toISOString()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-16">
        <div className="p-4 md:p-6">
          <div className="mb-6 pb-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Button>
                  {currentJob && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                      <span className="text-sm font-medium">
                        {capitalizedTitle} • {new Date(projectDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
                    <h1 className="text-sm font-medium text-foreground">
                      Research Results
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto">
            <DeepCopyResults
              result={currentJob.result}
              jobTitle={currentJob.title}
              jobId={currentJob.id}
              advertorialType={currentJob.advertorial_type}
              templateId={currentJob.template_id}
              customerAvatars={currentJob.avatars?.filter((a: any) => a.is_researched === true) || []}
              salesPageUrl={currentJob.sales_page_url}
            />
          </div>
        </div>
      </main>
    </div>
  )
}