"use client"

import dynamic from "next/dynamic"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"

// Dynamically import large component to reduce initial bundle size
const DeepCopyResults = dynamic(
  () => import("@/components/results/deepcopy-results").then((mod) => mod.DeepCopyResults),
  {
    loading: () => <ContentViewerSkeleton />,
    ssr: false, // Component uses client-side only features
  }
)
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Download, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useJob } from "@/lib/hooks/use-jobs"
import { ContentViewerSkeleton } from "@/components/ui/skeleton-loaders"
import { useJobPolling } from "@/hooks/use-job-polling"
import { isProcessingStatus } from "@/lib/utils/job-status"


export default function ResultDetailPage({ params }: { params: { id: string } }) {
  const { user, isReady } = useRequireAuth()
  const router = useRouter()
  
  // Use TanStack Query for data fetching
  const { data: currentJob, isLoading, refetch } = useJob(params.id)

  // Use client-side polling for job status updates
  const {
    jobStatus,
    isPolling,
    attempts,
    maxAttempts
  } = useJobPolling({
    jobId: params.id,
    enabled: currentJob ? isProcessingStatus(currentJob.status) : false,
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

  // Early return if not authenticated to prevent skeleton loader
  if (!isReady) {
    return null
  }

  if (isLoading) {
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
  
  // Get selected/researched avatars
  const selectedAvatars = currentJob?.avatars?.filter((a: any) => a.is_researched === true) || []
  const selectedAvatarNames = selectedAvatars.map((a: any) => a.persona_name).join(', ')

  // Determine the parent job ID for navigation back to avatars
  // If this is a research job (has parent_job_id), use the parent, otherwise use current job ID
  const avatarsPageJobId = currentJob?.parent_job_id || params.id

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
                    onClick={() => router.push(`/avatars/${avatarsPageJobId}`)}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Avatars
                  </Button>
                  {currentJob && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <span>{capitalizedTitle}</span>
                        {selectedAvatarNames && (
                          <>
                            <span>•</span>
                            <span className="font-semibold">{selectedAvatarNames}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(projectDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</span>
                      </span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <h1 className="text-sm font-medium">
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