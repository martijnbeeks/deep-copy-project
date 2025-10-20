"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { PipelineForm } from "@/components/dashboard/pipeline-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { EmptyState } from "@/components/ui/empty-state"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { BarChart3, FileText, Clock, TrendingUp, AlertCircle, Zap, Menu, ChevronLeft, ChevronRight, Eye, Search, Filter, Calendar, RefreshCw, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useJobs, useCreateJob, useInvalidateJobs } from "@/lib/hooks/use-jobs"
import { useSimplePolling } from "@/hooks/use-simple-polling"
import { Job } from "@/lib/db/types"

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()

  // Use TanStack Query for data fetching
  const { data: jobs = [], isLoading, error: queryError, refetch } = useJobs()
  const createJobMutation = useCreateJob()
  const invalidateJobs = useInvalidateJobs()

  // Use simple polling for processing jobs (hits DeepCopy API directly)
  const { isPolling } = useSimplePolling(jobs)

  // Count processing jobs (handle both uppercase and lowercase)
  const processingJobsCount = jobs.filter(job =>
    job.status?.toLowerCase() === 'submitted' ||
    job.status?.toLowerCase() === 'processing' ||
    job.status?.toLowerCase() === 'running' ||
    job.status?.toLowerCase() === 'pending'
  ).length

  // Log when jobs data changes
  useEffect(() => {
    const submittedJobs = jobs.filter(j => j.status?.toLowerCase() === 'submitted')
    const processingJobs = jobs.filter(j =>
      j.status?.toLowerCase() === 'processing' ||
      j.status?.toLowerCase() === 'running' ||
      j.status?.toLowerCase() === 'pending'
    )
    const completedJobs = jobs.filter(j => j.status?.toLowerCase() === 'completed')
    const failedJobs = jobs.filter(j => j.status?.toLowerCase() === 'failed')

    console.log(`📊 Dashboard: Jobs updated - ${jobs.length} total`)
    console.log(`  - Submitted: ${submittedJobs.length}`)
    console.log(`  - Processing: ${processingJobs.length}`)
    console.log(`  - Completed: ${completedJobs.length}`)
    console.log(`  - Failed: ${failedJobs.length}`)

    // Log ALL jobs with their statuses for debugging
    console.log(`📋 All jobs:`, jobs.map(j => ({ id: j.id, title: j.title, status: j.status })))

    if (submittedJobs.length > 0) {
      console.log(`📤 Submitted jobs:`, submittedJobs.map(j => ({ id: j.id, title: j.title, status: j.status })))
    }

    if (processingJobs.length > 0) {
      console.log(`🔄 Processing jobs:`, processingJobs.map(j => ({ id: j.id, title: j.title, status: j.status })))
    }

    if (failedJobs.length > 0) {
      console.log(`❌ Failed jobs:`, failedJobs.map(j => ({ id: j.id, title: j.title, status: j.status })))
    }
  }, [jobs])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
    }
  }, [isAuthenticated, user, router])

  // Filter jobs based on search and status
  const filteredJobs = jobs.filter((job: any) => {
    const matchesSearch = !searchTerm ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.brand_info.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || job.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Filter completed jobs for results
  const completedJobs = jobs.filter((job: any) => job.status === 'completed')

  const getStatusBadge = (status: Job["status"]) => {
    const variants = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
    } as const

    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-background">
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
              <div className="space-y-2">
                <div className="h-8 w-48 bg-muted animate-pulse-slow rounded" />
                <div className="h-4 w-64 bg-muted animate-pulse-slow rounded" />
              </div>
              <div className="h-10 w-32 bg-muted animate-pulse-slow rounded" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-6 border rounded-lg bg-card">
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted animate-pulse-slow rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse-slow rounded" />
                    <div className="h-3 w-24 bg-muted animate-pulse-slow rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  const handlePipelineSubmit = async (data: any) => {
    setError(null)

    try {
      const job = await createJobMutation.mutateAsync(data)

      toast({
        title: "Pipeline created successfully",
        description: "Your AI content generation has started.",
      })

      router.push(`/jobs/${job.job.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create pipeline"

      // Check if it's a duplicate job error
      if (errorMessage.includes('Duplicate job detected')) {
        setError('A job with this title was created recently. Please wait a moment or use a different title.')
        toast({
          title: "Duplicate job detected",
          description: "A job with this title was created recently. Please wait a moment or use a different title.",
          variant: "destructive",
        })
      } else {
        setError(errorMessage)
        toast({
          title: "Error creating pipeline",
          description: errorMessage,
          variant: "destructive",
        })
      }
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Sidebar toggle button - moved to left */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 p-0 border-border/50 hover:border-border hover:bg-muted/50"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>

                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Welcome back, {user.name}!</p>
                  </div>
                </div>

                {/* Refresh button - simplified */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="h-8 w-8 p-0"
                  title={isPolling ? "Auto-updating" : "Refresh"}
                >
                  <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin text-green-500' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Compact stats bar */}
            <div className="flex items-center justify-center gap-6 py-3 px-4 bg-muted/30 rounded-lg mb-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Active: {jobs.filter(job => job.status === 'pending' || job.status === 'processing').length}
                </span>
                {isPolling && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  Completed: {jobs.filter(job => job.status === 'completed').length}
                </span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total: {jobs.length}</span>
              </div>
            </div>

            {error && (
              <Card className="mb-6 border-destructive">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hero CTA */}
            <div className="mb-8">
              <Link href="/create" className="block">
                <div className="bg-primary hover:bg-primary/90 rounded-xl p-8 text-center shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Zap className="h-6 w-6 text-primary-foreground group-hover:scale-110 transition-transform" />
                    <h2 className="text-2xl font-bold text-primary-foreground">Create New Content</h2>
                  </div>
                  <p className="text-primary-foreground/80 text-sm">Start generating AI-powered content in seconds</p>
                </div>
              </Link>
            </div>

            {/* Jobs and Results - Tabbed Layout */}
            <Tabs defaultValue="jobs" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="jobs" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  All Jobs
                </TabsTrigger>
                <TabsTrigger value="results" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Recent Results
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>All Jobs</CardTitle>
                    <CardDescription>Manage and monitor your AI content generation tasks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Compact Search and Filter */}
                    <div className="flex gap-3 mb-6">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search jobs..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Jobs List */}
                    {filteredJobs.length === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <EmptyState
                          icon={FileText}
                          title="No jobs found"
                          description={
                            searchTerm || statusFilter !== "all"
                              ? "Try adjusting your search or filter criteria"
                              : "Create your first AI content generation job to get started"
                          }
                          action={{
                            label: "Create New Job",
                            onClick: () => router.push("/create"),
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredJobs.map((job: any) => (
                          <div
                            key={job.id}
                            className="p-4 rounded-lg border border-border/50 hover:border-border hover:shadow-sm transition-all cursor-pointer group"
                            onClick={() => router.push(`/jobs/${job.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                  <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                                  {getStatusBadge(job.status)}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                                  <span>•</span>
                                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Results</CardTitle>
                    <CardDescription>View your completed AI-generated content</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {completedJobs.length === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <EmptyState
                          icon={BarChart3}
                          title="No results yet"
                          description="Complete some jobs to see your AI-generated content here"
                          action={{
                            label: "Create New Job",
                            onClick: () => router.push("/create"),
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedJobs.slice(0, 8).map((job: any) => (
                          <div
                            key={job.id}
                            className="p-4 rounded-lg border border-border/50 hover:border-border hover:shadow-sm transition-all cursor-pointer group"
                            onClick={() => router.push(`/results/${job.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className="font-semibold text-foreground truncate">{job.title}</h4>
                                  <Badge variant="default" className="text-xs">
                                    completed
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                                  <span>•</span>
                                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <Eye className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
