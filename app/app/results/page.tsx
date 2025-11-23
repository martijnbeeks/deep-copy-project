"use client"

import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ResultCardSkeleton } from "@/components/ui/skeleton-loaders"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Eye, Search, Filter, Download, BarChart3, FileText, Calendar, Menu, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function ResultsPage() {
  const { user } = useAuthStore()
  const { jobs, isLoading, error, fetchJobs } = useJobsStore()
  const router = useRouter()
  const [filteredResults, setFilteredResults] = useState(jobs.filter(job => job.status === 'completed'))
  const [searchTerm, setSearchTerm] = useState("")
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; html_content: string; description?: string; category?: string } | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  useEffect(() => {
    if (!user) {
      router.replace("/login")
      return
    }

    fetchJobs()
  }, [user, router])

  // Early return if not authenticated to prevent skeleton loader
  if (!user) {
    return null
  }

  useEffect(() => {
    const completedJobs = jobs.filter(job => job.status === 'completed')
    let filtered = completedJobs

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.brand_info.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (contentTypeFilter !== "all") {
      filtered = filtered.filter((job) => job.template?.category === contentTypeFilter)
    }

    setFilteredResults(filtered)
  }, [jobs, searchTerm, contentTypeFilter])

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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-6 border rounded-lg bg-card space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-5 w-3/4 bg-muted animate-pulse-slow rounded" />
                      <div className="h-4 w-1/2 bg-muted animate-pulse-slow rounded" />
                    </div>
                    <div className="h-6 w-20 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-muted animate-pulse-slow rounded" />
                    <div className="h-4 w-5/6 bg-muted animate-pulse-slow rounded" />
                    <div className="h-4 w-3/4 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <div className="h-6 w-16 bg-muted animate-pulse-slow rounded" />
                      <div className="h-6 w-20 bg-muted animate-pulse-slow rounded" />
                    </div>
                    <div className="h-8 w-8 bg-muted animate-pulse-slow rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16">
          <div className="p-4 md:p-6">
            {/* Header skeleton */}
            <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <div className="h-8 w-48 bg-muted animate-pulse-slow rounded-md" />
                <div className="h-4 w-64 bg-muted animate-pulse-slow rounded-md mt-1" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-40 bg-muted animate-pulse-slow rounded-md" />
                <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
              </div>
            </div>

            {/* Stats overview skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 w-20 bg-muted animate-pulse-slow rounded-md" />
                    <div className="h-4 w-4 bg-muted animate-pulse-slow rounded-md" />
                  </div>
                  <div className="h-8 w-12 bg-muted animate-pulse-slow rounded-md mb-1" />
                  <div className="h-3 w-24 bg-muted animate-pulse-slow rounded-md" />
                </div>
              ))}
            </div>

            {/* Filter card skeleton */}
            <div className="mb-4 md:mb-6">
              <div className="border rounded-lg p-6">
                <div className="h-6 w-32 bg-muted animate-pulse-slow rounded-md mb-2" />
                <div className="h-4 w-64 bg-muted animate-pulse-slow rounded-md mb-4" />
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="h-10 w-full bg-muted animate-pulse-slow rounded-md" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                    <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                    <div className="h-10 w-48 bg-muted animate-pulse-slow rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            {/* Results list skeleton */}
            <div className="grid gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <div className="h-5 w-3/4 bg-muted animate-pulse-slow rounded-md" />
                        <div className="h-6 w-16 bg-muted animate-pulse-slow rounded-full" />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <div className="h-4 w-24 bg-muted animate-pulse-slow rounded-md" />
                        <div className="h-4 w-20 bg-muted animate-pulse-slow rounded-md" />
                        <div className="h-4 w-16 bg-muted animate-pulse-slow rounded-md" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-20 bg-muted animate-pulse-slow rounded-md" />
                      <div className="h-8 w-16 bg-muted animate-pulse-slow rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"} className="capitalize">
        {status}
      </Badge>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-4 md:mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold">Content Results</h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">Browse and manage your generated content</p>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button className="text-sm md:text-base">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Create New Content</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                </Link>

                <SidebarTrigger />
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Results</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredResults.length}</div>
                  <p className="text-xs text-muted-foreground">Generated content pieces</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter(job => job.status === 'completed').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed jobs</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.length > 0 ? Math.round((jobs.filter(job => job.status === 'completed').length / jobs.length) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobs.filter((job) => new Date(job.created_at).getMonth() === new Date().getMonth()).length}
                  </div>
                  <p className="text-xs text-muted-foreground">New jobs this month</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-4 md:mb-6">
              <CardHeader>
                <CardTitle>Filter Results</CardTitle>
                <CardDescription>Search and filter your generated content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search results..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                    <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Content type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="blog-post">Blog Post</SelectItem>
                        <SelectItem value="social-media">Social Media</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="product-description">Product Description</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {filteredResults.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No results found"
                description={
                  searchTerm || contentTypeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Generate your first content to see results here"
                }
                action={{
                  label: "Create Content",
                  onClick: () => router.push("/dashboard"),
                }}
              />
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filteredResults.map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h3 className="text-base md:text-lg font-semibold break-words">{job.title}</h3>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs md:text-sm text-muted-foreground">
                            {job.template ? (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()

                                  // If template already has html_content, use it
                                  if (job.template?.html_content) {
                                    setSelectedTemplate({
                                      name: job.template.name,
                                      html_content: job.template.html_content,
                                      description: job.template.description,
                                      category: job.template.category
                                    })
                                    setIsTemplateModalOpen(true)
                                  } else if (job.template_id) {
                                    // Fetch template if html_content is missing
                                    setIsLoadingTemplate(true)
                                    try {
                                      const response = await fetch(`/api/templates`)
                                      if (response.ok) {
                                        const data = await response.json()
                                        const templateData = data.templates?.find((t: any) => t.id === job.template_id)
                                        if (templateData?.html_content && job.template) {
                                          setSelectedTemplate({
                                            name: templateData.name || job.template.name,
                                            html_content: templateData.html_content,
                                            description: templateData.description || job.template.description,
                                            category: templateData.category || job.template.category
                                          })
                                          setIsTemplateModalOpen(true)
                                        } else {
                                          console.warn('Template not found or has no html_content')
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error fetching template:', error)
                                    } finally {
                                      setIsLoadingTemplate(false)
                                    }
                                  } else {
                                    console.warn('No template_id available')
                                  }
                                }}
                                disabled={isLoadingTemplate}
                                className="capitalize text-primary hover:underline cursor-pointer text-left hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoadingTemplate ? 'Loading...' : job.template.name}
                              </button>
                            ) : (
                              <span className="capitalize">AI Generated</span>
                            )}
                            <span className="hidden sm:inline">•</span>
                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>Status: {job.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/results/${job.id}`}>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <Download className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Download</span>
                              <span className="sm:hidden">DL</span>
                            </Button>
                          </Link>
                          <Link href={`/results/${job.id}`}>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              <Eye className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">View</span>
                              <span className="sm:hidden">View</span>
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Template Preview Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Template: {selectedTemplate?.name || 'Template Preview'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || 'Preview of the template used for this content'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border-t bg-white dark:bg-gray-900 mt-4">
            {selectedTemplate && (
              <iframe
                srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { 
      margin: 0; 
      padding: 10px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #333;
      background: #fff;
    }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    .container { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  ${selectedTemplate.html_content}
</body>
</html>`}
                className="w-full h-[70vh] border rounded-lg"
                title={`Preview of ${selectedTemplate.name}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  )
}
