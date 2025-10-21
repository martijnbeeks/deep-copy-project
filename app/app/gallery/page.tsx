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
import { Loader2, Search, Filter, Download, Copy, Eye, ChevronLeft, ChevronRight, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { GalleryCardSkeleton } from "@/components/ui/skeleton-loaders"

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

  const [allTemplates, setAllTemplates] = useState<GalleryTemplate[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<GalleryTemplate | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [templatesPerPage] = useState(6)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
    loadAllGalleryData()
  }, [isAuthenticated, user, router])

  // Client-side filtering and pagination
  const filteredTemplates = useMemo(() => {
    let filtered = allTemplates

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.angle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(template => template.status === statusFilter)
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(template => template.advertorialType === typeFilter)
    }

    return filtered
  }, [allTemplates, searchTerm, statusFilter, typeFilter])

  // Paginate filtered results
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * templatesPerPage
    const endIndex = startIndex + templatesPerPage
    return filteredTemplates.slice(startIndex, endIndex)
  }, [filteredTemplates, currentPage, templatesPerPage])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, typeFilter])

  // Load all data once on mount
  useEffect(() => {
    loadAllGalleryData()
  }, [])

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

  const loadAllGalleryData = async () => {
    setIsLoading(true)

    try {
      // Wait for user to be available
      if (!user) {
        console.log('User not available, waiting...')
        return
      }

      console.log('Fetching all templates for user:', user.email)

      // Fetch all templates at once (no pagination)
      const response = await fetch(`/api/gallery/templates?page=1&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Fetched templates:', data.templates?.length || 0, 'templates')

        if (data.templates && data.templates.length > 0) {
          setAllTemplates(data.templates)
        } else {
          console.log('No templates found')
          setAllTemplates([])
        }
      } else {
        console.error('Failed to fetch templates:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading gallery data:', error)
    } finally {
      setIsLoading(false)
    }
  }




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
            <div className="space-y-8">
              {/* Header skeleton */}
              <div className="space-y-2">
                <div className="h-8 w-64 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded-md" />
              </div>

              {/* Filter skeleton */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 h-10 bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-40 bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-40 bg-muted animate-pulse rounded-md" />
              </div>

              {/* Gallery skeleton grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <GalleryCardSkeleton key={i} />
                ))}
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
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Results Gallery
              </h1>
              <p className="text-muted-foreground text-lg">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 h-11 border-2 focus:border-primary/50 transition-colors"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44 h-11 border-2 focus:border-primary/50 transition-colors">
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
                <SelectTrigger className="w-full sm:w-44 h-11 border-2 focus:border-primary/50 transition-colors">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="advertorial">Advertorial</SelectItem>
                  <SelectItem value="listicle">Listicle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Templates Grid */}
            {paginatedTemplates.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-muted-foreground mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Eye className="h-8 w-8 opacity-50" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No templates found</h3>
                  <p className="text-base">Create some jobs to see your generated templates here.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paginatedTemplates.map((template) => (
                  <Card key={template.id} className="group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 h-[420px] md:h-[460px] flex flex-col border-2 hover:border-primary/20">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <CardTitle className="text-lg font-semibold line-clamp-2 text-foreground leading-tight">
                            {template.jobTitle}
                          </CardTitle>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
                            <span className="truncate">{template.templateName}</span>
                            <span className="text-muted-foreground/50 hidden sm:inline">•</span>
                            <span className="line-clamp-2 sm:line-clamp-1">{template.angle}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge
                            variant={template.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs font-medium"
                          >
                            {template.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs font-medium border-primary/20"
                          >
                            {template.advertorialType}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4">
                      {/* Template Preview */}
                      <div className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                        {loadingTemplates.has(template.id) ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="text-sm text-muted-foreground">Loading preview...</span>
                            </div>
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
                      <div className="flex items-center justify-between flex-shrink-0 pt-2">
                        <div className="text-sm text-muted-foreground font-medium">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(template)}
                            className="h-8 px-2 sm:px-3 hover:bg-primary hover:text-primary-foreground transition-colors text-xs sm:text-sm"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Preview</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyTemplateHtml(template)}
                            className="h-8 px-2 sm:px-3 hover:bg-primary hover:text-primary-foreground transition-colors text-xs sm:text-sm"
                          >
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Copy</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadTemplate(template)}
                            className="h-8 px-2 sm:px-3 hover:bg-primary hover:text-primary-foreground transition-colors text-xs sm:text-sm"
                          >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {filteredTemplates.length > 0 && (
              <div className="flex flex-col items-center justify-center mt-12 space-y-6">
                <div className="text-sm text-muted-foreground font-medium">
                  Showing {paginatedTemplates.length} of {filteredTemplates.length} templates
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-9 px-4 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {(() => {
                      const totalPages = Math.ceil(filteredTemplates.length / templatesPerPage)
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
                              className="w-9 h-9 p-0 font-medium"
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
                              className="w-9 h-9 p-0 font-medium"
                            >
                              {i}
                            </Button>
                          )
                        }

                        // Show ellipsis if current page is far from start
                        if (currentPage > 5) {
                          pages.push(
                            <span key="ellipsis1" className="px-2 text-muted-foreground font-medium">
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
                              className="w-9 h-9 p-0 font-medium"
                            >
                              {currentPage}
                            </Button>
                          )
                        }

                        // Show ellipsis if current page is far from end
                        if (currentPage < totalPages - 4) {
                          pages.push(
                            <span key="ellipsis2" className="px-2 text-muted-foreground font-medium">
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
                                className="w-9 h-9 p-0 font-medium"
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
                    disabled={currentPage >= Math.ceil(filteredTemplates.length / templatesPerPage)}
                    className="h-9 px-4 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
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