"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MarkdownContent } from "@/components/results/markdown-content"
import { TemplateGrid } from "@/components/results/template-grid"
import { FileText, BarChart3, Code, BookOpen, User, Target, Calendar, Clock, Users, MapPin, DollarSign, Briefcase, Sparkles, AlertTriangle, Star } from "lucide-react"
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
    }
  }
  jobTitle: string
  advertorialType?: string
  templateId?: string
}

export function DeepCopyResults({ result, jobTitle, advertorialType, templateId }: DeepCopyResultsProps) {
  const [templates, setTemplates] = useState<Array<{ name: string, type: string, html: string, angle?: string, timestamp?: string }>>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

  const fullResult = result.metadata?.full_result

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
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setTemplatesLoading(false)
      }
    }

    // Always try to load templates, whether we have processed content or raw results
    loadTemplates()
  }, [result, jobTitle])

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
        <Accordion type="single" collapsible>
          <AccordionItem value="project-overview">
            <Card className="bg-card/80 border-border/50">
              <AccordionTrigger className="p-8 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">Project Overview</h2>
                      <p className="text-sm text-muted-foreground">Job details and metadata</p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="px-8 pb-8 space-y-6 border-t border-border/50 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      <p className="text-sm text-muted-foreground">L00005 (DeepCopy)</p>
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
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Page Analysis */}
      {fullResult?.results?.research_page_analysis && (
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="page-analysis">
              <Card className="bg-card/80 border-border/50">
                <AccordionTrigger className="p-8 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Page Analysis</h2>
                        <p className="text-sm text-muted-foreground">Detailed analysis of the target page</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 border-t border-border/50 pt-6">
                    <MarkdownContent content={fullResult.results.research_page_analysis} />
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )}


      {/* Research Output */}
      {fullResult?.results?.deep_research_output && (
        <div className="mb-12">
          <Accordion type="single" collapsible>
            <AccordionItem value="research-output">
              <Card className="bg-card/80 border-border/50">
                <AccordionTrigger className="p-8 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-accent rounded-lg flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Research Output</h2>
                        <p className="text-sm text-muted-foreground">Comprehensive research findings and recommendations</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="px-8 pb-8 border-t border-border/50 pt-6">
                    <MarkdownContent content={fullResult.results.deep_research_output} />
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      )}

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
                                        <Users className="h-4 w-4 text-primary" />
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
                                          <Briefcase className="h-4 w-4 text-accent" />
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
                                          <Sparkles className="h-4 w-4 text-accent" />
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
                                          <AlertTriangle className="h-4 w-4 text-destructive" />
                                          Pain Points
                                        </h5>
                                        <div className="space-y-2">
                                          {avatarData.pain_points.slice(0, 3).map((painPoint: any, index: number) => (
                                            <div key={index} className="bg-destructive/5 border border-destructive/20 p-2 rounded-lg">
                                              <h6 className="font-medium text-foreground text-sm mb-1">{painPoint.title}</h6>
                                              <ul className="space-y-0.5">
                                                {painPoint.bullets?.slice(0, 2).map((bullet: string, bulletIndex: number) => (
                                                  <li key={bulletIndex} className="text-sm text-muted-foreground flex items-start gap-1">
                                                    <span className="text-destructive mt-0.5">•</span>
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
                                          <Star className="h-4 w-4 text-primary" />
                                          Goals
                                        </h5>
                                        <div className="grid grid-cols-1 gap-2">
                                          <div>
                                            <h6 className="font-medium text-foreground text-sm mb-1">Short Term</h6>
                                            <ul className="space-y-0.5">
                                              {avatarData.goals.short_term?.slice(0, 2).map((goal: string, index: number) => (
                                                <li key={index} className="text-sm text-muted-foreground flex items-start gap-1">
                                                  <span className="text-primary mt-0.5">✓</span>
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
                                                  <span className="text-primary mt-0.5">✓</span>
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
                  <TemplateGrid templates={templates} isLoading={templatesLoading} />
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>

    </div>
  )
}
