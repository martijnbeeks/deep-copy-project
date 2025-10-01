"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { DeepCopyResults } from "@/components/results/deepcopy-results"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { ArrowLeft, BarChart3, FileText, RefreshCw, ExternalLink, Menu, ChevronLeft, ChevronRight } from "lucide-react"
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
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }

    loadJob()
  }, [isAuthenticated, user, router, loadJob])


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
        <div className="p-4 md:p-6">
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
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {currentJob.status}
              </Badge>
              <Link href={`/jobs/${currentJob.id}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Job Details
                </Button>
              </Link>
            </div>
          </div>

          <Tabs defaultValue="content" className="space-y-6">
            <TabsList>
              <TabsTrigger value="content" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <DeepCopyResults 
                result={currentJob.result} 
                jobTitle={currentJob.title}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-6">
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 text-card-foreground">Job Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Generated At</p>
                      <p className="font-medium text-card-foreground">{new Date(currentJob.result.created_at).toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Template Used</p>
                      <p className="font-medium text-card-foreground">L00005 (DeepCopy)</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium capitalize text-card-foreground">{currentJob.status}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <p className="font-medium text-card-foreground">Processing</p>
                    </div>
                    {currentJob.result.metadata?.deepcopy_job_id && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">DeepCopy Job ID</p>
                        <p className="font-medium font-mono text-sm text-card-foreground">{currentJob.result.metadata.deepcopy_job_id}</p>
                      </div>
                    )}
                    {currentJob.result.metadata?.project_name && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Project Name</p>
                        <p className="font-medium text-card-foreground">{currentJob.result.metadata.project_name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {currentJob.result.metadata?.word_count && (
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-card-foreground">Content Metrics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Generated At</p>
                        <p className="text-sm text-card-foreground">{currentJob.result.metadata.generated_at ? new Date(currentJob.result.metadata.generated_at).toLocaleString() : 'Unknown'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">API Timestamp</p>
                        <p className="text-sm text-card-foreground">{currentJob.result.metadata.timestamp_iso ? new Date(currentJob.result.metadata.timestamp_iso).toLocaleString() : 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentJob.result.metadata?.full_result?.results && (
                  <div className="bg-card border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-card-foreground">Analysis Summary</h3>
                    <div className="space-y-4">
                      {currentJob.result.metadata.full_result.results.research_page_analysis && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Page Analysis</p>
                          <p className="text-sm line-clamp-3 text-card-foreground">
                            {currentJob.result.metadata.full_result.results.research_page_analysis.substring(0, 200)}...
                          </p>
                        </div>
                      )}
                      {currentJob.result.metadata.full_result.results.doc1_analysis && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Document Analysis 1</p>
                          <p className="text-sm line-clamp-3 text-card-foreground">
                            {currentJob.result.metadata.full_result.results.doc1_analysis.substring(0, 200)}...
                          </p>
                        </div>
                      )}
                      {currentJob.result.metadata.full_result.results.html_templates && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">HTML Templates</p>
                          <p className="text-sm text-card-foreground">
                            {Array.isArray(currentJob.result.metadata.full_result.results.html_templates) 
                              ? `${currentJob.result.metadata.full_result.results.html_templates.length} template(s) generated`
                              : '1 template generated'
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
