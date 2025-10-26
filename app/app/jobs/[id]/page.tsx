"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, RefreshCw, Download, Eye, Menu, ChevronLeft, ChevronRight, Trash2, Globe, Sparkles, Users, Hash } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useJob } from "@/lib/hooks/use-jobs"
import { JobWithResult } from "@/lib/db/types"
import { JobDetailsSkeleton } from "@/components/ui/skeleton-loaders"
import { useJobPolling } from "@/hooks/use-job-polling"
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { useToast } from "@/hooks/use-toast"

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { toast } = useToast()

  // Use TanStack Query for data fetching
  const { data: currentJob, isLoading, error, refetch } = useJob(params.id)

  // Use auto-polling for processing jobs (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()

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
      refetch()
    },
    onComplete: (result) => {
      refetch()
    },
    onError: (error) => {
      // Silently handle polling errors
    }
  })

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
  }, [isAuthenticated, user, router])


  const getProgressPercentage = () => {
    if (!currentJob) return 0
    if (currentJob.status === 'completed') return 100
    if (currentJob.status === 'failed') return 0
    if (currentJob.status === 'processing') return currentJob.progress || 50
    if (currentJob.status === 'pending') return 25
    return 0
  }

  const handleDeleteJob = async () => {
    if (!currentJob) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/jobs/${currentJob.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete job')
      }

      toast({
        title: "Job deleted successfully",
        description: "The job has been permanently removed.",
      })

      // Redirect to dashboard after successful deletion
      router.push('/dashboard')
    } catch (error) {
      toast({
        title: "Error deleting job",
        description: error instanceof Error ? error.message : "Failed to delete job",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

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
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">← Back to Jobs</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">
                  {currentJob.status === 'completed' ? 'Completed' : 'Processing Your Request'}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  {currentJob.status === 'completed' 
                    ? 'Your AI content has been generated successfully!' 
                    : 'Job submitted, waiting to start...'}
                </p>
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

          {/* Progress Bar */}
          {currentJob && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
            </div>
          )}
          
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
              
              {/* Delete Button */}
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Job</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this job? This action cannot be undone.
                      <br />
                      <strong>Job: {currentJob.title}</strong>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteDialog(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteJob}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete Job"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-6">
            {/* Job Details Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Job Details</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Product Page:</span>
                  <a 
                    href={currentJob.sales_page_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {currentJob.sales_page_url}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Template Style:</span>
                  <span className="text-sm text-muted-foreground">
                    {currentJob.template?.name || 'AI Generated'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Target Avatar:</span>
                  <span className="text-sm text-muted-foreground">
                    {currentJob.customer_avatars?.[0]?.persona_name || 'General Audience'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Job ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {currentJob.id}
                  </span>
                </div>
              </div>
            </div>

            {/* What's happening section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">What's happening?</h2>
              <p className="text-sm text-muted-foreground">
                Our AI is analyzing your product page, researching your market, and crafting compelling copy tailored to your specific audience. This process typically takes 3-5 minutes. You can safely leave this page - we'll save your progress and you can return anytime.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
