"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { useTemplatesStore } from "@/stores/templates-store"
import { TemplatePreview } from "@/components/template-preview"
import { Search, Filter, FileText } from "lucide-react"

export default function TemplatesPage() {
  const router = useRouter()
  // Same source as create page - use isLoading from store
  const { templates, fetchTemplates, isLoading: templatesLoading, preloadTemplates } = useTemplatesStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  
  // Pagination state - same as create page
  const [currentPage, setCurrentPage] = useState(1)
  const templatesPerPage = 4

  // Preload templates early for better UX - Same as create page
  useEffect(() => {
    preloadTemplates()
  }, [preloadTemplates])

  // Fetch templates - Same as create page (fetches from same API endpoint)
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Filter templates - same logic as before
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  // Pagination logic - same as create page
  const totalPages = Math.ceil(filteredTemplates.length / templatesPerPage)
  const startIndex = (currentPage - 1) * templatesPerPage
  const endIndex = startIndex + templatesPerPage
  const currentTemplates = filteredTemplates.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of template section when changing pages
    const templateSection = document.getElementById('template-section')
    if (templateSection) {
      templateSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    router.push(`/create?template=${templateId}`)
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Choose a Template</h1>
            <p className="text-muted-foreground">
              Select a template to start creating your content
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection Card - Same structure as create page */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Available Templates</h3>
                  <p className="text-sm text-muted-foreground">Click on any template to preview and select it</p>
                </div>

                {/* Templates Grid - Same as create page using TemplatePreview */}
                {templatesLoading ? (
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[350px] md:h-[400px] bg-muted/20 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredTemplates.length > 0 ? (
                  <>
                    <div id="template-section" className="grid gap-6 grid-cols-1 md:grid-cols-2">
                      {currentTemplates.map((template) => (
                        <TemplatePreview
                          key={template.id}
                          template={template}
                          isSelected={false}
                          onClick={() => handleTemplateSelect(template.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination - Same as create page */}
                    {totalPages > 1 && (
                      <div className="flex justify-center">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => handlePageChange(currentPage - 1)}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => handlePageChange(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => handlePageChange(currentPage + 1)}
                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No templates found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or filter criteria
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
