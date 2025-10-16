"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Download, Eye, Maximize2, FileText, BarChart3, Code, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
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
  const [viewMode, setViewMode] = useState<{[key: number]: 'rendered' | 'source'}>({})
  const [templates, setTemplates] = useState<Array<{name: string, type: string, html: string, angle?: string, timestamp?: string}>>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const { toast } = useToast()

  const fullResult = result.metadata?.full_result
  
  // Debug logging
  console.log('🔍 DeepCopyResults - has carousel:', result.html_content?.includes('carousel-container') || false);
  console.log('🔍 DeepCopyResults - advertorialType:', advertorialType);
  
  const extractHTMLTemplates = async () => {
    const templates: Array<{name: string, type: string, html: string, angle?: string, timestamp?: string}> = []
    
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
    const templates: Array<{name: string, type: string, html: string, angle?: string, timestamp?: string}> = []
    
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
    const initialViewMode: {[key: number]: 'rendered' | 'source'} = {}
    templates.forEach((_, index) => {
      if (viewMode[index] === undefined) {
        initialViewMode[index] = 'rendered'
      }
    })
    if (Object.keys(initialViewMode).length > 0) {
      setViewMode(prev => ({...prev, ...initialViewMode}))
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{jobTitle}</CardTitle>
              <CardDescription className="mt-2">
                Generated on {result.metadata?.generated_at ? new Date(result.metadata.generated_at).toLocaleString() : 'Unknown date'}
              </CardDescription>
              {fullResult?.project_name && (
                <Badge variant="outline" className="mt-2">
                  Project: {fullResult.project_name}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            HTML Templates
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Research
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Raw Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          {fullResult?.results?.research_page_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Page Analysis</CardTitle>
                <CardDescription>Detailed analysis of the target page</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {formatAnalysis(fullResult.results.research_page_analysis)}
                </div>
              </CardContent>
            </Card>
          )}

          {fullResult?.results?.doc1_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Document Analysis 1</CardTitle>
                <CardDescription>Market research insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {formatAnalysis(fullResult.results.doc1_analysis)}
                </div>
              </CardContent>
            </Card>
          )}

          {fullResult?.results?.doc2_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Document Analysis 2</CardTitle>
                <CardDescription>Additional research findings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {formatAnalysis(fullResult.results.doc2_analysis)}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          {templatesLoading ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Loading Templates</h3>
                <p className="text-muted-foreground">
                  Generating HTML templates from JSON data...
                </p>
              </CardContent>
            </Card>
          ) : templates.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">HTML Templates ({templates.length})</h3>
                <Badge variant="outline">
                  {templates.length} template{templates.length !== 1 ? 's' : ''} generated
                </Badge>
              </div>

              <div className="relative h-[calc(100vh-150px)]">
                {templates.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/90 hover:bg-primary hover:text-primary-foreground"
                      onClick={() => setActiveTemplate(prev => prev === 0 ? templates.length - 1 : prev - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/90 hover:bg-primary hover:text-primary-foreground"
                      onClick={() => setActiveTemplate(prev => prev === templates.length - 1 ? 0 : prev + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {templates.length > 1 && (
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {templates.map((template, index) => (
                      <Button
                        key={index}
                        variant={activeTemplate === index ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveTemplate(index)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        {template.angle || `Angle ${index + 1}`}
                      </Button>
                    ))}
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold">
                          {templates[activeTemplate]?.angle || templates[activeTemplate]?.name}
                        </CardTitle>
                        <CardDescription>
                          {templates[activeTemplate]?.type} • {templates[activeTemplate]?.timestamp ? new Date(templates[activeTemplate].timestamp).toLocaleString() : 'Generated'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewMode(prev => ({...prev, [activeTemplate]: viewMode[activeTemplate] === 'rendered' ? 'source' : 'rendered'}))}
                        >
                          {viewMode[activeTemplate] === 'rendered' ? (
                            <>
                              <Code className="h-4 w-4 mr-2" />
                              View Source
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              View Rendered
                            </>
                          )}
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="!max-w-[98vw] !max-h-[98vh] !w-[98vw] !h-[98vh] overflow-hidden p-2">
                            <DialogHeader className="pb-2">
                              <DialogTitle className="text-xl font-bold">{templates[activeTemplate]?.angle || templates[activeTemplate]?.name}</DialogTitle>
                              <DialogDescription>
                                {templates[activeTemplate]?.name && templates[activeTemplate]?.angle && `${templates[activeTemplate].name} • `}{templates[activeTemplate]?.type}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="h-[calc(98vh-80px)] border rounded-lg bg-background overflow-auto">
                              <iframe
                                srcDoc={templates[activeTemplate]?.html}
                                className="w-full h-full"
                                sandbox="allow-same-origin allow-scripts"
                                style={{
                                  border: 'none',
                                  width: '100%',
                                  height: '100%'
                                }}
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Maximize2 className="h-4 w-4 mr-2" />
                              View Full Screen
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="!max-w-[100vw] !max-h-[100vh] !w-[100vw] !h-[100vh] overflow-hidden p-0 m-0 rounded-none">
                            <DialogHeader className="pb-2 p-4">
                              <DialogTitle className="text-xl font-bold">{templates[activeTemplate]?.angle || templates[activeTemplate]?.name}</DialogTitle>
                              <DialogDescription>
                                {templates[activeTemplate]?.name && templates[activeTemplate]?.angle && `${templates[activeTemplate].name} • `}{templates[activeTemplate]?.type}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="h-[calc(100vh-120px)] border-0 bg-background overflow-auto">
                              <iframe
                                srcDoc={templates[activeTemplate]?.html}
                                className="w-full h-full"
                                sandbox="allow-same-origin allow-scripts"
                                style={{
                                  border: 'none',
                                  width: '100%',
                                  height: '100%'
                                }}
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCopyHTML(templates[activeTemplate]?.html || '')}
                        >
                          {copied ? 'Copied!' : 'Copy HTML'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(templates[activeTemplate]?.html || '', `${templates[activeTemplate]?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[calc(100vh-300px)] p-0">
                    {viewMode[activeTemplate] === 'source' ? (
                      <div className="bg-muted rounded-lg p-4 h-full overflow-auto">
                        <pre className="text-sm whitespace-pre-wrap text-foreground">
                          {templates[activeTemplate]?.html}
                        </pre>
                      </div>
                    ) : (
                      <div className="border rounded-lg h-full overflow-auto">
                        <iframe
                          srcDoc={templates[activeTemplate]?.html}
                          className="w-full h-full"
                          sandbox="allow-same-origin allow-scripts"
                          style={{
                            border: 'none',
                            width: '100%',
                            height: '100%'
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No HTML Templates</h3>
                <p className="text-muted-foreground">
                  No HTML templates were generated for this job.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="research" className="space-y-6">
          {fullResult?.results?.deep_research_prompt && (
            <Card>
              <CardHeader>
                <CardTitle>Research Prompt</CardTitle>
                <CardDescription>The prompt used for deep research</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-sm whitespace-pre-wrap text-foreground">
                    {fullResult.results.deep_research_prompt}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {fullResult?.results?.deep_research_output && (
            <Card>
              <CardHeader>
                <CardTitle>Research Output</CardTitle>
                <CardDescription>Comprehensive research findings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {formatAnalysis(fullResult.results.deep_research_output)}
                </div>
              </CardContent>
            </Card>
          )}

          {fullResult?.results?.avatar_sheet && (
            <Card>
              <CardHeader>
                <CardTitle>Avatar Sheet</CardTitle>
                <CardDescription>Customer avatar and demographic data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-sm whitespace-pre-wrap text-foreground">
                    {fullResult.results.avatar_sheet}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="raw" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Raw API Response</CardTitle>
              <CardDescription>Complete response from DeepCopy API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 overflow-auto max-h-96">
                <pre className="text-sm whitespace-pre-wrap text-foreground">
                  {JSON.stringify(fullResult, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
