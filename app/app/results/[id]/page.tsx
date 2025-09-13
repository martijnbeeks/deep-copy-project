"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ContentViewer } from "@/components/results/content-viewer"
import { AnalyticsOverview } from "@/components/results/analytics-overview"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, BarChart3, FileText, RefreshCw } from "lucide-react"
import Link from "next/link"

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
  const { user } = useAuth()
  const router = useRouter()
  const [result, setResult] = useState<ResultData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    // Mock result data - replace with real API call
    const mockResult: ResultData = {
      id: params.id,
      jobId: "1",
      content: {
        id: "content-1",
        title: "The Future of AI in Marketing: Transforming Customer Engagement",
        sections: [
          {
            id: "intro",
            title: "Introduction",
            content:
              "Artificial Intelligence (AI) has revolutionized numerous industries, and marketing is no exception. As we advance into 2024, AI technologies are becoming increasingly sophisticated, offering marketers unprecedented opportunities to enhance customer engagement, personalize experiences, and drive business growth.\n\nThis comprehensive guide explores how AI is reshaping the marketing landscape, providing practical insights for businesses looking to leverage these powerful technologies.",
            type: "paragraph",
          },
          {
            id: "current-state",
            title: "The Current State of AI in Marketing",
            content:
              "Today's marketing professionals are already experiencing the transformative power of AI through various applications:\n\n• Predictive analytics for customer behavior forecasting\n• Automated content generation and optimization\n• Real-time personalization engines\n• Intelligent chatbots and customer service automation\n• Advanced segmentation and targeting capabilities\n\nThese tools have enabled marketers to move beyond traditional demographic-based approaches, creating more nuanced and effective campaigns that resonate with individual customers.",
            type: "paragraph",
          },
          {
            id: "benefits",
            title: "Key Benefits of AI-Powered Marketing",
            content:
              "The integration of AI into marketing strategies offers several compelling advantages:\n\n1. **Enhanced Personalization**: AI algorithms can analyze vast amounts of customer data to create highly personalized experiences across all touchpoints.\n\n2. **Improved Efficiency**: Automation of routine tasks allows marketing teams to focus on strategic initiatives and creative work.\n\n3. **Better ROI**: Data-driven insights lead to more effective campaign optimization and resource allocation.\n\n4. **Real-time Adaptation**: AI systems can adjust campaigns in real-time based on performance metrics and changing market conditions.",
            type: "paragraph",
          },
          {
            id: "future-trends",
            title: "Emerging Trends and Future Outlook",
            content:
              "Looking ahead, several exciting developments are poised to further transform AI marketing:\n\n• **Conversational AI**: More sophisticated chatbots and voice assistants will enable natural, context-aware customer interactions\n• **Predictive Customer Lifetime Value**: Advanced models will help businesses identify and nurture high-value prospects\n• **Cross-channel Attribution**: AI will provide clearer insights into the customer journey across multiple touchpoints\n• **Ethical AI**: Growing emphasis on transparent, fair, and responsible AI implementation\n\nAs these technologies mature, we can expect even more innovative applications that will redefine how brands connect with their audiences.",
            type: "paragraph",
          },
        ],
        wordCount: 1247,
        readingTime: 5,
        tone: "professional",
        contentType: "blog-post",
        generatedAt: "2024-01-15T10:45:00Z",
      },
      analytics: {
        qualityScore: 87,
        readabilityScore: 82,
        seoScore: 79,
        toneAccuracy: 91,
        keywordDensity: [
          { keyword: "AI", density: 3.2, target: 2.5 },
          { keyword: "marketing", density: 2.8, target: 3.0 },
          { keyword: "automation", density: 1.5, target: 1.5 },
          { keyword: "personalization", density: 2.1, target: 2.0 },
        ],
        contentMetrics: {
          sentences: 42,
          paragraphs: 8,
          avgSentenceLength: 18,
          fleschScore: 65,
        },
        performancePredictions: [
          { metric: "Engagement", score: 78, benchmark: 65 },
          { metric: "Shareability", score: 72, benchmark: 60 },
          { metric: "Conversion", score: 68, benchmark: 55 },
          { metric: "SEO Ranking", score: 75, benchmark: 70 },
        ],
      },
    }

    setResult(mockResult)
    setIsLoading(false)
  }, [user, router, params.id])

  const handleFeedback = (rating: "positive" | "negative", feedback?: string) => {
    // Handle feedback submission
    console.log("Feedback:", rating, feedback)
  }

  const handleRegenerate = (sectionId?: string) => {
    // Handle content regeneration
    console.log("Regenerate section:", sectionId)
  }

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Result Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested result could not be found.</p>
            <Link href="/results">
              <Button>Return to Results</Button>
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
              <Link href={`/jobs/${result.jobId}`}>
                <Button variant="outline" size="sm">
                  View Job Details
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => handleRegenerate()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate All
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
              <ContentViewer content={result.content} onFeedback={handleFeedback} onRegenerate={handleRegenerate} />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsOverview analytics={result.analytics} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
