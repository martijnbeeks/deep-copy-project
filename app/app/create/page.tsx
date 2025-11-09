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
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { TemplatePreview } from "@/components/template-preview"
import { useSidebar } from "@/contexts/sidebar-context"
import { AvatarExtractionDialog } from "@/components/avatar-extraction-dialog"
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { useToast } from "@/hooks/use-toast"

interface CustomerAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
}

interface PipelineFormData {
  title: string
  brand_info: string
  sales_page_url: string
  template_id?: string
  advertorial_type: string
  target_approach?: string
  customer_avatars?: CustomerAvatar[]
  extracted_avatars?: CustomerAvatar[]
  // Deprecated fields for backward compatibility
  persona?: string
  age_range?: string
  gender?: string
}

export default function CreatePage() {
  const { templates, fetchTemplates, selectedTemplate, setSelectedTemplate, isLoading: templatesLoading, preloadTemplates } = useTemplatesStore()
  const { createJob } = useJobsStore()
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()

  // Use auto-polling for processing jobs (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()
  const { toast } = useToast()

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    brand_info: "",
    sales_page_url: "",
    template_id: "",
    advertorial_type: "",
    target_approach: "explore",
    customer_avatars: [],
    extracted_avatars: [],
    // Deprecated fields for backward compatibility
    persona: "",
    age_range: "",
    gender: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const templatesPerPage = 4

  // Avatar extraction dialog state
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)

  // Preload templates early for better UX
  useEffect(() => {
    preloadTemplates()
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
    fetchTemplates()
  }, [isAuthenticated, user, router])

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    if (step === 1) {
      // Validate Step 1: Project Details
      if (!formData.title.trim()) {
        newErrors.title = "Project title is required"
      }
      // Brand info is optional - no validation needed
      if (!formData.sales_page_url.trim()) {
        newErrors.sales_page_url = "Sales page URL is required"
      } else if (!isValidUrl(formData.sales_page_url)) {
        newErrors.sales_page_url = "Please enter a valid URL"
      }
      if (!formData.target_approach) {
        newErrors.target_approach = "Please select an approach"
      }
      // Note: For "explore" approach, avatars will be generated when button is clicked
      // For "known" approach, avatars should already be provided
      if (formData.target_approach === 'known' && formData.customer_avatars.length === 0) {
        newErrors.customer_avatars = "Please provide customer avatar information"
      }
    } else if (step === 2) {
      // Validate Step 2: Template Selection
      if (!formData.template_id) {
        newErrors.template_id = "Template selection is required"
      }
      // For "explore" approach, ensure avatars were generated and selected
      if (formData.target_approach === 'explore' && formData.customer_avatars.length === 0) {
        newErrors.customer_avatars = "Please generate and select avatars before proceeding"
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

  const handleNext = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    if (validateStep(currentStep)) {
      // If user selected "explore new avatars" but hasn't selected any yet, show the extraction dialog
      if (formData.target_approach === 'explore' && (formData.customer_avatars?.length ?? 0) === 0) {
        setShowAvatarDialog(true)
        return
      }
      
      // Otherwise, proceed to next step
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    setCurrentStep(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate both steps before submitting
    if (!validateStep(1) || !validateStep(2)) return

    // Prevent duplicate submissions
    if (isLoading) return

    // For "known" approach, proceed with normal submission
    try {
      setIsLoading(true)
      const createdJob = await createJob(formData)

      // Show success message
      toast({
        title: "Success!",
        description: "Job created successfully! Redirecting to job details...",
        variant: "default",
      })

      // Brief delay to show success message
      await new Promise(resolve => setTimeout(resolve, 1500))

      setFormData({
        title: "",
        brand_info: "",
        sales_page_url: "",
        template_id: "",
        advertorial_type: "",
        target_approach: "explore",
        customer_avatars: [],
        // Deprecated fields for backward compatibility
        persona: "",
        age_range: "",
        gender: "",
      })
      setSelectedTemplate(null)
      setErrors({})
      setGeneralError(null)
      setCurrentStep(1)

      router.push(`/jobs/${createdJob.id}`)
    } catch (error) {
      console.error('Job creation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create job'

      // Show error toast
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })

      // Check if it's a duplicate job error
      if (errorMessage.includes('Duplicate job detected')) {
        setErrors({
          title: 'A job with this title was created recently. Please wait a moment or use a different title.'
        })
        setGeneralError(errorMessage)
      } else {
        setGeneralError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarsSelected = async (selectedAvatars: any[], allAvatars: any[]) => {
    try {
      // Update form data with selected avatars
      setFormData(prev => ({
        ...prev,
        customer_avatars: selectedAvatars,
        extracted_avatars: allAvatars
      }))

      // Close the dialog
      setShowAvatarDialog(false)

      // Proceed to Step 2 (Template Selection)
      setCurrentStep(2)
    } catch (error) {
      console.error('Error updating avatars:', error)
      toast({
        title: "Error",
        description: "Failed to update avatar selection. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    setFormData(prev => ({
      ...prev,
      template_id: templateId,
      // Auto-select advertorial type based on template category
      advertorial_type: template?.category === 'listicle' ? 'listicle' : 'advertorial'
    }))
    setSelectedTemplate(template || null)
    if (errors.template_id) setErrors(prev => ({ ...prev, template_id: undefined }))
    if (errors.advertorial_type) setErrors(prev => ({ ...prev, advertorial_type: undefined }))
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
      <div className="flex h-screen bg-background overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden md:ml-0">
          <div className="p-4 md:p-6 overflow-y-auto h-full">
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
      <div className="flex h-screen bg-background overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden md:ml-0">
          <div className="p-4 md:p-6 overflow-y-auto h-full">
            <div className="mb-4 md:mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create New Content</h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">Choose a template and generate AI-powered marketing content</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 mt-6">
                <div className={`flex items-center gap-3 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${currentStep >= 1 ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-muted border-2 border-muted-foreground/20'
                    }`}>
                    1
                  </div>
                  <span className="text-sm font-semibold">Project Details</span>
                </div>
                <div className={`w-8 h-px ${currentStep >= 2 ? 'bg-primary' : 'bg-muted-foreground/30'}`}></div>
                <div className={`flex items-center gap-3 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${currentStep >= 2 ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-muted border-2 border-muted-foreground/20'
                    }`}>
                    2
                  </div>
                  <span className="text-sm font-semibold">Choose Template</span>
                </div>
              </div>
            </div>

            {currentStep === 1 && (
              <div className="max-w-4xl mx-auto">
                <div className="space-y-8">
                  {/* Header Section */}
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-foreground">Project Details</h2>
                    <p className="text-muted-foreground text-lg">Fill in your project information to generate AI-powered content</p>
                  </div>

                  {/* Main Form */}
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-8">
                      <form onSubmit={handleNext} className="space-y-8">
                        {/* Project Title Section */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-base font-semibold text-foreground">
                              Project Title <span className="text-destructive">*</span>
                            </Label>
                            <p className="text-sm text-muted-foreground">Give your project a descriptive name</p>
                          </div>
                          <Input
                            id="title"
                            placeholder="e.g., Product Launch Landing Page"
                            value={formData.title}
                            onChange={(e) => {
                              setFormData((prev) => ({ ...prev, title: e.target.value }))
                              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                            }}
                            disabled={isLoading}
                            className={`h-12 text-base ${errors.title ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-primary"}`}
                          />
                          {errors.title && (
                            <p className="text-sm text-destructive flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              {errors.title}
                            </p>
                          )}
                        </div>

                        {/* Brand Information Section */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="brand_info" className="text-base font-semibold text-foreground">
                              Brand Information <span className="text-muted-foreground text-sm">(Optional)</span>
                            </Label>
                            <p className="text-sm text-muted-foreground">Describe your brand, product, or service in detail</p>
                          </div>
                          <Textarea
                            id="brand_info"
                            placeholder="Include key features, benefits, target audience, and any specific messaging you want to convey..."
                            value={formData.brand_info}
                            onChange={(e) => {
                              setFormData((prev) => ({ ...prev, brand_info: e.target.value }))
                              if (errors.brand_info) setErrors((prev) => ({ ...prev, brand_info: undefined }))
                            }}
                            rows={5}
                            disabled={isLoading}
                            className={`text-base resize-none ${errors.brand_info ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-primary"}`}
                          />
                          {errors.brand_info && (
                            <p className="text-sm text-destructive flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              {errors.brand_info}
                            </p>
                          )}
                        </div>

                        {/* Sales Page URL Section */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="sales_page_url" className="text-base font-semibold text-foreground">
                              Current Sales Page URL <span className="text-destructive">*</span>
                            </Label>
                            <p className="text-sm text-muted-foreground">Provide the URL of your existing sales page</p>
                          </div>
                          <Input
                            id="sales_page_url"
                            placeholder="https://example.com/current-page"
                            value={formData.sales_page_url}
                            onChange={(e) => setFormData((prev) => ({ ...prev, sales_page_url: e.target.value }))}
                            disabled={isLoading}
                            className={`h-12 text-base ${errors.sales_page_url ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-primary"}`}
                          />
                          {errors.sales_page_url && (
                            <p className="text-sm text-destructive flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              {errors.sales_page_url}
                            </p>
                          )}
                        </div>

                        {/* Target Audience Section */}
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">Target Audience</h3>
                            <p className="text-sm text-muted-foreground">Choose your approach to define your target audience</p>
                          </div>

                          {/* Choose Your Approach */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-base font-semibold text-foreground">
                                Choose Your Approach <span className="text-destructive">*</span>
                              </Label>
                              <p className="text-sm text-muted-foreground">Select how you want to approach your target audience</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div
                                className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${formData.target_approach === 'explore'
                                  ? 'border-primary bg-primary/5 shadow-lg'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                  }`}
                                onClick={() => setFormData(prev => ({ ...prev, target_approach: 'explore', persona: '', age_range: '', gender: '' }))}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.target_approach === 'explore' ? 'border-primary bg-primary' : 'border-muted-foreground'
                                    }`}>
                                    {formData.target_approach === 'explore' && (
                                      <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-base text-foreground mb-2">I want to explore new avatars</h4>
                                    <p className="text-sm text-muted-foreground mb-3">that I can do research on</p>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>• Discover new customer segments</p>
                                      <p>• Research market opportunities</p>
                                      <p>• Test different audience approaches</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div
                                className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${formData.target_approach === 'known'
                                  ? 'border-primary bg-primary/5 shadow-lg'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                  }`}
                                onClick={() => setFormData(prev => ({ ...prev, target_approach: 'known', persona: '', age_range: '', gender: '' }))}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.target_approach === 'known' ? 'border-primary bg-primary' : 'border-muted-foreground'
                                    }`}>
                                    {formData.target_approach === 'known' && (
                                      <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-base text-foreground mb-2">I know exactly who my customer is</h4>
                                    <p className="text-sm text-muted-foreground mb-3">and want to target them specifically</p>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <p>• Define specific demographics</p>
                                      <p>• Target existing customer base</p>
                                      <p>• Optimize for known preferences</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Conditional Content Based on Approach */}
                          {formData.target_approach === 'explore' && (
                            <div className="space-y-4">
                              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <h4 className="font-medium text-sm mb-3 text-blue-900 dark:text-blue-100">
                                  AI Avatar Discovery
                                </h4>
                                <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                                  Our AI will analyze your sales page to discover and extract customer personas automatically.
                                  No manual selection needed - just provide your sales page URL and we'll do the research for you.
                                </p>
                                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <span>Avatars will be extracted after you submit the form</span>
                                </div>
                              </div>

                              {(formData.customer_avatars?.length ?? 0) > 0 && (
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                  <div className="text-sm text-muted-foreground">
                                    {formData.customer_avatars?.length} avatar{(formData.customer_avatars?.length || 0) > 1 ? 's' : ''} selected
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowAvatarDialog(true)}
                                    className="h-9"
                                  >
                                    Update Avatars
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {formData.target_approach === 'known' && (
                            <div className="space-y-4">
                              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                <h4 className="font-medium text-sm mb-3 text-green-900 dark:text-green-100">
                                  Define Your Target Persona
                                </h4>
                                <p className="text-sm text-green-800 dark:text-green-200 mb-4">
                                  Describe your specific target customer persona with all required details:
                                </p>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                                      Persona Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                      placeholder="e.g., Health-conscious professionals, Tech-savvy millennials, Busy parents..."
                                      value={formData.customer_avatars?.[0]?.persona_name || ''}
                                      onChange={(e) => {
                                        const newAvatars = [...(formData.customer_avatars || [])]
                                        if (newAvatars.length === 0) {
                                          newAvatars.push({
                                            persona_name: e.target.value,
                                            description: '',
                                            age_range: '',
                                            gender: '',
                                            key_buying_motivation: ''
                                          })
                                        } else {
                                          newAvatars[0].persona_name = e.target.value
                                        }
                                        setFormData((prev) => ({ ...prev, customer_avatars: newAvatars }))
                                      }}
                                      disabled={isLoading}
                                      className="h-11 text-sm border-green-200 dark:border-green-800 focus-visible:ring-green-500"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                                      Description <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                      placeholder="Describe their lifestyle, motivations, and key challenges in 1-2 sentences..."
                                      value={formData.customer_avatars?.[0]?.description || ''}
                                      onChange={(e) => {
                                        const newAvatars = [...(formData.customer_avatars || [])]
                                        if (newAvatars.length === 0) {
                                          newAvatars.push({
                                            persona_name: '',
                                            description: e.target.value,
                                            age_range: '',
                                            gender: '',
                                            key_buying_motivation: ''
                                          })
                                        } else {
                                          newAvatars[0].description = e.target.value
                                        }
                                        setFormData((prev) => ({ ...prev, customer_avatars: newAvatars }))
                                      }}
                                      rows={3}
                                      disabled={isLoading}
                                      className="text-sm border-green-200 dark:border-green-800 focus-visible:ring-green-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                                        Age Range <span className="text-red-500">*</span>
                                      </Label>
                                      <Select
                                        value={formData.customer_avatars?.[0]?.age_range || ''}
                                        onValueChange={(value) => {
                                          const newAvatars = [...(formData.customer_avatars || [])]
                                          if (newAvatars.length === 0) {
                                            newAvatars.push({
                                              persona_name: '',
                                              description: '',
                                              age_range: value,
                                              gender: '',
                                              key_buying_motivation: ''
                                            })
                                          } else {
                                            newAvatars[0].age_range = value
                                          }
                                          setFormData((prev) => ({ ...prev, customer_avatars: newAvatars }))
                                        }}
                                        disabled={isLoading}
                                      >
                                        <SelectTrigger className="h-11 text-sm border-green-200 dark:border-green-800 focus-visible:ring-green-500">
                                          <SelectValue placeholder="Select age range" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="18-24" className="text-sm py-2">18-24 (Gen Z)</SelectItem>
                                          <SelectItem value="25-34" className="text-sm py-2">25-34 (Millennials)</SelectItem>
                                          <SelectItem value="35-44" className="text-sm py-2">35-44 (Millennials)</SelectItem>
                                          <SelectItem value="45-54" className="text-sm py-2">45-54 (Gen X)</SelectItem>
                                          <SelectItem value="55-64" className="text-sm py-2">55-64 (Gen X)</SelectItem>
                                          <SelectItem value="65+" className="text-sm py-2">65+ (Boomers)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                                        Gender <span className="text-red-500">*</span>
                                      </Label>
                                      <Select
                                        value={formData.customer_avatars?.[0]?.gender || ''}
                                        onValueChange={(value) => {
                                          const newAvatars = [...(formData.customer_avatars || [])]
                                          if (newAvatars.length === 0) {
                                            newAvatars.push({
                                              persona_name: '',
                                              description: '',
                                              age_range: '',
                                              gender: value,
                                              key_buying_motivation: ''
                                            })
                                          } else {
                                            newAvatars[0].gender = value
                                          }
                                          setFormData((prev) => ({ ...prev, customer_avatars: newAvatars }))
                                        }}
                                        disabled={isLoading}
                                      >
                                        <SelectTrigger className="h-11 text-sm border-green-200 dark:border-green-800 focus-visible:ring-green-500">
                                          <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="male" className="text-sm py-2">Male</SelectItem>
                                          <SelectItem value="female" className="text-sm py-2">Female</SelectItem>
                                          <SelectItem value="both" className="text-sm py-2">Both</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-green-900 dark:text-green-100">
                                      Key Buying Motivation <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                      placeholder="What drives them to purchase this product? What problem does it solve for them?"
                                      value={formData.customer_avatars?.[0]?.key_buying_motivation || ''}
                                      onChange={(e) => {
                                        const newAvatars = [...(formData.customer_avatars || [])]
                                        if (newAvatars.length === 0) {
                                          newAvatars.push({
                                            persona_name: '',
                                            description: '',
                                            age_range: '',
                                            gender: '',
                                            key_buying_motivation: e.target.value
                                          })
                                        } else {
                                          newAvatars[0].key_buying_motivation = e.target.value
                                        }
                                        setFormData((prev) => ({ ...prev, customer_avatars: newAvatars }))
                                      }}
                                      rows={2}
                                      disabled={isLoading}
                                      className="text-sm border-green-200 dark:border-green-800 focus-visible:ring-green-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Error display for customer avatars */}
                          {errors.customer_avatars && (
                            <p className="text-sm text-destructive flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              {errors.customer_avatars}
                            </p>
                          )}
                        </div>

                        {/* Error Summary */}
                        {Object.keys(errors).length > 0 && (
                          <Alert variant="destructive" className="border-destructive/50">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-sm">Please fix the errors above before submitting.</AlertDescription>
                          </Alert>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-4 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            className="flex-1 h-12 text-base font-medium"
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Back to Project Details
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 h-12 text-base font-medium bg-primary hover:bg-primary/90"
                            disabled={isLoading}
                          >
                            {formData.target_approach === 'explore' ? 'Generate Avatars' : 'Continue to Template Selection'}
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-foreground">Choose Your Template</h2>
                  <p className="text-muted-foreground text-lg">Select a template that best fits your content needs</p>
                </div>

                {/* Template Selection Card */}
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">Available Templates</h3>
                        <p className="text-sm text-muted-foreground">Click on any template to preview and select it</p>
                      </div>

                      <div id="template-section" className="grid gap-6 grid-cols-1 md:grid-cols-2">
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

                      {errors.template_id && (
                        <Alert variant="destructive" className="border-destructive/50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">{errors.template_id}</AlertDescription>
                        </Alert>
                      )}

                      {generalError && (
                        <Alert variant="destructive" className="border-destructive/50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">{generalError}</AlertDescription>
                        </Alert>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-4 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCurrentStep(1)}
                          disabled={isLoading}
                          className="h-12 px-8 text-base font-medium"
                        >
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Back to Project Details
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!formData.template_id || isLoading}
                          className="h-12 px-8 text-base font-medium bg-primary hover:bg-primary/90"
                        >
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
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Avatar Extraction Dialog */}
      <AvatarExtractionDialog
        isOpen={showAvatarDialog}
        onClose={() => setShowAvatarDialog(false)}
    onAvatarsSelected={handleAvatarsSelected}
        salesPageUrl={formData.sales_page_url}
        formData={formData}
        isLoading={isLoading}
      />
    </ErrorBoundary>
  )
}
