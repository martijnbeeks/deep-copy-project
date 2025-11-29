"use client"

import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { EmptyState } from "@/components/ui/empty-state"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, AlertCircle, Zap, Eye, Search, Filter, Calendar, ExternalLink, ArrowUp, Edit2, Trash2, Building2 } from "lucide-react"
import { SalesPagePreview } from "@/components/sales-page-preview"
import { useToast } from "@/hooks/use-toast"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useJobs, useCreateJob, useUpdateJob, useDeleteJob } from "@/lib/hooks/use-jobs"
import { useSimplePolling } from "@/hooks/use-simple-polling"
import { useJobsStore } from "@/stores/jobs-store"
import { Job, JobWithTemplate } from "@/lib/db/types"
import { isProcessingStatus } from "@/lib/utils/job-status"
import { logger } from "@/lib/utils/logger"
import { internalApiClient } from "@/lib/clients/internal-client"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"

export default function DashboardPage() {
  const { user, isReady } = useRequireAuth()
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()

  // Get filters from UI store
  const { filters, setFilters } = useJobsStore()

  // Use TanStack Query for data fetching with filters
  const { data: jobs = [], isLoading, error: queryError, refetch } = useJobs({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchTerm || undefined
  })
  const createJobMutation = useCreateJob()
  const updateJobMutation = useUpdateJob()
  const deleteJobMutation = useDeleteJob()

  // Edit dialog state
  const [editingJob, setEditingJob] = useState<any | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Delete dialog state
  const [deletingJob, setDeletingJob] = useState<any | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use simple polling for processing jobs (hits DeepCopy API directly)
  const { isPolling } = useSimplePolling(jobs)

  // Count processing jobs using utility
  const processingJobsCount = jobs.filter(job => isProcessingStatus(job.status)).length

  // Fetch user's organization name
  useEffect(() => {
    const fetchOrganization = async () => {
      if (!user?.email) return

      try {
        const response = await fetch('/api/organizations/user-organization', {
          headers: {
            'Authorization': `Bearer ${user.email}`,
          }
        })

        if (response.ok) {
          const data = await response.json()
          setOrganizationName(data.organization?.name || null)
        }
      } catch (error) {
        console.error('Error fetching organization:', error)
      }
    }

    if (user) {
      fetchOrganization()
    }
  }, [user])

  // Log when jobs data changes (development only)
  useEffect(() => {
    const processingJobs = jobs.filter(j => isProcessingStatus(j.status))
    const completedJobs = jobs.filter(j => j.status?.toLowerCase() === 'completed')
    const failedJobs = jobs.filter(j => j.status?.toLowerCase() === 'failed')

    logger.log(`📊 Dashboard: Jobs updated - ${jobs.length} total`)
    logger.log(`  - Processing: ${processingJobs.length}`)
    logger.log(`  - Completed: ${completedJobs.length}`)
    logger.log(`  - Failed: ${failedJobs.length}`)
  }, [jobs])

  // Early return if not authenticated to prevent skeleton loader
  if (!isReady) {
    return null
  }

  // Jobs are already filtered by the API via useJobs hook filters
  // No need for client-side filtering - use jobs directly
  const filteredJobs = jobs


  const getStatusBadge = (status: Job["status"]) => {
    const variants = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
    } as const

    const statusColors = {
      completed: "bg-primary text-primary-foreground",
      processing: "bg-accent text-accent-foreground",
      pending: "bg-muted text-muted-foreground",
      failed: "bg-destructive text-destructive-foreground",
    }

    return (
      <Badge variant={variants[status]} className={`capitalize text-[10px] px-2 py-0.5 font-medium ${statusColors[status]}`}>
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
      const job = await createJobMutation.mutateAsync(data) as { job?: JobWithTemplate } | JobWithTemplate

      toast({
        title: "Pipeline created successfully",
        description: "Your AI content generation has started.",
      })

      // Handle both response formats: { job: ... } or direct job object
      const jobId = (job as any)?.job?.id || (job as any)?.id
      if (jobId) {
        router.push(`/jobs/${jobId}`)
      } else {
        // Fallback: refetch and navigate to jobs list
        refetch()
        router.push('/dashboard')
      }
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

  const scrollToTop = () => {
    const mainElement = document.querySelector('main')
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleEditClick = (job: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingJob(job)
    setEditTitle(job.title)
    setIsEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!editingJob || !editTitle.trim()) {
      toast({
        title: "Error",
        description: "Project name cannot be empty",
        variant: "destructive",
      })
      return
    }

    try {
      await updateJobMutation.mutateAsync({
        id: editingJob.id,
        title: editTitle.trim(),
      })

      toast({
        title: "Success",
        description: "Project name updated successfully",
      })

      setIsEditDialogOpen(false)
      setEditingJob(null)
      setEditTitle("")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update project name",
        variant: "destructive",
      })
    }
  }

  const handleEditCancel = () => {
    setIsEditDialogOpen(false)
    setEditingJob(null)
    setEditTitle("")
  }

  const handleDeleteClick = (job: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingJob(job)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingJob) return

    try {
      setIsDeleting(true)
      await deleteJobMutation.mutateAsync(deletingJob.id)

      toast({
        title: "Project deleted successfully",
        description: "The project has been permanently removed.",
      })

      setIsDeleteDialogOpen(false)
      setDeletingJob(null)
    } catch (error) {
      toast({
        title: "Error deleting project",
        description: error instanceof Error ? error.message : "Failed to delete project",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false)
    setDeletingJob(null)
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16">
          <div className="p-4 md:p-6 pb-24 md:pb-28">
            <div className="mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Welcome back, {user.name}!</p>
                  </div>
                </div>
                {organizationName && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                    {/* <div className="w-2 h-2 rounded-full bg-primary"></div> */}
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {organizationName.charAt(0).toUpperCase() + organizationName.slice(1)}
                    </span>
                  </div>
                )}
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

            {/* All Jobs - Card Grid Layout */}
            <div className="space-y-6">
              {/* Search and Filter */}
              <Card className="bg-card/50 border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search projects by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-background"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-10 bg-background">
                          <SelectValue placeholder="Filter by status" />
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
                  </div>
                </CardContent>
              </Card>

              {/* Jobs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Create New Content Card - First Card */}
                <Link href="/create" className={filteredJobs.length === 0 ? "hidden" : "block"}>
                  <div className="relative cursor-pointer rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 hover:border-primary/50 hover:shadow-md transition-all h-[240px] md:h-[260px] flex flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mb-3">
                        <Zap className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm text-foreground mb-1">
                        Create New Content
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Start generating AI content
                      </p>
                    </div>
                  </div>
                </Link>

                {filteredJobs.length === 0 ? (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <Link href="/create" className="block">
                      <div className="relative cursor-pointer rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 hover:border-primary/50 hover:shadow-md transition-all h-[240px] md:h-[260px] flex flex-col overflow-hidden">
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                          <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mb-3">
                            <Zap className="h-7 w-7 text-primary" />
                          </div>
                          <h3 className="font-semibold text-sm text-foreground mb-1">
                            Create New Content
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Start generating AI content
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ) : (
                  filteredJobs.map((job: any) => (
                    <div
                      key={job.id}
                      className="group relative cursor-pointer rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all h-[240px] md:h-[260px] flex flex-col overflow-hidden"
                      onClick={() => router.push(`/avatars/${job.id}`)}
                    >
                      {/* Preview Area */}
                      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 overflow-hidden min-h-0">
                        {job.sales_page_url ? (
                          <div onClick={(e) => e.stopPropagation()} className="h-full">
                            <SalesPagePreview url={job.sales_page_url} jobId={job.id} className="w-full h-full" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-10 w-10 text-muted-foreground opacity-30" />
                          </div>
                        )}
                      </div>

                      {/* Footer - Clean and organized */}
                      <div className="p-3 bg-card border-border">
                        {/* Title and Status */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm text-foreground line-clamp-1 flex-1">
                            {job.title}
                          </h3>
                          <div className="flex-shrink-0">
                            {getStatusBadge(job.status)}
                          </div>
                        </div>

                        {/* Bottom row - Date and actions */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                              onClick={(e) => handleEditClick(job, e)}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                              onClick={(e) => handleDeleteClick(job, e)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer with Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border ml-16">
            <div className="px-4 py-2 md:px-6 md:py-3">
              <div className="flex items-center justify-between gap-4">
                <Button
                  onClick={() => router.push('/create')}
                  size="default"
                  className="flex-1 max-w-xs"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate New Content
                </Button>
                <Button
                  onClick={scrollToTop}
                  variant="outline"
                  size="default"
                  className="flex-shrink-0"
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Go to Top
                </Button>
              </div>
            </div>
          </div>

          {/* Edit Project Name Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) {
              handleEditCancel()
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Project Name</DialogTitle>
                <DialogDescription>
                  Update the name of your project. This will be reflected across all views.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Project Name</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter project name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleEditSave()
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleEditCancel}
                  disabled={updateJobMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSave}
                  disabled={updateJobMutation.isPending || !editTitle.trim()}
                >
                  {updateJobMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Project Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="shadow-none">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the project
                  {deletingJob && ` "${deletingJob.title}"`} and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </div>
    </ErrorBoundary>
  )
}
