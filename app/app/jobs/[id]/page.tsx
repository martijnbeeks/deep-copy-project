"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { JobDetails } from "@/components/jobs/job-details"
import { JobProgress } from "@/components/jobs/job-progress"
import { JobLogs } from "@/components/jobs/job-logs"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, RefreshCw, Download, Eye } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { JobWithResult } from "@/lib/db/types"

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { currentJob, fetchJob, pollJobStatus } = useJobsStore()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }

    const loadJob = async () => {
      try {
        await fetchJob(params.id)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch job:', error)
        setIsLoading(false)
      }
    }

    loadJob()
  }, [isAuthenticated, user, router, params.id, fetchJob])

  useEffect(() => {
    if (currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing')) {
      setIsPolling(true)
      pollJobStatus(currentJob.id)
    } else {
      setIsPolling(false)
    }
  }, [currentJob, pollJobStatus])

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Job Details</h1>
                <p className="text-muted-foreground">Monitor your AI content generation progress</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPolling && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Auto-refreshing
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <JobDetails job={currentJob} />
              <JobLogs logs={[]} />
            </div>
            <div>
              <JobProgress
                steps={[]}
                overallProgress={currentJob.progress}
                currentStep={undefined}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
