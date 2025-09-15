"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { ContentViewer } from "@/components/results/content-viewer"
import { AnalyticsOverview } from "@/components/results/analytics-overview"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, BarChart3, FileText, RefreshCw, Download, Eye, ExternalLink, Copy, Check, Menu, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"

interface ResultData {
  id: string
  jobId: string
  content: {
    id: string
    title: string
    sections: Array<{
      id: string
      title: string
      content: string
      type: "heading" | "paragraph" | "list" | "quote"
    }>
    wordCount: number
    readingTime: number
    tone: string
    contentType: string
    generatedAt: string
  }
  analytics: {
    qualityScore: number
    readabilityScore: number
    seoScore: number
    toneAccuracy: number
    keywordDensity: Array<{ keyword: string; density: number; target: number }>
    contentMetrics: {
      sentences: number
      paragraphs: number
      avgSentenceLength: number
      fleschScore: number
    }
    performancePredictions: Array<{ metric: string; score: number; benchmark: number }>
  }
}

export default function ResultDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { currentJob, fetchJob } = useJobsStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }

    const loadJob = async () => {
      try {
        await fetchJob(params.id)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch job:', error)
        setIsLoading(false)
      }
    }

    loadJob()
  }, [isAuthenticated, user, router, params.id, fetchJob])

  const handleFeedback = (rating: "positive" | "negative", feedback?: string) => {
    // Handle feedback submission
  }

  const handleRegenerate = (sectionId?: string) => {
    // Handle content regeneration
  }

  const handleDownload = () => {
    if (currentJob?.result?.html_content) {
      const blob = new Blob([currentJob.result.html_content], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentJob.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleCopyHTML = async () => {
    if (currentJob?.result?.html_content) {
      try {
        await navigator.clipboard.writeText(currentJob.result.html_content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy HTML:', err)
      }
    }
  }

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <Link href="/results">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back to Results</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Content Results</h1>
                <p className="text-sm md:text-base text-muted-foreground">View and analyze your generated content</p>
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
          
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {currentJob.status}
              </Badge>
              <Link href={`/jobs/${currentJob.id}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Job Details
                </Button>
              </Link>
              <Link href={`/preview/${currentJob.id}`}>
                <Button variant="outline" size="sm">
                  <Maximize2 className="h-4 w-4 mr-2" />
                  View Full Screen
                </Button>
              </Link>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="!max-w-[95vw] !max-h-[95vh] !w-[95vw] !h-[95vh] overflow-hidden p-4">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold">Content Preview</DialogTitle>
                    <DialogDescription>
                      Full preview of your generated content
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden max-h-[calc(95vh-120px)] border rounded-lg bg-white">
                    <iframe
                      srcDoc={currentJob.result.html_content}
                      className="w-full h-full min-h-[600px]"
                      sandbox="allow-same-origin allow-scripts"
                      style={{
                        border: 'none',
                        transform: 'scale(0.8)',
                        transformOrigin: 'top left',
                        width: '125%',
                        height: '125%'
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={handleCopyHTML}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy HTML'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRegenerate()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
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
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-white to-blue-50/30 border border-blue-200 rounded-xl p-8 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentJob.title}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Template: <span className="font-medium">{currentJob.template?.name || 'Unknown'}</span></span>
                        <span>•</span>
                        <span>Generated: <span className="font-medium">{new Date(currentJob.result.created_at).toLocaleDateString()}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                        {currentJob.template?.category || 'General'}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-6">
                      <div className="text-center py-12">
                        <h3 className="text-lg font-semibold mb-4">Template Preview</h3>
                        <p className="text-muted-foreground mb-6">
                          Click "View Full Screen" to see the complete template rendering
                        </p>
                        <Link href={`/preview/${currentJob.id}`}>
                          <Button>
                            <Maximize2 className="h-4 w-4 mr-2" />
                            View Full Screen
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Content Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Generated At</p>
                    <p className="font-medium">{new Date(currentJob.result.created_at).toLocaleString()}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Template Used</p>
                    <p className="font-medium">{currentJob.template?.name || 'Unknown'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{currentJob.status}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="font-medium">{currentJob.progress}%</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
