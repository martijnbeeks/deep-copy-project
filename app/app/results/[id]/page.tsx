"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { ContentViewer } from "@/components/results/content-viewer"
import { AnalyticsOverview } from "@/components/results/analytics-overview"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, BarChart3, FileText, RefreshCw, Download } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"

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
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

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
    console.log("Feedback:", rating, feedback)
  }

  const handleRegenerate = (sectionId?: string) => {
    // Handle content regeneration
    console.log("Regenerate section:", sectionId)
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
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/results">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Results
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Content Results</h1>
                <p className="text-muted-foreground">View and analyze your generated content</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/jobs/${currentJob.id}`}>
                <Button variant="outline" size="sm">
                  View Job Details
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download HTML
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
              <div className="space-y-4">
                <div className="bg-white border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">{currentJob.title}</h2>
                  <div className="prose max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: currentJob.result.html_content }} />
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
