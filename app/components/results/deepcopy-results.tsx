"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MarkdownContent } from "@/components/results/markdown-content"
import { TemplateGrid } from "@/components/results/template-grid"
import { FileText, BarChart3, Code, BookOpen, User, Target, Calendar, Clock, Users, MapPin, DollarSign, Briefcase, Sparkles, AlertTriangle, Star, Eye, TrendingUp, Brain, Loader2, CheckCircle2, Download } from "lucide-react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { extractContentFromSwipeResult, injectContentIntoTemplate } from "@/lib/utils/template-injection"
import { JobResult, SwipeResult, Listicle, Advertorial } from "@/lib/api/deepcopy-client"

interface DeepCopyResult extends JobResult {
  // This now matches the JobResult interface from the API client
}

interface DeepCopyResultsProps {
  result: {
    html_content: string
    metadata?: {
      deepcopy_job_id?: string
      project_name?: string
      timestamp_iso?: string
      full_result?: DeepCopyResult
      generated_at?: string
      word_count?: number
      template_used?: string
      generated_angles?: string[]
    }
  }
  jobTitle: string
  jobId?: string
  advertorialType?: string
  templateId?: string
  customerAvatars?: Array<{ persona_name: string; description?: string; age_range?: string; gender?: string; key_buying_motivation?: string }>
}

export function DeepCopyResults({ result, jobTitle, jobId, advertorialType, templateId, customerAvatars }: DeepCopyResultsProps) {
  const [templates, setTemplates] = useState<Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }>>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; html_content: string; description?: string; category?: string } | null>(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)

  // Swipe file generation state - track multiple angles
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null)
  const [generatedAngles, setGeneratedAngles] = useState<Set<string>>(new Set())
  const [generatingAngles, setGeneratingAngles] = useState<Map<string, string>>(new Map()) // angle -> jobId
  const [angleStatuses, setAngleStatuses] = useState<Map<string, string>>(new Map()) // angle -> status
  const [isGeneratingSwipeFiles, setIsGeneratingSwipeFiles] = useState(false)
  const [swipeFileResults, setSwipeFileResults] = useState<any>(null)

  const fullResult = result.metadata?.full_result
  const originalJobId = result.metadata?.deepcopy_job_id

  // Poll swipe file status for a specific angle
  const pollSwipeFileStatus = async (jobId: string, angle: string) => {
    const maxAttempts = 60 // 5 minutes max (60 * 5s)
    const pollInterval = 5000 // Poll every 5 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const response = await fetch(`/api/swipe-files/${jobId}`)
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`)
        }

        const statusData = await response.json()

        // Update status for this specific angle
        setAngleStatuses(prev => {
          const newMap = new Map(prev)
          newMap.set(angle, statusData.status)
          return newMap
        })

        if (statusData.status === 'SUCCEEDED') {
          // Fetch results
          const resultResponse = await fetch(`/api/swipe-files/${jobId}/result`)
          if (!resultResponse.ok) {
            throw new Error(`Result fetch failed: ${resultResponse.status}`)
          }

          const resultData = await resultResponse.json()

          // Update fullResult with swipe results first
          let swipeResults: any[] = []
          if (fullResult && fullResult.results) {
            // Convert swipe file results to swipe_results format
            swipeResults = fullResult.results.swipe_results || []
            Object.keys(resultData).forEach((key) => {
              // Template IDs like L00001, A00003, etc.
              if (key.match(/^[LA]\d+$/)) {
                const templateData = resultData[key]
                if (templateData && templateData.full_advertorial) {
                  // Check if this angle already exists, if so update it, otherwise add it
                  const existingIndex = swipeResults.findIndex(sr => sr.angle === angle)
                  if (existingIndex >= 0) {
                    swipeResults[existingIndex] = {
                      angle: angle,
                      content: templateData.full_advertorial
                    }
                  } else {
                    swipeResults.push({
                      angle: angle,
                      content: templateData.full_advertorial
                    })
                  }
                }
              }
            })

            // Update the results with swipe_results
            fullResult.results.swipe_results = swipeResults
            // Force a re-render by updating the result object
            result.metadata = {
              ...result.metadata,
              full_result: fullResult
            }
          }

          // Mark this angle as generated and persist to database
          setGeneratedAngles(prev => {
            const newSet = new Set(prev).add(angle)

            // Persist to database
            if (jobId) {
              fetch(`/api/jobs/${jobId}/update-generated-angles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  generatedAngles: Array.from(newSet),
                  swipeResults: swipeResults
                })
              }).catch(err => console.error('Failed to persist generated angles:', err))
            }

            return newSet
          })

          // Remove from generating map
          setGeneratingAngles(prev => {
            const newMap = new Map(prev)
            newMap.delete(angle)
            return newMap
          })

          // Reload templates to show the new swipe files
          const extractedTemplates = await extractHTMLTemplates()
          setTemplates(extractedTemplates)
          setTemplatesLoading(false)
          return
        } else if (statusData.status === 'FAILED') {
          // Remove from generating map on failure
          setGeneratingAngles(prev => {
            const newMap = new Map(prev)
            newMap.delete(angle)
            return newMap
          })
          throw new Error('Swipe file generation job failed')
        }
      } catch (err) {
        if (attempt === maxAttempts) {
          console.error('Swipe file polling error:', err)
          // Remove from generating map on timeout
          setGeneratingAngles(prev => {
            const newMap = new Map(prev)
            newMap.delete(angle)
            return newMap
          })
          setAngleStatuses(prev => {
            const newMap = new Map(prev)
            newMap.set(angle, 'FAILED')
            return newMap
          })
        }
      }
    }

    // Remove from generating map on timeout
    setGeneratingAngles(prev => {
      const newMap = new Map(prev)
      newMap.delete(angle)
      return newMap
    })
    setAngleStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(angle, 'TIMEOUT')
      return newMap
    })
  }

  const extractHTMLTemplates = async () => {
    const templates: Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }> = []

    try {
      // Check if we have full result data with swipe_results
      if (fullResult && fullResult.results?.swipe_results) {
        const swipeResults = fullResult.results.swipe_results

        // Get injectable template for this specific template ID
        const templateType = advertorialType === 'listicle' ? 'listicle' : 'advertorial'

        try {
          let injectableTemplate = null

          if (templateId) {
            // Try to fetch the specific injectable template with the same ID
            const specificResponse = await fetch(`/api/admin/injectable-templates?id=${templateId}`)
            const specificTemplates = await specificResponse.json()

            if (specificTemplates.length > 0) {
              injectableTemplate = specificTemplates[0]
            }
          }

          // Fallback: fetch by type if specific template not found
          if (!injectableTemplate) {
            const response = await fetch(`/api/admin/injectable-templates?type=${templateType}`)
            const injectableTemplates = await response.json()

            if (injectableTemplates.length > 0) {
              injectableTemplate = injectableTemplates[0]
            }
          }

          if (injectableTemplate) {
            // Process each swipe result
            swipeResults.forEach((swipeResult, index) => {
              try {
                // extractContentFromSwipeResult now handles both string and object formats
                // Pass the swipeResult as-is
                const contentData = extractContentFromSwipeResult(swipeResult, templateType)

                // Inject content into the injectable template
                const renderedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

                templates.push({
                  name: typeof swipeResult.angle === 'string' && swipeResult.angle.includes(':')
                    ? swipeResult.angle.split(':')[0].trim()
                    : `Angle ${index + 1}`,
                  type: 'Marketing Angle',
                  html: renderedHtml,
                  angle: swipeResult.angle,
                  timestamp: result.metadata?.generated_at || new Date().toISOString()
                })
              } catch (error) {
                console.error(`Error processing angle ${index + 1}:`, error)
              }
            })
          } else {
            // Fallback to old carousel method
            return await extractFromCarousel()
          }
        } catch (error) {
          console.error('Error fetching injectable templates:', error)
          // Fallback to old carousel method
          return await extractFromCarousel()
        }

        return templates
      }

      // Fallback: Check if we have processed HTML content (carousel) from the old system
      if (result.html_content && result.html_content.includes('carousel-container')) {
        return await extractFromCarousel()
      }

      // If no data available, show empty state
      return templates

    } catch (error) {
      console.error('Error in template extraction:', error)
      return templates
    }
  }

  const extractFromCarousel = async () => {
    const templates: Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }> = []

    try {
      // Extract individual angles and their HTML from the carousel
      const angleMatches = result.html_content.match(/<button class="nav-button[^>]*>([^<]+)<\/button>/g)
      const angles = angleMatches ? angleMatches.map(match =>
        match.replace(/<[^>]*>/g, '').trim()
      ) : ['Marketing Angle 1']

      // Try multiple approaches to extract template content
      let templateContent: string[] = []

      // Approach 1: Look for iframes with srcdoc
      const iframeMatches = result.html_content.match(/<iframe[^>]*srcdoc="([^"]*)"[^>]*><\/iframe>/g)

      if (iframeMatches && iframeMatches.length > 0) {
        templateContent = iframeMatches.map(iframeHtml => {
          const contentMatch = iframeHtml.match(/srcdoc="([^"]*)"/)
          if (contentMatch) {
            return contentMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
          }
          return ''
        }).filter(content => content.length > 0)
      }

      // Approach 2: Look for template-slide divs with content
      if (templateContent.length === 0) {
        const slideMatches = result.html_content.match(/<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)

        if (slideMatches && slideMatches.length > 0) {
          templateContent = slideMatches.map(slideHtml => {
            // Extract content from within the slide
            const contentMatch = slideHtml.match(/<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)
            return contentMatch ? contentMatch[1] : slideHtml
          })
        }
      }

      // Approach 3: Look for any div with template content
      if (templateContent.length === 0) {
        const divMatches = result.html_content.match(/<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/g)

        if (divMatches && divMatches.length > 0) {
          templateContent = divMatches.map(divHtml => {
            const contentMatch = divHtml.match(/<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/)
            return contentMatch ? contentMatch[1] : divHtml
          })
        }
      }

      // Create templates from extracted content
      if (templateContent.length > 0) {
        angles.forEach((angle, index) => {
          const content = templateContent[index] || templateContent[0] || result.html_content

          templates.push({
            name: `Angle ${index + 1}`,
            type: 'Marketing Angle',
            html: content,
            angle: angle,
            timestamp: result.metadata?.generated_at || new Date().toISOString()
          })
        })
      } else {
        // Fallback: create individual templates with the full carousel HTML
        angles.forEach((angle, index) => {
          templates.push({
            name: `Angle ${index + 1}`,
            type: 'Marketing Angle',
            html: result.html_content,
            angle: angle,
            timestamp: result.metadata?.generated_at || new Date().toISOString()
          })
        })
      }

      return templates
    } catch (error) {
      console.error('Error in carousel extraction:', error)
      return templates
    }
  }

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true)
      try {
        const extractedTemplates = await extractHTMLTemplates()
        setTemplates(extractedTemplates)

        // Mark angles as generated if they have templates or from metadata
        const generatedSet = new Set<string>()

        // First, check metadata for persisted generated angles
        if (result.metadata?.generated_angles && Array.isArray(result.metadata.generated_angles)) {
          result.metadata.generated_angles.forEach((angle: string) => {
            generatedSet.add(angle)
          })
        }

        // Also check swipe_results for angles
        if (fullResult?.results?.swipe_results && fullResult.results.swipe_results.length > 0) {
          fullResult.results.swipe_results.forEach((sr: any) => {
            if (sr.angle) {
              generatedSet.add(sr.angle)
            }
          })
        }

        setGeneratedAngles(generatedSet)
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setTemplatesLoading(false)
      }
    }

    // Always try to load templates, whether we have processed content or raw results
    loadTemplates()
  }, [result, jobTitle, swipeFileResults, fullResult])

  const formatAnalysis = (analysis: string) => {
    const paragraphs = analysis.split('\n\n').filter(p => p.trim())
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="mb-4 leading-relaxed">
        {paragraph.trim()}
      </p>
    ))
  }

  return (
    <div className="space-y-8 min-h-full">
      {/* Project Overview */}
      <div className="mb-12">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="p-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Project Overview</h2>
                <p className="text-sm text-muted-foreground">Job details and metadata</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">Generated At</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {result.metadata?.generated_at ? new Date(result.metadata.generated_at).toLocaleString() : 'Unknown'}
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">Template Used</span>
                </div>
                {templateId ? (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      setIsLoadingTemplate(true)
                      try {
                        const response = await fetch(`/api/templates`)
                        if (response.ok) {
                          const data = await response.json()
                          const templateData = data.templates?.find((t: any) => t.id === templateId)
                          if (templateData?.html_content) {
                            setSelectedTemplate({
                              name: templateData.name,
                              html_content: templateData.html_content,
                              description: templateData.description,
                              category: templateData.category
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
                    }}
                    disabled={isLoadingTemplate}
                    className="text-sm text-primary hover:underline cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingTemplate ? 'Loading...' : result.metadata?.template_used || 'L00005 (DeepCopy)'}
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {result.metadata?.template_used || 'L00005 (DeepCopy)'}
                  </p>
                )}
              </div>
              {fullResult?.project_name && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">Project Name</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{fullResult.project_name}</p>
                </div>
              )}
              {result.metadata?.deepcopy_job_id && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">DeepCopy Job ID</span>
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">{result.metadata.deepcopy_job_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Avatar & Marketing */}
      {(fullResult?.results?.avatar_sheet || fullResult?.results?.marketing_angles) && (
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="avatar-marketing">
              <Card className="bg-card/80 border-border/50">
                <AccordionTrigger className="p-8 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Avatar & Marketing</h2>
                        <p className="text-sm text-muted-foreground">Customer avatar and marketing angles</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {fullResult?.results?.avatar_sheet && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold mb-4">
                            {customerAvatars?.[0]?.persona_name || 'Customer Avatar'}
                          </h4>
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                            {(() => {
                              try {
                                const avatarData = JSON.parse(fullResult.results.avatar_sheet)
                                return (
                                  <Accordion type="multiple" className="w-full">
                                    {/* Demographics */}
                                    <AccordionItem value="demographics" className="border-none">
                                      <AccordionTrigger className="py-2 hover:no-underline">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-4 w-4 text-primary" />
                                          <span className="font-semibold text-foreground text-sm">Demographics</span>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="pt-2">
                                        <div className="space-y-3">
                                          <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                              <p className="text-muted-foreground text-xs">Age</p>
                                              <p className="font-medium text-foreground">{avatarData.demographics?.age_range || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <p className="text-muted-foreground text-xs">Gender</p>
                                              <p className="font-medium text-foreground">
                                                {avatarData.demographics?.gender?.join(', ') || 'N/A'}
                                              </p>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground text-xs mb-1">Locations</p>
                                            <div className="flex flex-wrap gap-1">
                                              {avatarData.demographics?.locations?.map((location: string, index: number) => (
                                                <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                                                  {location}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>

                                    {/* Professional Background */}
                                    {avatarData.demographics?.professional_backgrounds && (
                                      <AccordionItem value="professional-background" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-accent" />
                                            <span className="font-semibold text-foreground text-sm">Professional Background</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="flex flex-wrap gap-1">
                                            {avatarData.demographics.professional_backgrounds.map((bg: string, index: number) => (
                                              <Badge key={index} variant="outline" className="text-sm px-2 py-0.5">
                                                {bg}
                                              </Badge>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}

                                    {/* Identities */}
                                    {avatarData.demographics?.typical_identities && (
                                      <AccordionItem value="identities" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-accent" />
                                            <span className="font-semibold text-foreground text-sm">Identities</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="flex flex-wrap gap-1">
                                            {avatarData.demographics.typical_identities.map((identity: string, index: number) => (
                                              <Badge key={index} variant="secondary" className="text-sm px-2 py-0.5">
                                                {identity}
                                              </Badge>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}

                                    {/* Pain Points */}
                                    {avatarData.pain_points && (
                                      <AccordionItem value="pain-points" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                            <span className="font-semibold text-foreground text-sm">Pain Points</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="space-y-2">
                                            {avatarData.pain_points.slice(0, 3).map((painPoint: any, index: number) => (
                                              <div key={index} className="bg-destructive/5 border border-destructive/20 p-2 rounded-lg">
                                                <h6 className="font-medium text-foreground text-sm mb-1">{painPoint.title}</h6>
                                                <ul className="space-y-0.5">
                                                  {painPoint.bullets?.slice(0, 2).map((bullet: string, bulletIndex: number) => (
                                                    <li key={bulletIndex} className="text-sm text-muted-foreground flex items-start gap-1">
                                                      <span className="text-destructive mt-0.5">•</span>
                                                      <span className="break-words">{bullet}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}

                                    {/* Goals */}
                                    {avatarData.goals && (
                                      <AccordionItem value="goals" className="border-none">
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                          <div className="flex items-center gap-2">
                                            <Star className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-foreground text-sm">Goals</span>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                          <div className="grid grid-cols-1 gap-2">
                                            <div>
                                              <h6 className="font-medium text-foreground text-sm mb-1">Short Term</h6>
                                              <ul className="space-y-0.5">
                                                {avatarData.goals.short_term?.slice(0, 2).map((goal: string, index: number) => (
                                                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                                    <span className="text-primary mt-0.5">✓</span>
                                                    <span className="break-words">{goal}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                            <div>
                                              <h6 className="font-medium text-foreground text-sm mb-1">Long Term</h6>
                                              <ul className="space-y-0.5">
                                                {avatarData.goals.long_term?.slice(0, 2).map((goal: string, index: number) => (
                                                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                                    <span className="text-primary mt-0.5">✓</span>
                                                    <span className="break-words">{goal}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    )}
                                  </Accordion>
                                )
                              } catch (error) {
                                return (
                                  <div className="bg-muted rounded-lg p-4">
                                    <pre className="text-sm whitespace-pre-wrap text-foreground">
                                      {fullResult.results.avatar_sheet}
                                    </pre>
                                  </div>
                                )
                              }
                            })()}
                          </div>
                        </div>
                      )}
                      {fullResult?.results?.marketing_angles && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold mb-4">Marketing Angles</h4>
                          <div className="grid grid-cols-1 gap-3">
                            {fullResult.results.marketing_angles.map((angle, index) => {
                              // Handle both old format (string) and new format (object with angle and title)
                              const angleTitle = typeof angle === 'object' ? angle.title : null;
                              const angleDescription = typeof angle === 'object' ? angle.angle : angle;

                              return (
                                <div key={index} className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20 rounded-lg p-3 border border-cyan-200/50 dark:border-cyan-800/50 hover:shadow-md transition-shadow">
                                  <div className="flex items-start gap-2">
                                    <div className="bg-primary/10 rounded-full p-1.5 flex-shrink-0">
                                      <Target className="h-3 w-3 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                      {angleTitle && (
                                        <h5 className="text-sm font-bold text-foreground mb-1">{angleTitle}</h5>
                                      )}
                                      <p className="text-sm text-foreground font-medium leading-relaxed break-words">{angleDescription}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Offer Brief */}
      {fullResult?.results?.offer_brief && (
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="offer-brief">
              <Card className="bg-card/80 border-border/50">
                <AccordionTrigger className="p-8 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Offer Brief</h2>
                        <p className="text-sm text-muted-foreground">Key elements of your marketing strategy</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                    {(() => {
                      try {
                        // Parse offer_brief - it might be a string or already an object
                        const offerBrief = typeof fullResult.results.offer_brief === 'string'
                          ? JSON.parse(fullResult.results.offer_brief)
                          : fullResult.results.offer_brief;

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {offerBrief.potential_product_names && offerBrief.potential_product_names.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Potential Product Names
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {offerBrief.potential_product_names.map((name: string, idx: number) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.level_of_consciousness && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-accent" />
                                    Level of Consciousness
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">{offerBrief.level_of_consciousness}</p>
                                </div>
                              )}

                              {offerBrief.level_of_awareness && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-primary" />
                                    Level of Awareness
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">{offerBrief.level_of_awareness.replace(/_/g, ' ')}</p>
                                </div>
                              )}

                              {offerBrief.stage_of_sophistication && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-accent" />
                                    Stage of Sophistication
                                  </h4>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {offerBrief.stage_of_sophistication.level?.replace(/_/g, ' ') || 'N/A'}
                                  </p>
                                  {offerBrief.stage_of_sophistication.rationale && (
                                    <p className="text-xs text-muted-foreground mt-1">{offerBrief.stage_of_sophistication.rationale}</p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-4">
                              {offerBrief.big_idea && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Big Idea</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.big_idea}</p>
                                </div>
                              )}

                              {offerBrief.metaphors && offerBrief.metaphors.length > 0 && (
                                <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Metaphors</h4>
                                  <div className="space-y-1">
                                    {offerBrief.metaphors.map((metaphor: string, idx: number) => (
                                      <p key={idx} className="text-sm text-muted-foreground">"{metaphor}"</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(offerBrief.potential_ump || offerBrief.potential_ums) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {offerBrief.potential_ump && offerBrief.potential_ump.length > 0 && (
                                    <div className="bg-muted/50 p-4 rounded-lg">
                                      <h4 className="font-medium text-foreground mb-2">Unique Mechanism (Problem)</h4>
                                      <ul className="space-y-1">
                                        {offerBrief.potential_ump.map((ump: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-destructive mt-0.5">•</span>
                                            <span>{ump}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {offerBrief.potential_ums && offerBrief.potential_ums.length > 0 && (
                                    <div className="bg-muted/50 p-4 rounded-lg">
                                      <h4 className="font-medium text-foreground mb-2">Unique Mechanism (Solution)</h4>
                                      <ul className="space-y-1">
                                        {offerBrief.potential_ums.map((ums: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-primary mt-0.5">•</span>
                                            <span>{ums}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              {offerBrief.guru && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Guru / Discovery Story</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.guru}</p>
                                </div>
                              )}

                              {offerBrief.discovery_story && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Discovery Story</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.discovery_story}</p>
                                </div>
                              )}

                              {offerBrief.headline_ideas && offerBrief.headline_ideas.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Potential Headline/Subheadline Ideas</h4>
                                  <div className="space-y-2">
                                    {offerBrief.headline_ideas.map((headline: any, idx: number) => (
                                      <div key={idx} className="text-sm text-muted-foreground">
                                        {headline.headline && (
                                          <p className="mb-1"><strong>H1:</strong> "{headline.headline}"</p>
                                        )}
                                        {headline.subheadline && (
                                          <p><strong>H2:</strong> "{headline.subheadline}"</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.objections && offerBrief.objections.length > 0 && (
                                <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Key Objections</h4>
                                  <ul className="space-y-1">
                                    {offerBrief.objections.map((objection: string, idx: number) => (
                                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                        <span className="text-destructive">•</span>
                                        <span>{objection}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {offerBrief.belief_chains && offerBrief.belief_chains.length > 0 && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Belief Chains</h4>
                                  <div className="space-y-3">
                                    {offerBrief.belief_chains.map((chain: any, idx: number) => (
                                      <div key={idx} className="bg-background/50 p-3 rounded border border-primary/10">
                                        <p className="text-sm font-medium text-foreground mb-2">{chain.outcome}</p>
                                        <ul className="space-y-1">
                                          {chain.steps?.map((step: string, stepIdx: number) => (
                                            <li key={stepIdx} className="text-xs text-muted-foreground flex items-start gap-2">
                                              <span className="text-primary mt-0.5">✓</span>
                                              <span>{step}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.funnel_architecture && offerBrief.funnel_architecture.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Funnel Architecture</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.funnel_architecture.join(' → ')}</p>
                                </div>
                              )}

                              {offerBrief.potential_domains && offerBrief.potential_domains.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Potential Domains</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {offerBrief.potential_domains.map((domain: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {domain}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.product && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Product Information</h4>
                                  {offerBrief.product.name && (
                                    <p className="text-sm text-muted-foreground mb-1"><strong>Name:</strong> {offerBrief.product.name}</p>
                                  )}
                                  {offerBrief.product.description && (
                                    <p className="text-sm text-muted-foreground mb-1"><strong>Description:</strong> {offerBrief.product.description}</p>
                                  )}
                                  {offerBrief.product.details && (
                                    <p className="text-sm text-muted-foreground"><strong>Details:</strong> {offerBrief.product.details}</p>
                                  )}
                                </div>
                              )}

                              {offerBrief.examples_swipes && offerBrief.examples_swipes.length > 0 && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Example Swipes</h4>
                                  <div className="space-y-2">
                                    {offerBrief.examples_swipes.map((swipe: any, idx: number) => (
                                      <div key={idx} className="text-sm text-muted-foreground">
                                        <p className="font-medium text-foreground">{swipe.title}</p>
                                        {swipe.url && (
                                          <a href={swipe.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                            {swipe.url}
                                          </a>
                                        )}
                                        {swipe.notes && (
                                          <p className="text-xs mt-1">{swipe.notes}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {offerBrief.other_notes && (
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h4 className="font-medium text-foreground mb-2">Other Notes</h4>
                                  <p className="text-sm text-muted-foreground">{offerBrief.other_notes}</p>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      } catch (error) {
                        // Fallback if parsing fails
                        return (
                          <div className="bg-muted rounded-lg p-4">
                            <pre className="text-sm whitespace-pre-wrap text-foreground">
                              {typeof fullResult.results.offer_brief === 'string'
                                ? fullResult.results.offer_brief
                                : JSON.stringify(fullResult.results.offer_brief, null, 2)}
                            </pre>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Angle Selection & Swipe File Generation */}
      {/* Always show if we have marketing_angles */}
      {fullResult?.results?.marketing_angles &&
        fullResult.results.marketing_angles.length > 0 && (
          <div className="mb-12">
            <Accordion type="single" collapsible>
              <AccordionItem value="marketing-angle-selection">
                <Card className="bg-card/80 border-border/50">
                  <AccordionTrigger className="p-8 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                          <Target className="w-5 h-5 text-accent-foreground" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">Select Marketing Angle</h2>
                          <p className="text-sm text-muted-foreground">Choose an angle to generate swipe files</p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="px-8 pb-8 space-y-3 border-t border-border/50 pt-6">
                      {fullResult.results.marketing_angles.map((angle, index) => {
                        // Handle both old format (string) and new format (object with title and angle)
                        const angleTitle = typeof angle === 'object' ? angle.title : null;
                        const angleDescription = typeof angle === 'object' ? angle.angle : angle;
                        // For select_angle, use the format: "Title: Description" or just the string
                        const angleString = typeof angle === 'object' ? `${angle.title}: ${angle.angle}` : angle;
                        const isGenerated = generatedAngles.has(angleString);
                        const isGenerating = generatingAngles.has(angleString);
                        const status = angleStatuses.get(angleString);

                        return (
                          <Card
                            key={index}
                            className={`transition-all hover:shadow-md ${selectedAngle === angleString && !isGenerated ? 'border-primary shadow-sm bg-primary/5' : 'border-border/50'
                              } ${isGenerated ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : ''}`}
                            onClick={() => !isGenerated && !isGenerating && setSelectedAngle(angleString)}
                          >
                            <div className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  {isGenerated ? (
                                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                      <CheckCircle2 className="w-3 h-3 text-white" />
                                    </div>
                                  ) : isGenerating ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                                  ) : (
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedAngle === angleString ? 'border-primary bg-primary' : 'border-muted-foreground'
                                      }`}>
                                      {selectedAngle === angleString && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    {angleTitle && (
                                      <h3 className="text-lg font-bold text-foreground mb-1">{angleTitle}</h3>
                                    )}
                                    <p className="text-sm text-muted-foreground">{angleDescription}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isGenerated && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                      Generated
                                    </Badge>
                                  )}
                                  {isGenerating && status && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                      {status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}

                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={async () => {
                            if (!selectedAngle || !originalJobId || generatedAngles.has(selectedAngle) || generatingAngles.has(selectedAngle)) return;

                            // Add to generating map
                            setIsGeneratingSwipeFiles(true);
                            try {
                              const response = await fetch('/api/swipe-files/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  original_job_id: originalJobId,
                                  select_angle: selectedAngle
                                })
                              });

                              if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                throw new Error(errorData.error || 'Failed to generate swipe files');
                              }

                              const data = await response.json();

                              // Track this angle as generating
                              setGeneratingAngles(prev => {
                                const newMap = new Map(prev)
                                newMap.set(selectedAngle, data.jobId)
                                return newMap
                              })
                              setAngleStatuses(prev => {
                                const newMap = new Map(prev)
                                newMap.set(selectedAngle, 'SUBMITTED')
                                return newMap
                              })

                              // Start polling for this specific angle
                              pollSwipeFileStatus(data.jobId, selectedAngle);

                              // Clear selection
                              setSelectedAngle(null);
                            } catch (error) {
                              console.error('Error generating swipe files:', error);
                              // Remove from generating map on error
                              setGeneratingAngles(prev => {
                                const newMap = new Map(prev)
                                newMap.delete(selectedAngle)
                                return newMap
                              })
                              alert(error instanceof Error ? error.message : 'Failed to generate swipe files');
                            } finally {
                              setIsGeneratingSwipeFiles(false);
                            }
                          }}
                          disabled={!selectedAngle || isGeneratingSwipeFiles || generatedAngles.has(selectedAngle || '') || generatingAngles.has(selectedAngle || '')}
                          className="px-8"
                        >
                          {isGeneratingSwipeFiles ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            'Generate Swipe Files'
                          )}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>
          </div>
        )}

      {/* HTML Templates */}
      <div className="mb-12">
        <Accordion type="single" collapsible>
          <AccordionItem value="html-templates">
            <Card className="bg-card/80 border-border/50">
              <AccordionTrigger className="p-8 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">HTML Templates</h2>
                      <p className="text-sm text-muted-foreground">Generated marketing templates and angles</p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="px-8 pb-8 border-t border-border/50 pt-6">
                  {templates.length === 0 && generatingAngles.size === 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        No templates generated yet. Select a marketing angle above to generate templates.
                      </p>
                      {fullResult?.results?.marketing_angles && fullResult.results.marketing_angles.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-6">
                          <h3 className="text-lg font-semibold mb-4 text-foreground">Available Marketing Angles</h3>
                          <div className="space-y-3">
                            {fullResult.results.marketing_angles.map((angle, index) => {
                              const angleTitle = typeof angle === 'object' ? angle.title : null;
                              const angleDescription = typeof angle === 'object' ? angle.angle : angle;
                              const angleString = typeof angle === 'object' ? `${angle.title}: ${angle.angle}` : angle;
                              const isGenerated = generatedAngles.has(angleString);

                              return (
                                <div key={index} className="border border-border rounded-lg p-4">
                                  {angleTitle && (
                                    <h4 className="font-semibold text-foreground mb-2">{angleTitle}</h4>
                                  )}
                                  <p className="text-sm text-muted-foreground">{angleDescription}</p>
                                  {isGenerated && (
                                    <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                      Generated
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {generatingAngles.size > 0 && (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">
                            Generating templates for {generatingAngles.size} angle{generatingAngles.size > 1 ? 's' : ''}...
                          </p>
                        </div>
                      )}
                      {templates.length > 0 && (
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">HTML Templates</h3>
                            <p className="text-sm text-muted-foreground">
                              {templates.length} template{templates.length !== 1 ? 's' : ''} generated
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Existing templates */}
                        {templates.map((template, index) => (
                          <Card key={`template-${index}`} className="group hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-foreground mb-1 break-words">
                                    {template.angle || template.name}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {template.type}
                                  </p>
                                  {template.timestamp && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(template.timestamp).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>

                                <div className="h-32 bg-white rounded-lg overflow-hidden border border-gray-200 relative">
                                  <div className="absolute inset-0 overflow-hidden">
                                    <iframe
                                      srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${(() => {
                                          const raw = template.html;
                                          const hasRealImages = /res\.cloudinary\.com|images\.unsplash\.com|\.(png|jpe?g|webp|gif)(\?|\b)/i.test(raw);
                                          if (!hasRealImages) return raw;
                                          const noOnError = raw
                                            .replace(/\s+onerror="[^"]*"/gi, '')
                                            .replace(/\s+onerror='[^']*'/gi, '');
                                          const stripFallbackScripts = noOnError.replace(/<script[\s\S]*?<\/script>/gi, (block) => {
                                            const lower = block.toLowerCase();
                                            return (lower.includes('handlebrokenimages') || lower.includes('createfallbackimage') || lower.includes('placehold.co'))
                                              ? ''
                                              : block;
                                          });
                                          return stripFallbackScripts;
                                        })()}
  <script>
    (function(){
      function isTrusted(src){ return /res\\.cloudinary\\.com|images\\.unsplash\\.com|(\\.png|\\.jpe?g|\\.webp|\\.gif)(\\?|$)/i.test(src || ''); }
      function ph(img){ var alt=(img.getAttribute('alt')||'Image'); var text=encodeURIComponent(alt.replace(/[^a-zA-Z0-9\s]/g,'').substring(0,20)||'Image'); return 'https://placehold.co/600x400?text='+text; }
      function apply(img){
        if (isTrusted(img.src)) { img.onerror = function(){ this.onerror=null; if (!isTrusted(this.src)) this.src = ph(this); }; return; }
        if (!img.complete || img.naturalWidth === 0) { img.src = ph(img); }
        img.onerror = function(){ this.onerror=null; if (!isTrusted(this.src)) this.src = ph(this); };
      }
      function run(){ document.querySelectorAll('img').forEach(apply); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
      setTimeout(run, 800);
    })();
  </script>
</body>
</html>`}
                                      className="w-full h-full"
                                      style={{
                                        border: 'none',
                                        transform: 'scale(0.3)',
                                        transformOrigin: 'top left',
                                        width: '333.33%',
                                        height: '333.33%',
                                        pointerEvents: 'none'
                                      }}
                                      sandbox="allow-scripts"
                                      title={`Preview of ${template.angle || template.name}`}
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/20 pointer-events-none"></div>
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const blob = new Blob([template.html], { type: 'text/html' })
                                      const url = URL.createObjectURL(blob)
                                      const a = document.createElement('a')
                                      a.href = url
                                      a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
                                      document.body.appendChild(a)
                                      a.click()
                                      document.body.removeChild(a)
                                      URL.revokeObjectURL(url)
                                    }}
                                    className="flex-1"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button className="flex-1" size="sm">
                                        <Eye className="h-4 w-4 mr-2" />
                                        Preview
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="!max-w-[98vw] !max-h-[98vh] !w-[98vw] !h-[98vh] overflow-hidden p-2">
                                      <DialogHeader className="pb-2">
                                        <DialogTitle className="text-xl font-bold">
                                          {template.angle || template.name}
                                        </DialogTitle>
                                        <DialogDescription>
                                          {template.type} • {template.timestamp ? new Date(template.timestamp).toLocaleString() : 'Generated'}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="h-[calc(98vh-120px)] border rounded-lg bg-background overflow-auto">
                                        <iframe
                                          srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${(() => {
                                              const raw = template.html;
                                              const hasRealImages = /res\.cloudinary\.com|images\.unsplash\.com|\.(png|jpe?g|webp|gif)(\?|\b)/i.test(raw);
                                              if (!hasRealImages) return raw;
                                              const noOnError = raw
                                                .replace(/\s+onerror="[^"]*"/gi, '')
                                                .replace(/\s+onerror='[^']*'/gi, '');
                                              const stripFallbackScripts = noOnError.replace(/<script[\s\S]*?<\/script>/gi, (block) => {
                                                const lower = block.toLowerCase();
                                                return (lower.includes('handlebrokenimages') || lower.includes('createfallbackimage') || lower.includes('placehold.co'))
                                                  ? ''
                                                  : block;
                                              });
                                              return stripFallbackScripts;
                                            })()}
  <script>
    (function(){
      function isTrusted(src){ return /res\\.cloudinary\\.com|images\\.unsplash\\.com|(\\.png|\\.jpe?g|\\.webp|\\.gif)(\\?|$)/i.test(src || ''); }
      function ph(img){ var alt=(img.getAttribute('alt')||'Image'); var text=encodeURIComponent(alt.replace(/[^a-zA-Z0-9\s]/g,'').substring(0,20)||'Image'); return 'https://placehold.co/600x400?text='+text; }
      function apply(img){
        if (isTrusted(img.src)) { img.onerror = function(){ this.onerror=null; if (!isTrusted(this.src)) this.src = ph(this); }; return; }
        if (!img.complete || img.naturalWidth === 0) { img.src = ph(img); }
        img.onerror = function(){ this.onerror=null; if (!isTrusted(this.src)) this.src = ph(this); };
      }
      function run(){ document.querySelectorAll('img').forEach(apply); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
      setTimeout(run, 800);
    })();
  </script>
</body>
</html>`}
                                          className="w-full h-full"
                                          sandbox="allow-scripts"
                                          style={{
                                            border: 'none',
                                            width: '100%',
                                            height: '100%'
                                          }}
                                        />
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {/* Skeleton loaders for generating angles */}
                        {Array.from({ length: generatingAngles.size }).map((_, i) => (
                          <div key={`skeleton-${i}`} className="border border-border rounded-lg p-6 bg-card">
                            <div className="h-6 w-3/4 bg-muted animate-pulse rounded-md mb-3" />
                            <div className="h-4 w-full bg-muted animate-pulse rounded-md mb-2" />
                            <div className="h-4 w-2/3 bg-muted animate-pulse rounded-md mb-4" />
                            <div className="h-48 w-full bg-muted animate-pulse rounded-md" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Template Preview Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="w-[95vw] max-h-[95vh] overflow-hidden !max-w-none sm:!max-w-[95vw]">
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
    .container { max-width: 95vw; margin: 0 auto; }
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

    </div>
  )
}
