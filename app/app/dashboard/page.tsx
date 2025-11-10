"use client"

import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
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
import { BarChart3, FileText, Clock, TrendingUp, AlertCircle, Zap, Menu, ChevronLeft, ChevronRight, Eye, Search, Filter, Calendar, RefreshCw, CheckCircle, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useJobs, useCreateJob, useInvalidateJobs } from "@/lib/hooks/use-jobs"
import { useSimplePolling } from "@/hooks/use-simple-polling"
import { Job } from "@/lib/db/types"

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
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

    const statusColors = {
      completed: "bg-gradient-primary text-primary-foreground",
      processing: "bg-gradient-accent text-accent-foreground",
      pending: "bg-muted text-muted-foreground",
      failed: "bg-destructive text-destructive-foreground",
    }

    return (
      <Badge variant={variants[status]} className={`capitalize text-xs ${statusColors[status]}`}>
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
            <div className="mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Dashboard</h1>
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
                  <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin text-accent' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Compact stats bar */}
            <div className="flex items-center justify-center gap-6 py-4 px-6 bg-gradient-subtle rounded-xl border border-border/50 shadow-elegant mb-8">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-accent rounded-lg flex items-center justify-center">
                  <Clock className="h-3 w-3 text-accent-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Active: {jobs.filter(job => job.status === 'pending' || job.status === 'processing').length}
                </span>
                {isPolling && (
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                )}
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Completed: {jobs.filter(job => job.status === 'completed').length}
                </span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-accent rounded-lg flex items-center justify-center">
                  <FileText className="h-3 w-3 text-accent-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">Total: {jobs.length}</span>
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
                <div className="bg-gradient-primary hover:bg-gradient-primary/90 rounded-xl p-8 text-center shadow-elegant hover:shadow-glow transition-all duration-300 group">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold text-primary-foreground">Create New Content</h2>
                  </div>
                  <p className="text-primary-foreground/80 text-sm">Start generating AI-powered content in seconds</p>
                </div>
              </Link>
            </div>

            {/* Jobs and Results - Tabbed Layout */}
            <Tabs defaultValue="jobs" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-gradient-subtle border border-border/50 shadow-elegant">
                <TabsTrigger value="jobs" className="flex items-center gap-2 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                  <div className="w-5 h-5 bg-gradient-accent rounded-md flex items-center justify-center">
                    <FileText className="h-3 w-3 text-accent-foreground" />
                  </div>
                  All Jobs
                </TabsTrigger>
                <TabsTrigger value="results" className="flex items-center gap-2 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                  <div className="w-5 h-5 bg-gradient-accent rounded-md flex items-center justify-center">
                    <BarChart3 className="h-3 w-3 text-accent-foreground" />
                  </div>
                  Recent Results
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs" className="space-y-4">
                <Card className="bg-card/80 border-border/50 shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-accent-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-foreground">All Jobs</CardTitle>
                        <CardDescription className="text-muted-foreground">Manage and monitor your AI content generation tasks</CardDescription>
                      </div>
                    </div>
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
                            className="p-4 rounded-lg border border-border/50 hover:border-border hover:shadow-elegant transition-all cursor-pointer group bg-card/50"
                            onClick={() => router.push(`/results/${job.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-foreground break-words">{job.title}</h3>
                                  {getStatusBadge(job.status)}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                  <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                                  <span>•</span>
                                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                </div>
                                {job.sales_page_url && (
                                  <a
                                    href={job.sales_page_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-md text-sm font-medium text-primary hover:text-primary/90 transition-colors group/link"
                                    title={job.sales_page_url}
                                  >
                                    <ExternalLink className="h-4 w-4 flex-shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                    <span className="break-all">{job.sales_page_url}</span>
                                  </a>
                                )}
                              </div>
                              <div className="w-8 h-8 bg-gradient-accent/20 rounded-lg flex items-center justify-center group-hover:bg-gradient-accent/30 transition-colors">
                                <Eye className="h-4 w-4 text-accent" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="space-y-4">
                <Card className="bg-card/80 border-border/50 shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-foreground">Recent Results</CardTitle>
                        <CardDescription className="text-muted-foreground">View your completed AI-generated content</CardDescription>
                      </div>
                    </div>
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
                            className="p-4 rounded-lg border border-border/50 hover:border-border hover:shadow-elegant transition-all cursor-pointer group bg-card/50"
                            onClick={() => router.push(`/results/${job.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-foreground break-words">{job.title}</h4>
                                  <Badge variant="default" className="text-xs bg-gradient-primary text-primary-foreground">
                                    completed
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                  <span className="capitalize">{job.template?.name || 'AI Generated'}</span>
                                  <span>•</span>
                                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                </div>
                                {job.sales_page_url && (
                                  <a
                                    href={job.sales_page_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-md text-sm font-medium text-primary hover:text-primary/90 transition-colors group/link"
                                    title={job.sales_page_url}
                                  >
                                    <ExternalLink className="h-4 w-4 flex-shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                    <span className="break-all">{job.sales_page_url}</span>
                                  </a>
                                )}
                              </div>
                              <div className="w-8 h-8 bg-gradient-primary/20 rounded-lg flex items-center justify-center group-hover:bg-gradient-primary/30 transition-colors">
                                <Eye className="h-4 w-4 text-primary" />
                              </div>
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
