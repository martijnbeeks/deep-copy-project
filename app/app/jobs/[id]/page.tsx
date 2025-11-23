"use client"

import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, RefreshCw, Download, Eye, Menu, ChevronLeft, ChevronRight, Trash2, Globe, Sparkles, Users, Zap, CheckCircle, Loader2 } from "lucide-react"
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
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { toast } = useToast()
  
  // Research generation loading state
  const [showResearchLoading, setShowResearchLoading] = useState(false)
  const [researchProgress, setResearchProgress] = useState(0)
  const [researchStage, setResearchStage] = useState(0)

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

  // Show research loading modal if job is processing
  useEffect(() => {
    if (currentJob && (currentJob.status === 'processing' || currentJob.status === 'pending')) {
      setShowResearchLoading(true)
      setResearchProgress(currentJob.progress || 0)
      
      // Determine stage based on progress
      if (currentJob.progress) {
        if (currentJob.progress < 25) {
          setResearchStage(0)
        } else if (currentJob.progress < 50) {
          setResearchStage(1)
        } else if (currentJob.progress < 75) {
          setResearchStage(2)
        } else if (currentJob.progress < 100) {
          setResearchStage(3)
        } else {
          setResearchStage(4)
        }
      } else {
        setResearchStage(0)
      }
    } else if (currentJob && currentJob.status === 'completed') {
      setShowResearchLoading(false)
    }
  }, [currentJob])

  // Update research stage based on job status changes
  useEffect(() => {
    if (jobStatus && showResearchLoading) {
      const progress = jobStatus.progress || 0
      setResearchProgress(progress)
      
      // Update stage based on progress
      if (progress < 25) {
        setResearchStage(0)
      } else if (progress < 50) {
        setResearchStage(1)
      } else if (progress < 75) {
        setResearchStage(2)
      } else if (progress < 100) {
        setResearchStage(3)
      } else {
        setResearchStage(4)
      }
      
      // If job completed, close modal and redirect after a moment
      if (jobStatus.status === 'completed' || jobStatus.status === 'succeeded') {
        setTimeout(() => {
          setShowResearchLoading(false)
          router.push(`/results/${params.id}`)
        }, 1000)
      }
    }
  }, [jobStatus, showResearchLoading, router, params.id])


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
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16 p-6">
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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-16">
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6 gap-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Back to Jobs</span>
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
            {/* Job Details Section - Form in Box Style */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Job Details</h2>
              <div className="space-y-4">
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
                    {currentJob.avatars?.find((a: any) => a.is_researched === true)?.persona_name || 'General Audience'}
                  </span>
                </div>
              </div>
            </div>

            {/* What's happening section */}
            {/*<div className="space-y-4">
              <h2 className="text-lg font-semibold">What's happening?</h2>
              <p className="text-sm text-muted-foreground">
                Our AI is analyzing your product page, researching your market, and crafting compelling copy tailored to your specific audience. This process typically takes 3-5 minutes. You can safely leave this page - we'll save your progress and you can return anytime.
              </p>
            </div> */}
          </div>
        </div>
      </main>

      {/* Research Generation Loading Dialog */}
      <Dialog open={showResearchLoading} onOpenChange={(open) => {
        if (!open) {
          setShowResearchLoading(false)
        }
      }}>
        <DialogContent className="max-w-lg border-border">
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <Zap className="w-10 h-10 text-primary-foreground animate-pulse" />
              </div>
            </div>

            {/* Title - Changes based on stage */}
            <h3 className="text-2xl font-bold text-foreground text-center animate-fade-in">
              {researchStage === 0 && "Scanning Market Sources"}
              {researchStage === 1 && "Analyzing Customer Reviews"}
              {researchStage === 2 && "Evaluating Competitors"}
              {researchStage === 3 && "Mining Reddit & Forums"}
              {researchStage === 4 && "Generating Copy Angles"}
            </h3>

            {/* Stage-specific messages */}
            <div className="space-y-3 w-full animate-fade-in">
              {researchStage === 0 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Checking Amazon reviews, industry publications, and market databases...
                  </p>
                </div>
              )}
              
              {researchStage === 1 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing customer feedback, pain points, and satisfaction patterns...
                  </p>
                </div>
              )}

              {researchStage === 2 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scanning competitor landing pages and dissecting their messaging strategies...
                  </p>
                </div>
              )}

              {researchStage === 3 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Extracting insights from Reddit discussions, forums, and community feedback...
                  </p>
                </div>
              )}

              {researchStage === 4 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Creating compelling marketing angles and high-converting copy variations...
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Deep-diving into market research and competitive analysis
            </p>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground text-center">
                💡 You can close this dialog and check your dashboard. We'll notify you when the research is complete.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
