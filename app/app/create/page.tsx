"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Eye, ChevronRight, ChevronLeft, Menu } from "lucide-react"
import { useTemplatesStore } from "@/stores/templates-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useAuthStore } from "@/stores/auth-store"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { TemplatePreview } from "@/components/template-preview"
import { useSidebar } from "@/contexts/sidebar-context"

interface PipelineFormData {
  title: string
  brand_info: string
  sales_page_url: string
  template_id?: string
  advertorial_type: string
  persona?: string
  age_range?: string
  gender?: string
}

export default function CreatePage() {
  const { templates, fetchTemplates, selectedTemplate, setSelectedTemplate, isLoading: templatesLoading } = useTemplatesStore()
  const { createJob } = useJobsStore()
  const { user, isAuthenticated } = useAuthStore()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    brand_info: "",
    sales_page_url: "",
    template_id: "",
    advertorial_type: "",
    persona: "",
    age_range: "",
    gender: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})
  const [isLoading, setIsLoading] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const templatesPerPage = 4

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
    fetchTemplates()
  }, [isAuthenticated, user, router, fetchTemplates])

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}
    
    if (step === 1) {
      if (!formData.template_id) {
        newErrors.template_id = "Template selection is required"
      }
    } else if (step === 2) {
      if (!formData.title.trim()) {
        newErrors.title = "Project title is required"
      }
      if (!formData.brand_info.trim()) {
        newErrors.brand_info = "Brand information is required"
      } else if (formData.brand_info.trim().length < 10) {
        newErrors.brand_info = "Brand information must be at least 10 characters"
      }
      if (!formData.sales_page_url.trim()) {
        newErrors.sales_page_url = "Sales page URL is required"
      } else if (!isValidUrl(formData.sales_page_url)) {
        newErrors.sales_page_url = "Please enter a valid URL"
      }
      if (!formData.advertorial_type) {
        newErrors.advertorial_type = "Advertorial type is required"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    setCurrentStep(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(2)) return

    try {
      setIsLoading(true)
      await createJob(formData)
      
      setFormData({
        title: "",
        brand_info: "",
        sales_page_url: "",
        template_id: "",
        advertorial_type: "",
        persona: "",
        age_range: "",
        gender: "",
      })
      setSelectedTemplate(null)
      setErrors({})
      setCurrentStep(1)
      
      router.push("/dashboard")
    } catch (error) {
      // Error handling is done in the catch block above
    } finally {
      setIsLoading(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    setFormData(prev => ({ ...prev, template_id: templateId }))
    setSelectedTemplate(template || null)
    if (errors.template_id) setErrors(prev => ({ ...prev, template_id: undefined }))
  }

  // Pagination logic
  const totalPages = Math.ceil(templates.length / templatesPerPage)
  const startIndex = (currentPage - 1) * templatesPerPage
  const endIndex = startIndex + templatesPerPage
  const currentTemplates = templates.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of template section when changing pages
    const templateSection = document.getElementById('template-section')
    if (templateSection) {
      templateSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (templatesLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            {/* Header skeleton */}
            <div className="mb-4 md:mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="h-8 w-64 bg-muted animate-pulse-slow rounded-md" />
                  <div className="h-4 w-80 bg-muted animate-pulse-slow rounded-md mt-1" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-8 bg-muted animate-pulse-slow rounded-md" />
                </div>
              </div>
              
              {/* Progress steps skeleton */}
              <div className="flex items-center gap-2 md:gap-4 mt-3 md:mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-muted animate-pulse-slow rounded-full" />
                  <div className="h-4 w-24 bg-muted animate-pulse-slow rounded-md" />
                </div>
                <div className="h-3 w-3 bg-muted animate-pulse-slow rounded-md" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-muted animate-pulse-slow rounded-full" />
                  <div className="h-4 w-28 bg-muted animate-pulse-slow rounded-md" />
                </div>
              </div>
            </div>

            {/* Template selection skeleton */}
            <div className="space-y-6">
              <div className="border rounded-lg p-6">
                <div className="h-6 w-48 bg-muted animate-pulse-slow rounded-md mb-2" />
                <div className="h-4 w-96 bg-muted animate-pulse-slow rounded-md mb-6" />
                
                {/* Template grid skeleton */}
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="h-6 w-3/4 bg-muted animate-pulse-slow rounded-md mb-2" />
                      <div className="h-4 w-full bg-muted animate-pulse-slow rounded-md mb-2" />
                      <div className="h-4 w-2/3 bg-muted animate-pulse-slow rounded-md mb-4" />
                      <div className="h-32 w-full bg-muted animate-pulse-slow rounded-md" />
                    </div>
                  ))}
                </div>
                
                {/* Next button skeleton */}
                <div className="flex justify-end mt-6">
                  <div className="h-10 w-32 bg-muted animate-pulse-slow rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto md:ml-0">
          <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create New Content</h1>
                  <p className="text-sm md:text-base text-muted-foreground mt-1">Choose a template and generate AI-powered marketing content</p>
                </div>
                <div className="flex gap-2">
                  {/* Mobile menu button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 p-0 md:hidden"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  
                  {/* Desktop collapse button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 p-0 hidden md:flex"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4 mt-3 md:mt-4">
                <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    1
                  </div>
                  <span className="text-sm font-medium">Choose Template</span>
                </div>
                <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Project Details</span>
                </div>
              </div>
            </div>

            {currentStep === 1 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">Choose Your Template</CardTitle>
                        <CardDescription>
                          Select a template that best fits your content needs. Click on any template to preview it.
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={handleNext}
                        disabled={!formData.template_id}
                        className="min-w-[120px]"
                      >
                        Next Step
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div id="template-section" className={`grid gap-4 md:gap-6 ${isCollapsed ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {currentTemplates.map((template) => (
                        <TemplatePreview
                          key={template.id}
                          template={template}
                          isSelected={formData.template_id === template.id}
                          onClick={() => handleTemplateChange(template.id)}
                        />
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-6">
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
                    
                    {errors.template_id && (
                      <div className="mt-4">
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{errors.template_id}</AlertDescription>
                        </Alert>
                      </div>
                    )}

                    <div className="flex justify-end mt-6">
                      <Button 
                        onClick={handleNext}
                        disabled={!formData.template_id}
                        className="min-w-[120px]"
                      >
                        Next Step
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 2 && (
              <div className="max-w-2xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Project Details</CardTitle>
                    <CardDescription>Fill in your project information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="title">
                          Project Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="title"
                          placeholder="e.g., Product Launch Landing Page"
                          value={formData.title}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, title: e.target.value }))
                            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                          }}
                          disabled={isLoading}
                          className={errors.title ? "border-destructive" : ""}
                        />
                        {errors.title && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.title}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="brand_info">
                          Brand Information <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="brand_info"
                          placeholder="Describe your brand, product, or service. Include key features, benefits, target audience, and any specific messaging you want to convey..."
                          value={formData.brand_info}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, brand_info: e.target.value }))
                            if (errors.brand_info) setErrors((prev) => ({ ...prev, brand_info: undefined }))
                          }}
                          rows={4}
                          disabled={isLoading}
                          className={errors.brand_info ? "border-destructive" : ""}
                        />
                        {errors.brand_info && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.brand_info}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sales_page_url">Current Sales Page URL *</Label>
                        <Input
                          id="sales_page_url"
                          placeholder="https://example.com/current-page"
                          value={formData.sales_page_url}
                          onChange={(e) => setFormData((prev) => ({ ...prev, sales_page_url: e.target.value }))}
                          disabled={isLoading}
                          className={errors.sales_page_url ? "border-destructive" : ""}
                        />
                        {errors.sales_page_url && (
                          <p className="text-sm text-destructive">{errors.sales_page_url}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="advertorial_type">
                          Advertorial Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.advertorial_type}
                          onValueChange={(value) => {
                            setFormData((prev) => ({ ...prev, advertorial_type: value }))
                            if (errors.advertorial_type) setErrors((prev) => ({ ...prev, advertorial_type: undefined }))
                          }}
                          disabled={isLoading}
                        >
                          <SelectTrigger className={errors.advertorial_type ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select advertorial type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Listicle">Listicle</SelectItem>
                            <SelectItem value="Advertorial">Advertorial</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.advertorial_type && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.advertorial_type}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="persona">Target Persona (Optional)</Label>
                        <Input
                          id="persona"
                          placeholder="e.g., Health-conscious professionals, Tech-savvy millennials"
                          value={formData.persona}
                          onChange={(e) => setFormData((prev) => ({ ...prev, persona: e.target.value }))}
                          disabled={isLoading}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="age_range">Age Range (Optional)</Label>
                          <Input
                            id="age_range"
                            placeholder="e.g., 25-40, 30-55"
                            value={formData.age_range}
                            onChange={(e) => setFormData((prev) => ({ ...prev, age_range: e.target.value }))}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gender">Gender (Optional)</Label>
                          <Select
                            value={formData.gender}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedTemplate && (
                        <div className="p-4 bg-muted rounded-lg">
                          <h4 className="font-medium text-sm mb-2">Selected Template</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{selectedTemplate.name}</span>
                            <Badge variant="outline" className="text-xs">{selectedTemplate.category}</Badge>
                          </div>
                        </div>
                      )}

                      {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>Please fix the errors above before submitting.</AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleBack}
                          className="flex-1"
                        >
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <Button type="submit" className="flex-1" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Content...
                            </>
                          ) : (
                            "Generate AI Content"
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
  