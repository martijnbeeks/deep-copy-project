"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Search, Filter, Download, Copy, Eye, Grid3X3, List, ChevronLeft, ChevronRight, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAutoPolling } from "@/hooks/use-auto-polling"

interface GalleryTemplate {
  id: string
  jobId: string
  jobTitle: string
  templateName: string
  angle: string
  html: string
  createdAt: string
  status: string
  advertorialType: string
  thumbnail?: string
}

export default function ResultsGalleryPage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  
  // Use auto-polling for processing jobs (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()
  
  const [galleryTemplates, setGalleryTemplates] = useState<GalleryTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<GalleryTemplate[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedTemplate, setSelectedTemplate] = useState<GalleryTemplate | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [templatesPerPage] = useState(6)
  const [totalTemplates, setTotalTemplates] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
    loadGalleryData()
  }, [isAuthenticated, user, router])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
    loadGalleryData(1, false) // Reload first page when filters change
  }, [searchTerm, statusFilter, typeFilter])

  // Load data when page changes
  useEffect(() => {
    if (currentPage > 1) {
      loadGalleryData(currentPage, false) // Load specific page
    }
  }, [currentPage])

  // Helper function to generate thumbnail from HTML
  const generateThumbnail = (html: string): string => {
    try {
      // Use same image replacement logic as create page
      let processedContent = html
        .replace(/https?:\/\/[^\s"']*FFFFFF\?[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
        .replace(/https?:\/\/[^\s"']*placehold\.co\/[^"'\s]*FFFFFF[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
        .replace(/src="[^"]*FFFFFF[^"]*"/g, 'src="https://placehold.co/600x400?text=Image"')
        .replace(/src='[^']*FFFFFF[^']*'/g, "src='https://placehold.co/600x400?text=Image'")
      
      const imgMatch = processedContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
      if (imgMatch) {
        return imgMatch[1]
      }
      return 'https://placehold.co/600x400?text=Template+Preview'
    } catch (error) {
      console.error('Error generating thumbnail:', error)
      return 'https://placehold.co/600x400?text=Template+Preview'
    }
  }

  // Create small preview HTML using same logic as create page - memoized to prevent refreshing
  const createSmallPreviewHTML = useMemo(() => {
    return (htmlContent: string) => {
      // Fix broken image URLs and use the exact same HTML as full preview, just add scaling
      let processedContent = htmlContent
        .replace(/https?:\/\/[^\s"']*FFFFFF\?[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
        .replace(/https?:\/\/[^\s"']*placehold\.co\/[^"'\s]*FFFFFF[^"'\s]*/g, 'https://placehold.co/600x400?text=Image')
        .replace(/src="[^"]*FFFFFF[^"]*"/g, 'src="https://placehold.co/600x400?text=Image"')
        .replace(/src='[^']*FFFFFF[^']*'/g, "src='https://placehold.co/600x400?text=Image'")
      
      // Wrap in basic HTML structure with Tailwind CDN - NO cache busting to prevent refreshing
      const wrappedContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${processedContent}
</body>
</html>`
      
      return wrappedContent.replace(
        /<body([^>]*)>/i,
        '<body$1 style="transform: scale(0.3); transform-origin: top left; width: 333%; height: 333%; overflow: hidden;">'  
      )
    }
  }, [])

  const loadGalleryData = async (page = 1, append = false) => {
    if (!append) {
      setIsLoading(true)
    }
    
    try {
      // Wait for user to be available
      if (!user) {
        console.log('User not available, waiting...')
        return
      }
      
      console.log(`Fetching page ${page} for user:`, user.email)
      
      if (!append) {
        // Clear previous data only when loading first page
        setGalleryTemplates([])
      }
      
      // Fetch templates directly with pagination (much faster!)
      const response = await fetch(`/api/gallery/templates?page=${page}&limit=${templatesPerPage}`, {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`Fetched page ${page}:`, data.templates?.length || 0, 'templates')
        console.log('Total templates:', data.total)
        
        setTotalTemplates(data.total)
        setHasMore(data.hasMore)
        
        if (data.templates && data.templates.length > 0) {
          if (append) {
            setGalleryTemplates(prev => [...prev, ...data.templates])
          } else {
            setGalleryTemplates(data.templates)
          }
        } else {
          console.log('No templates found for this page')
        }
      } else {
        console.error('Failed to fetch templates:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading gallery data:', error)
    } finally {
      if (!append) {
        setIsLoading(false)
      }
    }
  }


  // Client-side filtering is now handled by server-side pagination
  // filteredTemplates will be the same as galleryTemplates


  const copyTemplateHtml = async (template: GalleryTemplate) => {
    try {
      await navigator.clipboard.writeText(template.html)
      toast({
        title: "Copied!",
        description: "Template HTML copied to clipboard.",
      })
    } catch (error) {
      console.error('Error copying template:', error)
      toast({
        title: "Error",
        description: "Failed to copy template to clipboard.",
        variant: "destructive",
      })
    }
  }

  const downloadTemplate = (template: GalleryTemplate) => {
    const blob = new Blob([template.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.jobTitle}-${template.angle}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePreview = (template: GalleryTemplate) => {
    setSelectedTemplate(template)
  }

  const handlePreviewLoad = (templateId: string) => {
    setLoadingTemplates(prev => new Set(prev).add(templateId))
  }

  const handlePreviewLoaded = (templateId: string) => {
    setLoadingTemplates(prev => {
      const newSet = new Set(prev)
      newSet.delete(templateId)
      return newSet
    })
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden md:ml-0">
          <div className="p-4 md:p-6 overflow-y-auto h-full">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">Results Gallery</h1>
                  <p className="text-muted-foreground">Loading your generated templates...</p>
                </div>
              </div>
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden md:ml-0">
        <div className="p-4 md:p-6 overflow-y-auto h-full">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Results Gallery</h1>
                <p className="text-muted-foreground">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="advertorial">Advertorial</SelectItem>
                  <SelectItem value="listicle">Listicle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Templates Grid/List */}
            {galleryTemplates.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                  <p>Create some jobs to see your generated templates here.</p>
                </div>
              </div>
            ) : (
              <div className={
                viewMode === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 gap-8"
                  : "space-y-4"
              }>
                {galleryTemplates.map((template) => (
                  <Card key={template.id} className="group hover:shadow-lg transition-shadow h-[350px] md:h-[400px] flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg line-clamp-1">{template.jobTitle}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{template.templateName}</span>
                            <span>•</span>
                            <span>{template.angle}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={template.status === 'completed' ? 'default' : 'secondary'}>
                            {template.status}
                          </Badge>
                          <Badge variant="outline">
                            {template.advertorialType}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      {/* Template Preview - using same dimensions as create page */}
                      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border">
                        {loadingTemplates.has(template.id) ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : (
                          <iframe
                            srcDoc={createSmallPreviewHTML(template.html)}
                            className="w-full h-full border-0"
                            onLoad={() => handlePreviewLoaded(template.id)}
                            onLoadStart={() => handlePreviewLoad(template.id)}
                            sandbox="allow-same-origin"
                            loading="eager"
                            title={`Preview of ${template.jobTitle}`}
                          />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between flex-shrink-0">
                        <div className="text-xs text-muted-foreground">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyTemplateHtml(template)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadTemplate(template)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalTemplates > 0 && (
              <div className="flex flex-col items-center justify-center mt-8 space-y-4">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min(galleryTemplates.length, totalTemplates)} of {totalTemplates} templates
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {(() => {
                      const totalPages = Math.ceil(totalTemplates / templatesPerPage)
                      const pages = []
                      
                      if (totalPages <= 7) {
                        // Show all pages if 7 or fewer
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(
                            <Button
                              key={i}
                              variant={currentPage === i ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(i)}
                              className="w-8 h-8 p-0"
                              disabled={isLoading}
                            >
                              {i}
                            </Button>
                          )
                        }
                      } else {
                        // Show first 3 pages
                        for (let i = 1; i <= 3; i++) {
                          pages.push(
                            <Button
                              key={i}
                              variant={currentPage === i ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(i)}
                              className="w-8 h-8 p-0"
                              disabled={isLoading}
                            >
                              {i}
                            </Button>
                          )
                        }
                        
                        // Show ellipsis if current page is far from start
                        if (currentPage > 5) {
                          pages.push(
                            <span key="ellipsis1" className="px-2 text-muted-foreground">
                              ...
                            </span>
                          )
                        }
                        
                        // Show current page and surrounding pages if not already shown
                        if (currentPage > 3 && currentPage < totalPages - 2) {
                          pages.push(
                            <Button
                              key={currentPage}
                              variant="default"
                              size="sm"
                              className="w-8 h-8 p-0"
                              disabled={isLoading}
                            >
                              {currentPage}
                            </Button>
                          )
                        }
                        
                        // Show ellipsis if current page is far from end
                        if (currentPage < totalPages - 4) {
                          pages.push(
                            <span key="ellipsis2" className="px-2 text-muted-foreground">
                              ...
                            </span>
                          )
                        }
                        
                        // Show last 3 pages
                        for (let i = Math.max(totalPages - 2, 4); i <= totalPages; i++) {
                          if (i !== currentPage) {
                            pages.push(
                              <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(i)}
                                className="w-8 h-8 p-0"
                                disabled={isLoading}
                              >
                                {i}
                              </Button>
                            )
                          }
                        }
                      }
                      
                      return pages
                    })()}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!hasMore || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Full Screen Preview Modal */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="!max-w-[100vw] !max-h-[100vh] !w-[100vw] !h-[100vh] overflow-hidden p-0 m-0 rounded-none">
          <div className="flex flex-col h-full w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-background border-b">
                <div>
                  <h2 className="text-xl font-semibold">{selectedTemplate.jobTitle}</h2>
                  <div className="text-sm text-muted-foreground">
                    {selectedTemplate.templateName} • {selectedTemplate.angle}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedTemplate.status === 'completed' ? 'default' : 'secondary'}>
                      {selectedTemplate.status}
                    </Badge>
                    <Badge variant="outline">
                      {selectedTemplate.advertorialType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyTemplateHtml(selectedTemplate)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy HTML
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate(selectedTemplate)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
              
            {/* Full Screen Preview */}
            <div className="h-[calc(100vh-120px)] border-0 bg-background overflow-auto">
              <iframe
                srcDoc={selectedTemplate.html}
                className="w-full h-full"
                sandbox="allow-same-origin"
              />
            </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}