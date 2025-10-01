"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Download, Eye, Maximize2, FileText, BarChart3, Code, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface DeepCopyResult {
  project_name: string
  timestamp_iso: string
  results: {
    research_page_analysis?: string
    doc1_analysis?: string
    doc2_analysis?: string
    deep_research_prompt?: string
    deep_research_output?: string
    avatar_sheet?: string
    html_templates?: string | string[]
    swipe_results?: Array<{
      name?: string
      type?: string
      angle?: string
      html?: string
      content?: string
      timestamp?: string
    }>
  }
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
    }
  }
  jobTitle: string
}

export function DeepCopyResults({ result, jobTitle }: DeepCopyResultsProps) {
  const [copied, setCopied] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState(0)
  const [viewMode, setViewMode] = useState<{[key: number]: 'rendered' | 'source'}>({})
  const { toast } = useToast()

  const fullResult = result.metadata?.full_result
  
  const extractHTMLTemplates = () => {
    const templates: Array<{name: string, type: string, html: string, angle?: string, timestamp?: string}> = []
    
    if (fullResult?.results?.swipe_results && Array.isArray(fullResult.results.swipe_results)) {
      fullResult.results.swipe_results.forEach((swipe: any, index: number) => {
        const angle = swipe.angle || swipe.angle_name || swipe.angle_type || `Angle ${index + 1}`
        
        if (swipe.html) {
          templates.push({
            name: swipe.name || `Swipe ${index + 1}`,
            type: swipe.type || 'Unknown',
            html: swipe.html,
            angle: angle,
            timestamp: swipe.timestamp
          })
        }
        
        if (swipe.content && typeof swipe.content === 'string') {
          if (swipe.content.includes('<html') || swipe.content.includes('<div') || swipe.content.includes('<p')) {
            templates.push({
              name: `${swipe.name || `Swipe ${index + 1}`} - Content`,
              type: 'Content HTML',
              html: swipe.content,
              angle: angle,
              timestamp: swipe.timestamp
            })
          }
        }
        
        const htmlFields = ['html_content', 'generated_html', 'template_html', 'output_html', 'rendered_html', 'final_html']
        htmlFields.forEach(field => {
          if (swipe[field] && typeof swipe[field] === 'string' && swipe[field].includes('<html')) {
            templates.push({
              name: `${swipe.name || `Swipe ${index + 1}`} - ${field}`,
              type: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              html: swipe[field],
              angle: angle,
              timestamp: swipe.timestamp
            })
          }
        })
      })
    }
    
    if (fullResult?.results?.html_templates) {
      const htmlTemplates = Array.isArray(fullResult.results.html_templates) ? fullResult.results.html_templates : [fullResult.results.html_templates]
      htmlTemplates.forEach((template, index) => {
        if (typeof template === 'string' && template.includes('<html')) {
          templates.push({
            name: `Template ${index + 1}`,
            type: 'Main Template',
            html: template,
            timestamp: fullResult.timestamp_iso
          })
        }
      })
    }
    
    return templates
  }

  const templates = extractHTMLTemplates()

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
          {templates.length > 0 ? (
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
                  <div className="flex justify-center gap-2 mb-4">
                    {templates.map((_, index) => (
                      <Button
                        key={index}
                        variant={activeTemplate === index ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveTemplate(index)}
                        className="h-8 w-8 p-0"
                      >
                        {index + 1}
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
                        {templates[activeTemplate]?.name && templates[activeTemplate]?.angle && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {templates[activeTemplate].name}
                          </p>
                        )}
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
                            <div className="h-[calc(98vh-80px)] border rounded-lg bg-background overflow-hidden">
                              <iframe
                                srcDoc={templates[activeTemplate]?.html}
                                className="w-full h-full min-h-[1000px]"
                                sandbox="allow-same-origin allow-scripts"
                                style={{
                                  border: 'none',
                                  transform: 'scale(1.0)',
                                  transformOrigin: 'top left',
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
                            <div className="h-[calc(100vh-120px)] border-0 bg-background overflow-hidden">
                              <iframe
                                srcDoc={templates[activeTemplate]?.html}
                                className="w-full h-full min-h-[1200px]"
                                sandbox="allow-same-origin allow-scripts"
                                style={{
                                  border: 'none',
                                  transform: 'scale(1.0)',
                                  transformOrigin: 'top left',
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
                      <div className="border rounded-lg h-full overflow-hidden">
                        <iframe
                          srcDoc={templates[activeTemplate]?.html}
                          className="w-full h-full min-h-[800px]"
                          sandbox="allow-same-origin allow-scripts"
                          style={{
                            border: 'none',
                            transform: 'scale(1.0)',
                            transformOrigin: 'top left',
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
