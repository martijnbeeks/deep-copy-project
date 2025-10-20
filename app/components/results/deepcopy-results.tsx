"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { MarkdownContent } from "@/components/results/markdown-content"
import { TemplateGrid } from "@/components/results/template-grid"
import { Copy, Download, Eye, Maximize2, FileText, BarChart3, Code, BookOpen, User, Target, Calendar, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
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
    }
  }
  jobTitle: string
  advertorialType?: string
  templateId?: string
}

export function DeepCopyResults({ result, jobTitle, advertorialType, templateId }: DeepCopyResultsProps) {
  const [copied, setCopied] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState(0)
  const [viewMode, setViewMode] = useState<{ [key: number]: 'rendered' | 'source' }>({})
  const [templates, setTemplates] = useState<Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }>>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>('project-overview')
  const { toast } = useToast()

  const fullResult = result.metadata?.full_result

  // Helper function to handle section toggling
  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
  }

  // Debug logging
  console.log('🔍 DeepCopyResults - has carousel:', result.html_content?.includes('carousel-container') || false);
  console.log('🔍 DeepCopyResults - advertorialType:', advertorialType);

  const extractHTMLTemplates = async () => {
    const templates: Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }> = []

    try {
      // Check if we have full result data with swipe_results
      if (fullResult && fullResult.results?.swipe_results) {
        console.log('✅ Found swipe_results, processing with injectable templates...')

        const swipeResults = fullResult.results.swipe_results
        console.log('🔍 Found swipe results:', swipeResults.length)

        // Get injectable template for this specific template ID
        const templateType = advertorialType === 'listicle' ? 'listicle' : 'advertorial'

        try {
          let injectableTemplate = null

          if (templateId) {
            // Try to fetch the specific injectable template with the same ID
            console.log(`🔍 Looking for injectable template with ID: ${templateId}`)
            const specificResponse = await fetch(`/api/admin/injectable-templates?id=${templateId}`)
            const specificTemplates = await specificResponse.json()

            if (specificTemplates.length > 0) {
              injectableTemplate = specificTemplates[0]
              console.log(`✅ Found specific injectable template: ${injectableTemplate.name} (ID: ${templateId})`)
            }
          }

          // Fallback: fetch by type if specific template not found
          if (!injectableTemplate) {
            console.log(`⚠️ Specific template not found, fetching by type: ${templateType}`)
            const response = await fetch(`/api/admin/injectable-templates?type=${templateType}`)
            const injectableTemplates = await response.json()

            if (injectableTemplates.length > 0) {
              injectableTemplate = injectableTemplates[0]
              console.log(`✅ Using fallback injectable template: ${injectableTemplate.name}`)
            }
          }

          if (injectableTemplate) {
            // Process each swipe result
            swipeResults.forEach((swipeResult, index) => {
              try {
                // Extract content from the individual swipe result
                const contentData = extractContentFromSwipeResult(swipeResult, templateType)

                // Inject content into the injectable template
                const renderedHtml = injectContentIntoTemplate(injectableTemplate, contentData)

                templates.push({
                  name: `Angle ${index + 1}`,
                  type: 'Marketing Angle',
                  html: renderedHtml,
                  angle: swipeResult.angle,
                  timestamp: result.metadata?.generated_at || new Date().toISOString()
                })

                console.log(`✅ Processed angle ${index + 1}: ${swipeResult.angle}`)
              } catch (error) {
                console.error(`❌ Error processing angle ${index + 1}:`, error)
              }
            })
          } else {
            console.log('⚠️ No injectable templates found, falling back to carousel HTML')
            // Fallback to old carousel method
            return await extractFromCarousel()
          }
        } catch (error) {
          console.error('❌ Error fetching injectable templates:', error)
          // Fallback to old carousel method
          return await extractFromCarousel()
        }

        console.log('🔍 Final templates count:', templates.length)
        return templates
      }

      // Fallback: Check if we have processed HTML content (carousel) from the old system
      if (result.html_content && result.html_content.includes('carousel-container')) {
        console.log('⚠️ No swipe_results found, falling back to carousel HTML extraction')
        return await extractFromCarousel()
      }

      // If no data available, show empty state
      console.log('⚠️ No data found, showing empty state')
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

      console.log('🔍 Found angles:', angles)

      // Try multiple approaches to extract template content
      let templateContent: string[] = []

      // Approach 1: Look for iframes with srcdoc
      const iframeMatches = result.html_content.match(/<iframe[^>]*srcdoc="([^"]*)"[^>]*><\/iframe>/g)
      console.log('🔍 Found iframes:', iframeMatches ? iframeMatches.length : 0)

      if (iframeMatches && iframeMatches.length > 0) {
        console.log('✅ Processing iframes directly...')
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
        console.log('⚠️ No iframes found, trying template-slide extraction...')
        const slideMatches = result.html_content.match(/<div class="template-slide[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)
        console.log('🔍 Found slides:', slideMatches ? slideMatches.length : 0)

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
        console.log('⚠️ No slides found, trying generic div extraction...')
        const divMatches = result.html_content.match(/<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/g)
        console.log('🔍 Found template divs:', divMatches ? divMatches.length : 0)

        if (divMatches && divMatches.length > 0) {
          templateContent = divMatches.map(divHtml => {
            const contentMatch = divHtml.match(/<div[^>]*class="[^"]*template[^"]*"[^>]*>([\s\S]*?)<\/div>/)
            return contentMatch ? contentMatch[1] : divHtml
          })
        }
      }

      // Create templates from extracted content
      if (templateContent.length > 0) {
        console.log(`✅ Found ${templateContent.length} template contents`)
        angles.forEach((angle, index) => {
          const content = templateContent[index] || templateContent[0] || result.html_content

          templates.push({
            name: `Angle ${index + 1}`,
            type: 'Marketing Angle',
            html: content,
            angle: angle,
            timestamp: result.metadata?.generated_at || new Date().toISOString()
          })

          console.log(`✅ Created template ${index + 1}: ${angle.substring(0, 50)}...`)
        })
      } else {
        console.log('⚠️ No template content found, using full carousel HTML')
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

      console.log('🔍 Final templates count:', templates.length)
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
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setTemplatesLoading(false)
      }
    }

    // Always try to load templates, whether we have processed content or raw results
    loadTemplates()
  }, [result, jobTitle])

  useEffect(() => {
    const initialViewMode: { [key: number]: 'rendered' | 'source' } = {}
    templates.forEach((_, index) => {
      if (viewMode[index] === undefined) {
        initialViewMode[index] = 'rendered'
      }
    })
    if (Object.keys(initialViewMode).length > 0) {
      setViewMode(prev => ({ ...prev, ...initialViewMode }))
    }
  }, [templates, viewMode])

  const handleCopyHTML = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "HTML copied",
        description: "The HTML content has been copied to your clipboard.",
      })
    } catch (err) {
      console.error('Failed to copy HTML:', err)
      toast({
        title: "Copy failed",
        description: "Failed to copy HTML to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-8 border border-border/50">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{jobTitle}</h1>
            <p className="text-muted-foreground">
              Generated on {result.metadata?.generated_at ? new Date(result.metadata.generated_at).toLocaleString() : 'Unknown date'}
            </p>
            {fullResult?.project_name && (
              <Badge variant="outline" className="mt-2">
                Project: {fullResult.project_name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Project Overview */}
      <CollapsibleSection
        title="Project Overview"
        description="Job details and metadata"
        icon={<Calendar className="h-5 w-5" />}
        isExpanded={expandedSection === 'project-overview'}
        onToggle={() => toggleSection('project-overview')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Generated At
            </div>
            <p className="font-medium text-foreground">
              {result.metadata?.generated_at ? new Date(result.metadata.generated_at).toLocaleString() : 'Unknown'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              Template Used
            </div>
            <p className="font-medium text-foreground">L00005 (DeepCopy)</p>
          </div>
          {fullResult?.project_name && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Project Name
              </div>
              <p className="font-medium text-foreground">{fullResult.project_name}</p>
            </div>
          )}
          {result.metadata?.deepcopy_job_id && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Code className="h-4 w-4" />
                DeepCopy Job ID
              </div>
              <p className="font-mono text-sm text-foreground">{result.metadata.deepcopy_job_id}</p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* HTML Templates */}
      <CollapsibleSection
        title="HTML Templates"
        description="Generated marketing templates and angles"
        icon={<FileText className="h-5 w-5" />}
        isExpanded={expandedSection === 'html-templates'}
        onToggle={() => toggleSection('html-templates')}
      >
        <TemplateGrid templates={templates} isLoading={templatesLoading} />
      </CollapsibleSection>

      {/* Page Analysis */}
      {fullResult?.results?.research_page_analysis && (
        <CollapsibleSection
          title="Page Analysis"
          description="Detailed analysis of the target page"
          icon={<BarChart3 className="h-5 w-5" />}
          isExpanded={expandedSection === 'page-analysis'}
          onToggle={() => toggleSection('page-analysis')}
        >
          <MarkdownContent content={fullResult.results.research_page_analysis} />
        </CollapsibleSection>
      )}

      {/* Document Analysis */}
      {(fullResult?.results?.doc1_analysis || fullResult?.results?.doc2_analysis) && (
        <CollapsibleSection
          title="Document Analysis"
          description="Market research insights and findings"
          icon={<BookOpen className="h-5 w-5" />}
          isExpanded={expandedSection === 'document-analysis'}
          onToggle={() => toggleSection('document-analysis')}
        >
          <div className="space-y-6">
            {fullResult?.results?.doc1_analysis && (
              <div>
                <h4 className="text-lg font-semibold mb-3">Research Document 1</h4>
                <MarkdownContent content={fullResult.results.doc1_analysis} />
              </div>
            )}
            {fullResult?.results?.doc2_analysis && (
              <div>
                <h4 className="text-lg font-semibold mb-3">Research Document 2</h4>
                <MarkdownContent content={fullResult.results.doc2_analysis} />
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Research Output */}
      {fullResult?.results?.deep_research_output && (
        <CollapsibleSection
          title="Research Output"
          description="Comprehensive research findings and recommendations"
          icon={<BookOpen className="h-5 w-5" />}
          isExpanded={expandedSection === 'research-output'}
          onToggle={() => toggleSection('research-output')}
        >
          <MarkdownContent content={fullResult.results.deep_research_output} />
        </CollapsibleSection>
      )}

      {/* Avatar & Marketing */}
      {(fullResult?.results?.avatar_sheet || fullResult?.results?.marketing_angles) && (
        <CollapsibleSection
          title="Avatar & Marketing"
          description="Customer avatar and marketing angles"
          icon={<User className="h-5 w-5" />}
          isExpanded={expandedSection === 'avatar-marketing'}
          onToggle={() => toggleSection('avatar-marketing')}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {fullResult?.results?.avatar_sheet && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold mb-4">Customer Avatar</h4>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                  {(() => {
                    try {
                      const avatarData = JSON.parse(fullResult.results.avatar_sheet)
                      return (
                        <div className="space-y-4">
                          {/* Demographics */}
                          <div>
                            <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                              <User className="h-4 w-4" />
                              Demographics
                            </h5>
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
                            <div className="mt-2">
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

                          {/* Professional Background & Identities */}
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                                <Target className="h-4 w-4" />
                                Professional Background
                              </h5>
                              <div className="flex flex-wrap gap-1">
                                {avatarData.demographics?.professional_backgrounds?.map((bg: string, index: number) => (
                                  <Badge key={index} variant="outline" className="text-sm px-2 py-0.5">
                                    {bg}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                                <User className="h-4 w-4" />
                                Identities
                              </h5>
                              <div className="flex flex-wrap gap-1">
                                {avatarData.demographics?.typical_identities?.map((identity: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="text-sm px-2 py-0.5">
                                    {identity}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Pain Points - Compact */}
                          {avatarData.pain_points && (
                            <div>
                              <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                                <Target className="h-4 w-4" />
                                Pain Points
                              </h5>
                              <div className="space-y-2">
                                {avatarData.pain_points.slice(0, 3).map((painPoint: any, index: number) => (
                                  <div key={index} className="bg-background/50 rounded p-2 border border-border/50">
                                    <h6 className="font-medium text-foreground text-sm mb-1">{painPoint.title}</h6>
                                    <ul className="space-y-0.5">
                                      {painPoint.bullets?.slice(0, 2).map((bullet: string, bulletIndex: number) => (
                                        <li key={bulletIndex} className="text-sm text-muted-foreground flex items-start gap-1">
                                          <span className="text-primary mt-0.5">•</span>
                                          <span className="line-clamp-2">{bullet}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Goals - Compact */}
                          {avatarData.goals && (
                            <div>
                              <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                                <Target className="h-4 w-4" />
                                Goals
                              </h5>
                              <div className="grid grid-cols-1 gap-2">
                                <div>
                                  <h6 className="font-medium text-foreground text-sm mb-1">Short Term</h6>
                                  <ul className="space-y-0.5">
                                    {avatarData.goals.short_term?.slice(0, 2).map((goal: string, index: number) => (
                                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                        <span className="text-green-500 mt-0.5">•</span>
                                        <span className="line-clamp-2">{goal}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h6 className="font-medium text-foreground text-sm mb-1">Long Term</h6>
                                  <ul className="space-y-0.5">
                                    {avatarData.goals.long_term?.slice(0, 2).map((goal: string, index: number) => (
                                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span className="line-clamp-2">{goal}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
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
                  {fullResult.results.marketing_angles.map((angle, index) => (
                    <div key={index} className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg p-3 border border-purple-200/50 dark:border-purple-800/50 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-2">
                        <div className="bg-primary/10 rounded-full p-1.5 flex-shrink-0">
                          <Target className="h-3 w-3 text-primary" />
                        </div>
                        <p className="text-sm text-foreground font-medium leading-relaxed break-words">{angle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

    </div>
  )
}
