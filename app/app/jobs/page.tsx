"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner, PageLoadingSpinner } from "@/components/ui/loading-spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Eye, Search, Filter, Plus, FileText, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Job {
  id: string
  title: string
  contentType: string
  status: "pending" | "processing" | "completed" | "failed"
  createdAt: string
  progress?: number
}

const mockJobs: Job[] = [
  {
    id: "1",
    title: "Blog Post: AI in Marketing",
    contentType: "blog-post",
    status: "completed",
    createdAt: "2024-01-15T10:30:00Z",
    progress: 100,
  },
  {
    id: "2",
    title: "Social Media Campaign",
    contentType: "social-media",
    status: "processing",
    createdAt: "2024-01-15T09:15:00Z",
    progress: 65,
  },
  {
    id: "3",
    title: "Product Description: Smart Watch",
    contentType: "product-description",
    status: "pending",
    createdAt: "2024-01-15T08:45:00Z",
  },
  {
    id: "4",
    title: "Email Newsletter: Weekly Update",
    contentType: "email",
    status: "completed",
    createdAt: "2024-01-14T16:20:00Z",
    progress: 100,
  },
  {
    id: "5",
    title: "Landing Page Copy: SaaS Product",
    contentType: "landing-page",
    status: "failed",
    createdAt: "2024-01-14T14:10:00Z",
  },
]

export default function JobsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>(mockJobs)
  const [filteredJobs, setFilteredJobs] = useState<Job[]>(mockJobs)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [user, router])

  useEffect(() => {
    let filtered = jobs

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.contentType.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter)
    }

    setFilteredJobs(filtered)
  }, [jobs, searchTerm, statusFilter])

  if (!user) {
    return <PageLoadingSpinner text="Loading jobs..." />
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your jobs..." />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load jobs</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <OfflineBanner />
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">All Jobs</h1>
                <p className="text-muted-foreground">Manage and monitor your AI content generation tasks</p>
              </div>
              <Link href="/dashboard">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </Button>
              </Link>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filter Jobs</CardTitle>
                <CardDescription>Search and filter your content generation jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="h-4 w-4 mr-2" />
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
              </CardContent>
            </Card>

            {filteredJobs.length === 0 ? (
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
                  onClick: () => router.push("/dashboard"),
                }}
              />
            ) : (
              <div className="grid gap-4">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{job.title}</h3>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="capitalize">{job.contentType.replace("-", " ")}</span>
                            <span>•</span>
                            <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                            {job.progress !== undefined && (
                              <>
                                <span>•</span>
                                <span>{job.progress}% complete</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/jobs/${job.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
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
    </ErrorBoundary>
  )
}

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
