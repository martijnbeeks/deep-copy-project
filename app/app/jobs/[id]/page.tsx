"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { JobDetails } from "@/components/jobs/job-details"
import { JobProgress } from "@/components/jobs/job-progress"
import { JobLogs } from "@/components/jobs/job-logs"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { ArrowLeft, RefreshCw, Download, Eye, Menu, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useJob } from "@/lib/hooks/use-jobs"
import { JobWithResult } from "@/lib/db/types"
import { JobDetailsSkeleton } from "@/components/ui/skeleton-loaders"
import { useJobPolling } from "@/hooks/use-job-polling"

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()

  // Use TanStack Query for data fetching
  const { data: currentJob, isLoading, error, refetch } = useJob(params.id)

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
      console.log(`Job ${params.id} status changed:`, { status, progress })
      // Refetch job data when status changes
      refetch()
    },
    onComplete: (result) => {
      console.log(`Job ${params.id} completed!`, result)
      // Refetch to get updated job data
      refetch()
    },
    onError: (error) => {
      console.error(`Job ${params.id} polling error:`, error)
    }
  })

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
  }, [isAuthenticated, user, router])

  if (!user || isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6">
          <JobDetailsSkeleton />
        </main>
      </div>
    )
  }

  if (!currentJob) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested job could not be found.</p>
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
        <div className="p-4 md:p-6">
          <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
            <div className="flex items-center gap-4">
              <Link href="/jobs">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back to Jobs</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Job Details</h1>
                <p className="text-sm md:text-base text-muted-foreground">Monitor your AI content generation progress</p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* Mobile menu button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0 md:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
              
              {/* Desktop collapse button */}
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
          
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-2">
              {isPolling && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Polling DeepCopy API ({attempts}/{maxAttempts})</span>
                  {jobStatus.progress && (
                    <span className="text-blue-600 font-medium">
                      {jobStatus.progress}%
                    </span>
                  )}
                </div>
              )}
              {currentJob.status === "completed" && (
                <>
                  <Link href={`/results/${currentJob.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-6">
              <JobDetails job={currentJob} />
              <JobLogs logs={[]} />
            </div>
            <div>
              <JobProgress
                steps={[]}
                overallProgress={0}
                currentStep={undefined}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
