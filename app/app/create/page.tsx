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
  sales_page_url?: string
  template_id?: string
}

export default function CreatePage() {
  const { templates, fetchTemplates, selectedTemplate, setSelectedTemplate } = useTemplatesStore()
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
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})
  const [isLoading, setIsLoading] = useState(false)

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
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
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
      console.log('Creating job with data:', formData)
      const job = await createJob(formData)
      console.log('Job created, redirecting to jobs page')
      
      setFormData({
        title: "",
        brand_info: "",
        sales_page_url: "",
        template_id: "",
      })
      setSelectedTemplate(null)
      setErrors({})
      setCurrentStep(1)
      
      router.push("/jobs")
    } catch (error) {
      console.error('Form submission error:', error)
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

  if (!user || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                    <CardTitle className="text-xl">Choose Your Template</CardTitle>
                    <CardDescription>
                      Select a template that best fits your content needs. Click on any template to preview it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`grid gap-4 md:gap-6 ${isCollapsed ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {templates.map((template) => (
                        <TemplatePreview
                          key={template.id}
                          template={template}
                          isSelected={formData.template_id === template.id}
                          onClick={() => handleTemplateChange(template.id)}
                        />
                      ))}
                    </div>
                    
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
                        <Label htmlFor="sales_page_url">Current Sales Page URL (Optional)</Label>
                        <Input
                          id="sales_page_url"
                          placeholder="https://example.com/current-page"
                          value={formData.sales_page_url}
                          onChange={(e) => setFormData((prev) => ({ ...prev, sales_page_url: e.target.value }))}
                          disabled={isLoading}
                        />
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
  