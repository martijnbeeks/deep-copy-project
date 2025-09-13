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
import { Eye, Search, Filter, Download, BarChart3, FileText, Calendar } from "lucide-react"
import Link from "next/link"

interface Result {
  id: string
  jobId: string
  title: string
  contentType: string
  wordCount: number
  qualityScore: number
  createdAt: string
  status: "completed" | "archived"
}

const mockResults: Result[] = [
  {
    id: "1",
    jobId: "1",
    title: "The Future of AI in Marketing: Transforming Customer Engagement",
    contentType: "blog-post",
    wordCount: 1247,
    qualityScore: 87,
    createdAt: "2024-01-15T10:45:00Z",
    status: "completed",
  },
  {
    id: "2",
    jobId: "4",
    title: "Weekly Newsletter: Product Updates and Industry News",
    contentType: "email",
    wordCount: 542,
    qualityScore: 92,
    createdAt: "2024-01-14T16:30:00Z",
    status: "completed",
  },
  {
    id: "3",
    jobId: "6",
    title: "Social Media Campaign: New Product Launch",
    contentType: "social-media",
    wordCount: 156,
    qualityScore: 78,
    createdAt: "2024-01-13T14:20:00Z",
    status: "completed",
  },
  {
    id: "4",
    jobId: "8",
    title: "Product Description: Smart Fitness Tracker",
    contentType: "product-description",
    wordCount: 324,
    qualityScore: 85,
    createdAt: "2024-01-12T11:15:00Z",
    status: "archived",
  },
]

export default function ResultsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [results, setResults] = useState<Result[]>(mockResults)
  const [filteredResults, setFilteredResults] = useState<Result[]>(mockResults)
  const [searchTerm, setSearchTerm] = useState("")
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [user, router])

  useEffect(() => {
    let filtered = results

    if (searchTerm) {
      filtered = filtered.filter((result) => result.title.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    if (contentTypeFilter !== "all") {
      filtered = filtered.filter((result) => result.contentType === contentTypeFilter)
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((result) => result.status === statusFilter)
    }

    setFilteredResults(filtered)
  }, [results, searchTerm, contentTypeFilter, statusFilter])

  if (!user) {
    return <PageLoadingSpinner text="Loading results..." />
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your results..." />
        </main>
      </div>
    )
  }

  const getQualityBadge = (score: number) => {
    if (score >= 85) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (score >= 70) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>
    return <Badge className="bg-red-100 text-red-800">Needs Work</Badge>
  }

  const getStatusBadge = (status: Result["status"]) => {
    const variants = {
      completed: "default",
      archived: "secondary",
    } as const

    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
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
                <h1 className="text-3xl font-bold">Content Results</h1>
                <p className="text-muted-foreground">Browse and manage your generated content</p>
              </div>
              <Link href="/dashboard">
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Create New Content
                </Button>
              </Link>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Results</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{results.length}</div>
                  <p className="text-xs text-muted-foreground">Generated content pieces</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(results.reduce((acc, r) => acc + r.qualityScore, 0) / results.length)}
                  </div>
                  <p className="text-xs text-muted-foreground">Content quality rating</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Words</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {results.reduce((acc, r) => acc + r.wordCount, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Words generated</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {results.filter((r) => new Date(r.createdAt).getMonth() === new Date().getMonth()).length}
                  </div>
                  <p className="text-xs text-muted-foreground">New results</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filter Results</CardTitle>
                <CardDescription>Search and filter your generated content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
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
                  <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                    <SelectTrigger className="w-48">
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
                    <SelectTrigger className="w-48">
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
              <div className="grid gap-4">
                {filteredResults.map((result) => (
                  <Card key={result.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{result.title}</h3>
                            {getStatusBadge(result.status)}
                            {getQualityBadge(result.qualityScore)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="capitalize">{result.contentType.replace("-", " ")}</span>
                            <span>•</span>
                            <span>{result.wordCount} words</span>
                            <span>•</span>
                            <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Quality: {result.qualityScore}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Link href={`/results/${result.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View
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
