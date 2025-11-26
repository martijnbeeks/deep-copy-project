"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { useTemplatesStore } from "@/stores/templates-store"
import { useTemplates } from "@/lib/hooks/use-templates"
import { TemplatePreview } from "@/components/template-preview"
import { Filter, FileText } from "lucide-react"

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Get filters from UI store
  const { filters, setFilters } = useTemplatesStore()

  // Use TanStack Query for data fetching - fetch all templates once
  const { data: allTemplates = [], isLoading: templatesLoading } = useTemplates()

  // Pagination state - same as create page
  const [currentPage, setCurrentPage] = useState(1)
  const templatesPerPage = 9

  // Client-side filtering - filter all templates by category
  const filteredTemplates = allTemplates.filter(template => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    return matchesCategory
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

  // Reset to first page when category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory])

  const handleTemplateSelect = (templateId: string) => {
    router.push(`/create?template=${templateId}`)
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-16">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/*<div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Choose a Template</h1>
            <p className="text-muted-foreground">
              Select a template to start creating your content
            </p>
          </div>*/}

          {/* Category Filter */}
          <div className="flex justify-start">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Category</SelectItem>
                <SelectItem value="advertorial">Advertorial</SelectItem>
                <SelectItem value="listicle">Listicle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection Card - Same structure as create page */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <div className="space-y-6">
                {/*<div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Available Templates</h3>
                  <p className="text-sm text-muted-foreground">Click on any template to preview and select it</p>
                </div>*/}

                {/* Templates Grid - Same as create page using TemplatePreview */}
                {templatesLoading ? (
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-[350px] md:h-[400px] bg-muted/20 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredTemplates.length > 0 ? (
                  <>
                    <div id="template-section" className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
      </main >
    </div >
  )
}
