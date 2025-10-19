"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  ArrowLeft,
  Download,
  Share2,
  FileText,
  Target,
  Users,
  Brain,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Star,
  Heart,
  MessageSquare,
  Briefcase,
  Eye,
  Zap,
  MapPin,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Menu,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  X
} from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/auth-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useSidebar } from "@/contexts/sidebar-context"
import { useRouter } from "next/navigation"
import { useJobPolling } from "@/hooks/use-job-polling"
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ContentViewerSkeleton } from "@/components/ui/skeleton-loaders"
import { DeepCopyResults } from "@/components/results/deepcopy-results"

// Scroll animation hook
const useScrollAnimation = () => {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set(prev).add(entry.target.id))
          }
        })
      },
      { threshold: 0.1, rootMargin: '-50px 0px' }
    )

    sectionRefs.current.forEach((element) => {
      observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  const registerSection = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      sectionRefs.current.set(id, element)
    }
  }, [])

  return { visibleSections, registerSection }
}

export default function ResultDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuthStore()
  const { currentJob, fetchJob } = useJobsStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [injectedTemplates, setInjectedTemplates] = useState<any[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [currentTemplateIndex, setCurrentTemplateIndex] = useState(0)
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false)
  const { visibleSections, registerSection } = useScrollAnimation()

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

  const fetchInjectedTemplates = useCallback(async () => {
    if (!currentJob?.id) return

    try {
      setTemplatesLoading(true)
      const response = await fetch(`/api/templates/injected?job_id=${currentJob.id}`)
      if (response.ok) {
        const data = await response.json()
        setInjectedTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching injected templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }, [currentJob?.id])

  // Carousel navigation functions
  const goToNextTemplate = () => {
    setCurrentTemplateIndex((prev) =>
      prev < injectedTemplates.length - 1 ? prev + 1 : 0
    )
  }

  const goToPreviousTemplate = () => {
    setCurrentTemplateIndex((prev) =>
      prev > 0 ? prev - 1 : injectedTemplates.length - 1
    )
  }

  const goToTemplate = (index: number) => {
    setCurrentTemplateIndex(index)
  }

  // Use auto-polling for processing jobs (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()

  // Use client-side polling for job status updates
  const {
    jobStatus,
    isPolling,
    attempts,
    maxAttempts
  } = useJobPolling({
    jobId: params.id,
    enabled: currentJob?.status === 'processing' || currentJob?.status === 'pending',
    interval: 5000,
    maxAttempts: 120,
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
    if (isAuthenticated && user) {
      loadJob()
    }
  }, [isAuthenticated, user, loadJob])

  useEffect(() => {
    if (currentJob?.id) {
      fetchInjectedTemplates()
    }
  }, [currentJob?.id, fetchInjectedTemplates])

  // Show loading state instead of redirecting
  if (!isAuthenticated || !user) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-6">
          <ContentViewerSkeleton />
        </main>
      </div>
    )
  }

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

  const result = currentJob.result.metadata?.full_result?.results || currentJob.result.metadata?.results || currentJob.result.metadata || {}
  const isVisible = (sectionId: string) => visibleSections.has(sectionId)

  // Function to render markdown content
  const renderMarkdown = (content: string) => {
    if (!content) return <p className="text-gray-500 italic">No content available</p>
    return (
      <div className="prose prose-lg max-w-none text-black prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-ul:text-gray-800 prose-ol:text-gray-800 prose-li:text-gray-800">
        <div dangerouslySetInnerHTML={{
          __html: content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
            .replace(/^### (.*$)/gim, '<h3>$1</h3>') // H3
            .replace(/^## (.*$)/gim, '<h2>$1</h2>') // H2
            .replace(/^# (.*$)/gim, '<h1>$1</h1>') // H1
            .replace(/^\* (.*$)/gim, '<li>$1</li>') // Bullet points
            .replace(/^- (.*$)/gim, '<li>$1</li>') // Dash points
            .replace(/\n/g, '<br/>') // Line breaks
        }} />
      </div>
    )
  }

  // Function to render avatar sheet with special layout
  const renderAvatarSheet = (avatarData: any) => {
    if (!avatarData) return <p className="text-gray-500 italic">No avatar data available</p>

    // If it's a string (JSON), parse it
    let parsedData = avatarData
    if (typeof avatarData === 'string') {
      try {
        parsedData = JSON.parse(avatarData)
      } catch (e) {
        return <p className="text-gray-500 italic">Invalid avatar data format</p>
      }
    }

    return (
      <div className="space-y-6">

        {/* Demographics */}
        {parsedData.demographics && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-bold text-blue-900 mb-3">Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(parsedData.demographics).map(([key, value]) => (
                <div key={key} className="bg-white p-3 rounded border">
                  <h4 className="font-semibold text-gray-800 capitalize mb-2">
                    {key.replace(/_/g, ' ')}
                  </h4>
                  {Array.isArray(value) ? (
                    <ul className="text-sm text-gray-700 space-y-1">
                      {value.map((item, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700">{String(value) || 'Not specified'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pain Points */}
        {parsedData.pain_points && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 className="text-lg font-bold text-red-900 mb-3">Pain Points</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsedData.pain_points.map((painPoint: any, index: number) => (
                <div key={index} className="bg-white p-4 rounded border border-red-100">
                  <h4 className="font-semibold text-red-800 mb-2">{painPoint.title}</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {painPoint.bullets.map((bullet: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        {parsedData.goals && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-lg font-bold text-green-900 mb-3">Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(parsedData.goals).map(([key, value]) => (
                <div key={key} className="bg-white p-4 rounded border border-green-100">
                  <h4 className="font-semibold text-green-800 capitalize mb-2">
                    {key.replace(/_/g, ' ')}
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {Array.isArray(value) && value.map((goal: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emotional Drivers */}
        {parsedData.emotional_drivers && (
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="text-lg font-bold text-purple-900 mb-3">Emotional Drivers</h3>
            <div className="bg-white p-4 rounded border border-purple-100">
              <ul className="text-sm text-gray-700 space-y-2">
                {parsedData.emotional_drivers.map((driver: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Quotes */}
        {parsedData.quotes && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="text-lg font-bold text-yellow-900 mb-3">Quotes & Testimonials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(parsedData.quotes).map(([key, value]) => (
                <div key={key} className="bg-white p-4 rounded border border-yellow-100">
                  <h4 className="font-semibold text-yellow-800 capitalize mb-2">
                    {key.replace(/_/g, ' ')}
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {Array.isArray(value) && value.map((quote: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-yellow-500 mr-2">"</span>
                        <span className="italic">{quote}</span>
                        <span className="text-yellow-500 ml-1">"</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emotional Journey */}
        {parsedData.emotional_journey && (
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <h3 className="text-lg font-bold text-indigo-900 mb-3">Emotional Journey</h3>
            <div className="bg-white p-4 rounded border border-indigo-100">
              <div className="space-y-4">
                {Object.entries(parsedData.emotional_journey).map(([stage, description]) => (
                  <div key={stage} className="border-l-4 border-indigo-400 pl-4">
                    <h4 className="font-semibold text-indigo-800 capitalize mb-1">
                      {stage.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-sm text-gray-700">{String(description)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Marketing Angles */}
        {parsedData.marketing_angles && (
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 className="text-lg font-bold text-orange-900 mb-3">Marketing Angles</h3>
            <div className="bg-white p-4 rounded border border-orange-100">
              <ul className="text-sm text-gray-700 space-y-2">
                {parsedData.marketing_angles.map((angle: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <span>{angle}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Function to render all API keys as sections
  const renderApiSections = (): JSX.Element[] => {
    const sections: JSX.Element[] = []
    const excludedKeys = ['swipe_results'] // Exclude swipe_results as it's handled separately

    Object.entries(result).forEach(([key, value], index) => {
      if (excludedKeys.includes(key) || !value) return

      const sectionId = `api-${key}`
      const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

      sections.push(
        <div
          key={key}
          id={sectionId}
          ref={(el) => registerSection(sectionId, el)}
          className="mb-8"
        >
          <Accordion type="single" collapsible>
            <AccordionItem value={sectionId}>
              <Card className="bg-white border-2 border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-black">{title}</h2>
                        <p className="text-sm text-gray-600">API response data for {key}</p>
                      </div>
                    </div>
                    <AccordionTrigger />
                  </div>
                </div>
                <AccordionContent>
                  <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-black">
                        {key === 'avatar_sheet' ? (
                          renderAvatarSheet(value)
                        ) : typeof value === 'string' ? (
                          renderMarkdown(value)
                        ) : Array.isArray(value) ? (
                          <div className="space-y-4">
                            {value.map((item, idx) => (
                              <div key={idx} className="bg-white p-4 rounded border">
                                {typeof item === 'object' ? (
                                  <pre className="text-sm overflow-x-auto">
                                    {JSON.stringify(item, null, 2)}
                                  </pre>
                                ) : (
                                  <p>{String(item)}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : typeof value === 'object' ? (
                          <pre className="text-sm overflow-x-auto">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          <p>{String(value)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )
    })

    return sections
  }

  // Debug logging
  console.log('🔍 Results Page - currentJob:', currentJob)
  console.log('🔍 Results Page - result:', result)
  console.log('🔍 Results Page - has research_page_analysis:', !!result.research_page_analysis)
  console.log('🔍 Results Page - has doc1_analysis:', !!result.doc1_analysis)
  console.log('🔍 Results Page - has summary:', !!result.summary)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto md:ml-0">
        <div className="min-h-screen bg-gradient-subtle pb-32">
          {/* Header */}
          <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold">AI</span>
                  </div>
                  <span className="text-xl font-bold text-foreground">DeepCopy</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                  <Button variant="outline" size="sm">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/dashboard">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Content Generation Complete</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold mb-6 text-visible">
                {currentJob.title}
              </h1>
              <p className="text-lg sm:text-xl text-visible-muted max-w-4xl mx-auto">
                Your AI-generated content is ready. Review the research, analysis, and generated templates below.
              </p>
            </div>

            {/* Status and Progress */}
            <div className="mb-8">
              <Card className="p-6 bg-card/80 border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${currentJob.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="text-sm font-medium capitalize text-visible">{currentJob.status}</span>
                    </div>
                    {(isRefreshing || isPolling) && (
                      <div className="flex items-center gap-2 text-sm text-visible-muted">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Polling DeepCopy API ({attempts}/{maxAttempts})</span>
                        {jobStatus.progress && (
                          <span className="text-blue-600 font-medium">
                            {jobStatus.progress}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {currentJob.advertorial_type}
                  </Badge>
                </div>
              </Card>
            </div>


            {/* Dynamic API Sections */}
            {renderApiSections()}

            {/* Generated Templates Section - Carousel Only */}
            <div
              id="templates"
              ref={(el) => registerSection('templates', el)}
              className="mb-12"
            >
              <Accordion type="single" collapsible>
                <AccordionItem value="templates">
                  <Card className="bg-white border-2 border-orange-500">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-black">Generated Templates</h2>
                            <p className="text-sm text-gray-600">Browse through each template angle</p>
                          </div>
                        </div>
                        <AccordionTrigger />
                      </div>
                    </div>
                    <AccordionContent>
                      <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          {templatesLoading ? (
                            <div className="p-8 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                              <p className="text-gray-500">Loading templates...</p>
                            </div>
                          ) : injectedTemplates.length > 0 ? (
                            <div className="space-y-6">
                              {/* Carousel Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <h3 className="text-lg font-semibold text-gray-800">
                                    {injectedTemplates[currentTemplateIndex]?.angle_name || `Template ${currentTemplateIndex + 1}`}
                                  </h3>
                                  <span className="text-sm text-gray-500">
                                    {currentTemplateIndex + 1} of {injectedTemplates.length}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsFullPreviewOpen(true)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Full Preview
                                  </Button>
                                </div>
                              </div>

                              {/* Carousel Navigation */}
                              <div className="flex items-center justify-between">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={goToPreviousTemplate}
                                  disabled={injectedTemplates.length <= 1}
                                  className="flex items-center gap-2"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                  Previous
                                </Button>

                                {/* Template Dots */}
                                <div className="flex items-center gap-2">
                                  {injectedTemplates.map((_, index) => (
                                    <button
                                      key={index}
                                      onClick={() => goToTemplate(index)}
                                      className={`w-3 h-3 rounded-full transition-colors ${index === currentTemplateIndex
                                        ? 'bg-orange-500'
                                        : 'bg-gray-300 hover:bg-gray-400'
                                        }`}
                                    />
                                  ))}
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={goToNextTemplate}
                                  disabled={injectedTemplates.length <= 1}
                                  className="flex items-center gap-2"
                                >
                                  Next
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Current Template Display */}
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <div
                                  className="w-full h-[600px] overflow-auto template-content-isolation"
                                  style={{
                                    // Ensure proper word wrapping for long content
                                    wordWrap: 'break-word',
                                    overflowWrap: 'break-word',
                                    // Prevent content from breaking out of container
                                    maxWidth: '100%',
                                    // Ensure proper text rendering
                                    textRendering: 'optimizeLegibility',
                                    // Prevent layout issues
                                    contain: 'layout style'
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: injectedTemplates[currentTemplateIndex]?.html_content || '<p class="p-4 text-gray-500">No content available</p>'
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 text-center">
                              <p className="text-gray-500 mb-4">No templates available</p>
                              <p className="text-sm text-gray-400">Templates will appear here once the job is completed</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              </Accordion>
            </div>


          </div>

          {/* Full Preview Modal */}
          {isFullPreviewOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-900">
                      {injectedTemplates[currentTemplateIndex]?.angle_name || `Template ${currentTemplateIndex + 1}`}
                    </h2>
                    <span className="text-sm text-gray-500">
                      {currentTemplateIndex + 1} of {injectedTemplates.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousTemplate}
                      disabled={injectedTemplates.length <= 1}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextTemplate}
                      disabled={injectedTemplates.length <= 1}
                      className="flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullPreviewOpen(false)}
                      className="flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Close
                    </Button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-hidden">
                  <div
                    className="w-full h-full overflow-auto template-content-isolation"
                    style={{
                      // Ensure proper word wrapping for long content
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      // Prevent content from breaking out of container
                      maxWidth: '100%',
                      // Ensure proper text rendering
                      textRendering: 'optimizeLegibility',
                      // Prevent layout issues
                      contain: 'layout style'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: injectedTemplates[currentTemplateIndex]?.html_content || '<p class="p-4 text-gray-500">No content available</p>'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 shadow-elegant z-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <span className="text-primary font-medium">
                    ✓ Content generation complete
                  </span>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="lg">
                    <Download className="w-4 h-4 mr-2" />
                    Export All
                  </Button>
                  <Button variant="default" size="lg">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Results
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}