"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Info, Sparkles, CheckCircle, Globe, Plus, Trash2 } from "lucide-react"
import { SiAmazon, SiReddit } from "react-icons/si"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useCreateMarketingAngle, useUpdateMarketingAngle } from "@/lib/hooks/use-jobs"
import { useRouter } from "next/navigation"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { ErrorBoundary } from "@/components/ui/error-boundary"
// Avatar extraction removed - V2 handles this automatically
import { useAutoPolling } from "@/hooks/use-auto-polling"
import { useToast } from "@/hooks/use-toast"
import { isValidUrl } from "@/lib/utils/validation"
import { logger } from "@/lib/utils/logger"
import { INITIAL_SOURCE_STATUS, COMPLETED_SOURCE_STATUS, resetSourceStatus, completeSourceStatus, type SourceStatus } from "@/lib/constants/research-sources"
import { UsageLimitDialog } from "@/components/ui/usage-limit-dialog"
import { getAuthToken, getUserEmail } from "@/lib/utils/client-auth"
import { JOB_CREDITS_BY_TYPE } from "@/lib/constants/job-credits"
import { useBillingStore } from "@/stores/billing-store"

interface CustomerAvatar {
  persona_name: string
  description: string
  age_range: string
  gender: string
  key_buying_motivation: string
  pain_point?: string
  emotion?: string
  desire?: string
  characteristics?: string[]
  objections?: string[]
  failed_alternatives?: string[]
  is_broad_avatar?: boolean
  is_researched?: boolean  // Mark if user selected this avatar
}

interface PipelineFormData {
  title: string
  sales_page_urls: string[]
  research_requirements?: string
  gender?: string
  location?: string
  advertorial_type?: string
  target_product_name?: string
}

// V2: No avatar helpers needed - avatars come from API response

export default function CreatePage() {
  const { user, isAuthenticated, isReady } = useRequireAuth()
  const createMarketingAngleMutation = useCreateMarketingAngle()
  const updateMarketingAngleMutation = useUpdateMarketingAngle()
  const router = useRouter()

  // Use auto-polling for processing marketing angles (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()
  const { toast } = useToast()

  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    sales_page_urls: [""],
    research_requirements: "",
    gender: "",
    location: "",
    advertorial_type: "Listicle",
    target_product_name: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // URL popup state
  const [showUrlPopup, setShowUrlPopup] = useState(false)
  const [hasSeenUrlPopup, setHasSeenUrlPopup] = useState(false)

  // Research generation loading state
  const [showResearchLoading, setShowResearchLoading] = useState(false)
  const [researchProgress, setResearchProgress] = useState(0)
  const [researchStage, setResearchStage] = useState(0)
  const [currentMarketingAngleId, setCurrentMarketingAngleId] = useState<string | null>(null)

  // Individual source completion status
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(INITIAL_SOURCE_STATUS)

  // Usage limit dialog state
  const [showUsageLimitDialog, setShowUsageLimitDialog] = useState(false)
  const [usageLimitData, setUsageLimitData] = useState<{
    usageType: 'deep_research' | 'pre_lander'
    currentUsage: number
    limit: number
  } | null>(null)


  // Early return if not authenticated to prevent skeleton loader
  if (!isReady) {
    return null
  }

  // Check if form is valid (all required fields are filled)
  // Returns true if form is invalid/empty (button should be disabled)
  const isFormEmpty = (): boolean => {
    // Title is required
    if (!formData.title.trim()) {
      return true
    }

    // At least one sales page URL is required
    const urls = formData.sales_page_urls.filter((u) => u.trim())
    if (urls.length === 0) {
      return true
    }

    return false // Form is valid, button should be enabled
  }

  const validateForm = (dataToValidate?: PipelineFormData): boolean => {
    const data = dataToValidate || formData
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    // Validate Project Details
    if (!data.title.trim()) {
      newErrors.title = "Project title is required"
    }
    const filledUrls = (data.sales_page_urls || []).filter((u: string) => u.trim())
    if (filledUrls.length === 0) {
      newErrors.sales_page_urls = "At least one sales page URL is required"
    } else {
      const invalidIdx = filledUrls.findIndex((u: string) => !isValidUrl(u.trim()))
      if (invalidIdx !== -1) {
        newErrors.sales_page_urls = "Please enter valid URLs (each must start with http:// or https://)"
      }
    }
    // V2 fields are optional - no validation needed

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const submitForm = async (opts?: { allowOverage?: boolean }) => {
    // Validate form before submitting
    if (!validateForm()) return

    // Prevent duplicate submissions
    if (isLoading) return

    try {
      setIsLoading(true)

      // Auth header so job is created under the logged-in user (not demo@example.com)
      const token = getAuthToken()
      const userEmail = getUserEmail()
      const authHeader = token ? `Bearer ${token}` : userEmail ? `Bearer ${userEmail}` : null

      // Submit V2 job via API
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { Authorization: authHeader }),
        },
        body: JSON.stringify({
          title: formData.title,
          sales_page_urls: formData.sales_page_urls.filter((u) => u.trim()).map((u) => u.trim()),
          research_requirements: formData.research_requirements || undefined,
          gender: formData.gender || undefined,
          location: formData.location || undefined,
          advertorial_type: formData.advertorial_type || 'Listicle',
          target_product_name: formData.target_product_name?.trim() || undefined,
          ...(opts?.allowOverage ? { allowOverage: true } : {}),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({} as any))

        if (response.status === 402 && errorData?.code === 'JOB_CREDITS_OVERAGE_CONFIRMATION_REQUIRED') {
          // Show toast notification about overage
          const overageCredits = errorData?.overageCredits ?? 0;
          const overageCostTotal = errorData?.overageCostTotal ?? 0;
          const currency = errorData?.currency ?? 'EUR';
          
          toast({
            title: "Overage Charges Apply",
            description: `This job requires ${overageCredits} extra credit${overageCredits === 1 ? '' : 's'}. Overage charges will be added to your next invoice.`,
            variant: "default",
          });

          // Automatically retry with allowOverage=true
          setIsLoading(false);
          await submitForm({ allowOverage: true });
          return;
        }

        const err = new Error(errorData.error || errorData.message || 'Failed to create job') as Error & {
          status?: number
          currentUsage?: number
          limit?: number
        }
        err.status = response.status
        if (errorData.currentUsage !== undefined) err.currentUsage = errorData.currentUsage
        if (errorData.limit !== undefined) err.limit = errorData.limit
        throw err
      }

      const createdJob = await response.json()
      
      // Refresh billing status globally after successful credit consumption
      if (userEmail) {
        useBillingStore.getState().fetchBillingStatus(userEmail, true);
      }
      setCurrentMarketingAngleId(createdJob.id)

      // Show loading dialog
      setShowResearchLoading(true)
      setResearchProgress(0)
      setResearchStage(0)

      // Reset source status
      setSourceStatus(resetSourceStatus())

      // Start slow progress animation that accommodates variable processing times (5-8+ minutes)
      const startTime = Date.now()
      const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000 // seconds
        const estimatedMaxTime = 480 // 8 minutes in seconds
        const baseProgress = Math.min(85, (elapsed / estimatedMaxTime) * 85)

        setResearchProgress(prev => {
          return Math.max(prev, Math.floor(baseProgress))
        })

        // Update source status based on elapsed time
        const elapsedSeconds = elapsed
        if (elapsedSeconds >= 45) setSourceStatus(prev => ({ ...prev, webSearch: true }))
        if (elapsedSeconds >= 90) setSourceStatus(prev => ({ ...prev, amazonReviews: true }))
        if (elapsedSeconds >= 135) setSourceStatus(prev => ({ ...prev, redditDiscussions: true }))
        if (elapsedSeconds >= 180) setSourceStatus(prev => ({ ...prev, industryBlogs: true }))
        if (elapsedSeconds >= 225) setSourceStatus(prev => ({ ...prev, competitorAnalysis: true }))
      }, 1000)

      // Update stages based on elapsed time
      setTimeout(() => setResearchStage(1), 30000)   // Stage 1 at 30s
      setTimeout(() => setResearchStage(2), 90000)   // Stage 2 at 1.5min
      setTimeout(() => setResearchStage(3), 180000)  // Stage 3 at 3min
      setTimeout(() => setResearchStage(4), 300000)  // Stage 4 at 5min

      // Poll for job status
      const pollJobStatus = async () => {
        const maxAttempts = 180 // Max 15 minutes
        const pollInterval = 5000 // Poll every 5 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const statusAuth = getAuthToken() ? `Bearer ${getAuthToken()}` : `Bearer ${getUserEmail()}`
            const statusResponse = await fetch(`/api/jobs/${createdJob.id}/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: statusAuth,
              }
            })

            if (!statusResponse.ok) {
              throw new Error(`Status check failed: ${statusResponse.status}`)
            }

            const statusData = await statusResponse.json()
            const status = statusData.status?.toLowerCase()

            // Update progress and stage based on status
            if (status === 'submitted' || status === 'pending') {
              setResearchStage(1)
              setResearchProgress(prev => Math.max(prev, 15))
            } else if (status === 'running' || status === 'processing') {
              const elapsed = (Date.now() - startTime) / 1000
              if (elapsed > 180) {
                setResearchStage(3)
              } else if (elapsed > 90) {
                setResearchStage(2)
              }
              const progressFromTime = Math.min(85, 20 + (elapsed / 480) * 65)
              setResearchProgress(prev => Math.max(prev, Math.floor(progressFromTime)))
            } else if (status === 'completed' || status === 'succeeded') {
              clearInterval(progressInterval)
              setResearchStage(4)
              setResearchProgress(100)
              setSourceStatus(completeSourceStatus())

              // Wait a moment then redirect to results
              setTimeout(() => {
                setShowResearchLoading(false)
                setResearchProgress(0)
                setResearchStage(0)
                setCurrentMarketingAngleId(null)
                setSourceStatus(resetSourceStatus())

                // Reset form
                setFormData({
                  title: "",
                  sales_page_urls: [""],
                  research_requirements: "",
                  gender: "",
                  location: "",
                  advertorial_type: "Listicle",
                  target_product_name: "",
                })
                setErrors({})
                setGeneralError(null)

                // Redirect to results page
                router.push(`/results/${createdJob.id}`)
              }, 1000)
              return
            } else if (status === 'failed' || status === 'failure') {
              clearInterval(progressInterval)
              setShowResearchLoading(false)
              setResearchProgress(0)
              setResearchStage(0)
              setCurrentMarketingAngleId(null)
              setSourceStatus(resetSourceStatus())

              toast({
                title: "Error",
                description: "Job processing failed. Please try again.",
                variant: "destructive",
              })
              return
            }

            // If still processing, wait and try again
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval))
            }

          } catch (err) {
            if (attempt === maxAttempts) {
              clearInterval(progressInterval)
              setShowResearchLoading(false)
              setResearchProgress(0)
              setResearchStage(0)
              setCurrentMarketingAngleId(null)
              setSourceStatus(resetSourceStatus())

              toast({
                title: "Error",
                description: "Failed to check job status. Please check your jobs page.",
                variant: "destructive",
              })
              return
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval))
          }
        }

        // Timeout reached
        clearInterval(progressInterval)
        setShowResearchLoading(false)
        setResearchProgress(0)
        setResearchStage(0)
        setCurrentMarketingAngleId(null)
        setSourceStatus({
          webSearch: false,
          amazonReviews: false,
          redditDiscussions: false,
          industryBlogs: false,
          competitorAnalysis: false,
          marketTrends: false,
        })

        toast({
          title: "Processing Taking Longer",
          description: "Your job is still processing. This can take 5-8 minutes or more. Please check your jobs page for updates.",
          variant: "default",
        })
      }

      // Start polling
      pollJobStatus()

      // Reset loading state (polling happens in background)
      setIsLoading(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create job'
      const errorWithStatus = error as Error & { status?: number; currentUsage?: number; limit?: number }

      // Check if it's a usage limit error (429)
      if (errorWithStatus.status === 429) {
        setUsageLimitData({
          usageType: 'deep_research',
          currentUsage: errorWithStatus.currentUsage || 0,
          limit: errorWithStatus.limit || 0
        })
        setShowUsageLimitDialog(true)
        setIsLoading(false)
        return
      }

      // Show error toast for other errors
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

      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitForm()
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
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-16">
          <div className="p-4 md:p-6">
            <div className="mb-4 md:mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create New Content</h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">Generate AI-powered marketing content from your sales page</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="max-w-4xl mx-auto pb-8">
              <div className="space-y-8">
                {/* Header Section */}
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold text-foreground">Project Details</h2>
                  <p className="text-muted-foreground text-lg">Fill in your project information to generate AI-powered content</p>
                </div>

                {/* Main Form */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
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
                          placeholder="e.g., Product Launch Pre-Lander"
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

                      {/* Sales Page URLs Section */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-base font-semibold text-foreground">
                            Sales Page URLs <span className="text-destructive">*</span>
                          </Label>
                          <p className="text-sm text-muted-foreground">Add one or more URLs of your existing sales pages</p>
                        </div>
                        <div className="space-y-3">
                          {formData.sales_page_urls.map((url, index) => (
                            <div key={index} className="flex gap-2 items-start">
                              <Input
                                id={`sales_page_url_${index}`}
                                placeholder="https://example.com/current-page"
                                value={url}
                                onChange={(e) => {
                                  const newVal = e.target.value
                                  setFormData((prev) => ({
                                    ...prev,
                                    sales_page_urls: prev.sales_page_urls.map((u, i) => (i === index ? newVal : u)),
                                  }))
                                  if (errors.sales_page_urls) setErrors((prev) => ({ ...prev, sales_page_urls: undefined }))
                                  if (!hasSeenUrlPopup && isValidUrl(newVal)) {
                                    setShowUrlPopup(true)
                                    setHasSeenUrlPopup(true)
                                  }
                                }}
                                disabled={isLoading}
                                className={`flex-1 h-12 text-base ${errors.sales_page_urls ? "border-destructive focus-visible:ring-destructive" : "border-input focus-visible:ring-primary"}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                                disabled={isLoading || formData.sales_page_urls.length <= 1}
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    sales_page_urls: prev.sales_page_urls.filter((_, i) => i !== index),
                                  }))
                                  if (errors.sales_page_urls) setErrors((prev) => ({ ...prev, sales_page_urls: undefined }))
                                }}
                                aria-label="Remove URL"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={isLoading || formData.sales_page_urls.length >= 3}
                            onClick={() => setFormData((prev) => ({ ...prev, sales_page_urls: [...prev.sales_page_urls, ""] }))}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add another URL
                          </Button>
                        </div>
                        {errors.sales_page_urls && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {errors.sales_page_urls}
                          </p>
                        )}
                      </div>

                      {/* V2 Research Options Section */}
                      <div className="space-y-6"> 
                        {/* Research Requirements */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="research_requirements" className="text-base font-semibold text-foreground">
                              Research Requirements (Optional)
                            </Label>
                            <p className="text-sm text-muted-foreground">Specific focus areas or requirements for the research</p>
                            <Textarea
                              id="research_requirements"
                              placeholder="e.g., Focus on natural ingredients and FDA approval status"
                              value={formData.research_requirements || ''}
                              onChange={(e) => {
                                setFormData((prev) => ({ ...prev, research_requirements: e.target.value }))
                              }}
                              disabled={isLoading}
                              rows={3}
                              className="text-base"
                            />
                          </div>
                        </div>

                        {/* Target Product Name */}
                        <div className="space-y-2">
                          <Label htmlFor="target_product_name" className="text-base font-semibold text-foreground">
                            Target Product Name (Optional)
                          </Label>
                          <p className="text-sm text-muted-foreground">Name of the product to focus research on</p>
                          <Input
                            id="target_product_name"
                            placeholder="e.g., Premium Vitamin D3 Supplement"
                            value={formData.target_product_name || ''}
                            onChange={(e) => {
                              setFormData((prev) => ({ ...prev, target_product_name: e.target.value }))
                            }}
                            disabled={isLoading}
                            className="h-12 text-base"
                          />
                        </div>

                        {/* Target Demographics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="gender" className="text-base font-semibold text-foreground">
                              Target Gender (Optional)
                            </Label>
                            <p className="text-sm text-muted-foreground">Primary gender target</p>
                            <Select
                              value={formData.gender || ''}
                              onValueChange={(value) => {
                                setFormData((prev) => ({ ...prev, gender: value }))
                              }}
                              disabled={isLoading}
                            >
                              <SelectTrigger className="h-12 text-base">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Mixed">Mixed</SelectItem>
                                <SelectItem value="N/A">Not Specified</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="location" className="text-base font-semibold text-foreground">
                              Target Location (Optional)
                            </Label>
                            <p className="text-sm text-muted-foreground">Primary location or region</p>
                            <Input
                              id="location"
                              placeholder="e.g., USA, United States, Europe"
                              value={formData.location || ''}
                              onChange={(e) => {
                                setFormData((prev) => ({ ...prev, location: e.target.value }))
                              }}
                              disabled={isLoading}
                              className="h-12 text-base"
                            />
                          </div>
                        </div>

                        {/* Advertorial Type */}
                        {/* <div className="space-y-2">
                          <Label htmlFor="advertorial_type" className="text-base font-semibold text-foreground">
                            Advertorial Type
                          </Label>
                          <p className="text-sm text-muted-foreground">Type of content to generate</p>
                          <Select
                            value={formData.advertorial_type || 'Listicle'}
                            onValueChange={(value) => {
                              setFormData((prev) => ({ ...prev, advertorial_type: value }))
                            }}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Listicle">Listicle</SelectItem>
                              <SelectItem value="Advertorial">Advertorial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div> */}
                      </div>

                      {/* Error Summary */}
                      {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive" className="border-destructive/50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">Please fix the errors above before submitting.</AlertDescription>
                        </Alert>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-4 pt-4">
                        <div className="flex gap-4">
                        <Button
                          type="submit"
                          className="flex-1 h-12 text-base font-medium bg-primary hover:bg-primary/90"
                          disabled={isLoading || isFormEmpty()}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Content...
                            </>
                          ) : (
                            <div className="flex justify-center items-center">
                            <Sparkles className="mr-2 h-4 w-4" /> 
                            <span>
                              Generate AI Content ({JOB_CREDITS_BY_TYPE.deep_research} Credits) 
                            </span>
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Avatar Extraction Dialog removed - V2 handles this automatically */}


      {/* Research Generation Loading Dialog */}
      <Dialog open={showResearchLoading} onOpenChange={(open) => {
        if (!open) {
          setShowResearchLoading(false)
          // Redirect to dashboard when user closes the modal
          router.push('/dashboard')
        }
      }}>
        <DialogContent className="max-w-2xl border-border">
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-semibold text-primary text-center">
              Yes, our research takes a while… that's
              why it will convert!
            </p>
          </div>
          <div className="flex flex-col py-6 space-y-6">
            {/* Project Info */}
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Project</p>
                <p className="text-base font-semibold text-foreground">
                  {formData.title || 'Untitled Project'}
                </p>
              </div>
            </div>

            {/* Analyzing Sources */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Analyzing Sources:</h3>
              <div className="space-y-2">
                {/* Web Search */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5" style={{ color: '#3B82F6' }} />
                    <span className="text-sm font-medium text-foreground">Web Search</span>
                  </div>
                  {sourceStatus.webSearch ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Amazon Reviews */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <SiAmazon className="w-5 h-5" style={{ color: '#FF9900' }} />
                    <span className="text-sm font-medium text-foreground">Amazon Reviews</span>
                  </div>
                  {sourceStatus.amazonReviews ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Reddit Discussions */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <SiReddit className="w-5 h-5" style={{ color: '#FF4500' }} />
                    <span className="text-sm font-medium text-foreground">Reddit Discussions</span>
                  </div>
                  {sourceStatus.redditDiscussions ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Industry Blogs */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📝</span>
                    <span className="text-sm font-medium text-foreground">Industry Blogs</span>
                  </div>
                  {sourceStatus.industryBlogs ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Competitor Analysis */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔍</span>
                    <span className="text-sm font-medium text-foreground">Competitor Analysis</span>
                  </div>
                  {sourceStatus.competitorAnalysis ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>

                {/* Market Trends */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <span className="text-sm font-medium text-foreground">Market Trends</span>
                  </div>
                  {sourceStatus.marketTrends ? (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  )}
                </div>
              </div>
            </div>

            {/* Compiling Message - Show when all sources are complete but marketing angle is still processing */}
            {sourceStatus.webSearch &&
              sourceStatus.amazonReviews &&
              sourceStatus.redditDiscussions &&
              sourceStatus.industryBlogs &&
              sourceStatus.competitorAnalysis &&
              sourceStatus.marketTrends &&
              researchProgress < 100 && (
                <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Compiling Your Results</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All research sources have been analyzed. We're now generating your high-converting Pre-Landers...
                    </p>
                  </div>
                </div>
              )}

            {/* Information Message */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">You can close this window</p>
                  <p className="text-sm text-muted-foreground">
                    We'll send you an email notification when your Pre-Landers are ready. Feel free to continue working on other things.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Popup Dialog */}
      <Dialog open={showUrlPopup} onOpenChange={setShowUrlPopup}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-left text-base font-semibold text-foreground">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Info className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="flex-1">
                Important: <span className="font-normal text-foreground">Product URL</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-foreground text-sm leading-relaxed">
              Make sure to enter the URL of the product, service or offer you want to sell - not your general business URL.
            </p>
          </div>
          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setShowUrlPopup(false)}
              className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700 text-white px-6 font-normal"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Limit Dialog */}
      {usageLimitData && (
        <UsageLimitDialog
          open={showUsageLimitDialog}
          onOpenChange={setShowUsageLimitDialog}
          usageType={usageLimitData.usageType}
          currentUsage={usageLimitData.currentUsage}
          limit={usageLimitData.limit}
        />
      )}
    </ErrorBoundary>
  )
}
