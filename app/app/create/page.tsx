"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle, Info, Zap, CheckCircle } from "lucide-react"
import { useJobsStore } from "@/stores/jobs-store"
import { useAuthStore } from "@/stores/auth-store"
import { useRouter } from "next/navigation"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { ErrorBoundary } from "@/components/ui/error-boundary"
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
  target_approach?: string
  customer_avatars?: CustomerAvatar[]
  extracted_avatars?: CustomerAvatar[]
  // Deprecated fields for backward compatibility
  persona?: string
  age_range?: string
  gender?: string
}

export default function CreatePage() {
  const { createJob } = useJobsStore()
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()

  // Use auto-polling for processing jobs (hits DeepCopy API directly)
  const { processingJobsCount } = useAutoPolling()
  const { toast } = useToast()

  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    brand_info: "",
    sales_page_url: "",
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

  // Avatar extraction dialog state
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  
  // URL popup state
  const [showUrlPopup, setShowUrlPopup] = useState(false)
  const [hasSeenUrlPopup, setHasSeenUrlPopup] = useState(false)
  
  // Research generation loading state
  const [showResearchLoading, setShowResearchLoading] = useState(false)
  const [researchProgress, setResearchProgress] = useState(0)
  const [researchStage, setResearchStage] = useState(0)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  
  // URL validation function
  const isValidUrl = (url: string): boolean => {
    if (!url || url.trim().length === 0) return false
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push("/login")
      return
    }
  }, [isAuthenticated, user, router])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    // Validate Project Details
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
    // For "explore" approach, ensure avatars were generated and selected
    if (formData.target_approach === 'explore' && formData.customer_avatars.length === 0) {
      newErrors.customer_avatars = "Please generate and select avatars before proceeding"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // If user selected "explore new avatars" but hasn't selected any yet, show the extraction dialog
    if (formData.target_approach === 'explore' && (formData.customer_avatars?.length ?? 0) === 0) {
      setShowAvatarDialog(true)
      return
    }
    
    // Validate form before submitting
    if (!validateForm()) return

    // Prevent duplicate submissions
    if (isLoading) return

    // For "known" approach, proceed with normal submission
    try {
      setIsLoading(true)
      const createdJob = await createJob(formData)

      // Set job ID for polling
      setCurrentJobId(createdJob.id)
      
      // Show research generation loading dialog
      setShowResearchLoading(true)
      setResearchProgress(0)
      setResearchStage(0)
      
      // Start progress animation
      const progressInterval = setInterval(() => {
        setResearchProgress(prev => {
          if (prev >= 90) {
            return 90 // Keep at 90% until completion
          }
          return prev + 1
        })
      }, 200)

      // Update stages based on progress (slower transitions)
      setTimeout(() => setResearchStage(1), 5000)   // Stage 1 at 5s
      setTimeout(() => setResearchStage(2), 10000)   // Stage 2 at 10s
      setTimeout(() => setResearchStage(3), 15000)   // Stage 3 at 15s
      setTimeout(() => setResearchStage(4), 20000)   // Stage 4 at 20s

      // Poll for job status
      const pollJobStatus = async () => {
        const maxAttempts = 120 // Max 10 minutes (120 * 5s)
        const pollInterval = 5000 // Poll every 5 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const response = await fetch(`/api/jobs/${createdJob.id}/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            })

            if (!response.ok) {
              throw new Error(`Status check failed: ${response.status}`)
            }

            const data = await response.json()
            const status = data.status?.toLowerCase()

            // Update progress based on status
            if (status === 'submitted') {
              setResearchStage(1)
              setResearchProgress(25)
            } else if (status === 'running' || status === 'processing') {
              setResearchStage(2)
              setResearchProgress(50)
            } else if (status === 'completed' || status === 'succeeded') {
              clearInterval(progressInterval)
              setResearchStage(4)
              setResearchProgress(100)
              
              // Wait a moment then redirect to results
              setTimeout(() => {
                setShowResearchLoading(false)
                setResearchProgress(0)
                setResearchStage(0)
                setCurrentJobId(null)
                
                // Reset form
                setFormData({
                  title: "",
                  brand_info: "",
                  sales_page_url: "",
                  target_approach: "explore",
                  customer_avatars: [],
                  persona: "",
                  age_range: "",
                  gender: "",
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
              setCurrentJobId(null)
              
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
              setCurrentJobId(null)
              
              toast({
                title: "Error",
                description: "Failed to check job status. Please check your jobs page.",
                variant: "destructive",
              })
              return
            }
            // Continue polling on intermediate errors
            await new Promise(resolve => setTimeout(resolve, pollInterval))
          }
        }

        // Timeout reached
        clearInterval(progressInterval)
        setShowResearchLoading(false)
        setResearchProgress(0)
        setResearchStage(0)
        setCurrentJobId(null)
        
        toast({
          title: "Timeout",
          description: "Job is taking longer than expected. Please check your jobs page.",
          variant: "default",
        })
      }

      // Start polling
      pollJobStatus()
      
      // Reset loading state (polling happens in background)
      setIsLoading(false)
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
    } catch (error) {
      console.error('Error updating avatars:', error)
      toast({
        title: "Error",
        description: "Failed to update avatar selection. Please try again.",
        variant: "destructive",
      })
    }
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
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-16">
          <div className="p-4 md:p-6 overflow-y-auto h-full">
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

            <div className="max-w-4xl mx-auto">
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
                            onChange={(e) => {
                              const newUrl = e.target.value
                              setFormData((prev) => ({ ...prev, sales_page_url: newUrl }))
                              
                              // Show popup when valid URL is entered (only once)
                              if (!hasSeenUrlPopup && isValidUrl(newUrl)) {
                                setShowUrlPopup(true)
                                setHasSeenUrlPopup(true)
                              }
                            }}
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
                                  ? 'border-primary bg-primary/5 shadow-sm'
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
                                  ? 'border-primary bg-primary/5 shadow-sm'
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
                            type="submit"
                            className="flex-1 h-12 text-base font-medium bg-primary hover:bg-primary/90"
                            disabled={isLoading}
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
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
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

      {/* Research Generation Loading Dialog */}
      <Dialog open={showResearchLoading} onOpenChange={(open) => {
        if (!open) {
          setShowResearchLoading(false)
        }
      }}>
        <DialogContent className="max-w-lg border-border">
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {/* Animated Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <Zap className="w-10 h-10 text-primary-foreground animate-pulse" />
              </div>
            </div>

            {/* Title - Changes based on stage */}
            <h3 className="text-2xl font-bold text-foreground text-center animate-fade-in">
              {researchStage === 0 && "Scanning Market Sources"}
              {researchStage === 1 && "Analyzing Customer Reviews"}
              {researchStage === 2 && "Evaluating Competitors"}
              {researchStage === 3 && "Mining Reddit & Forums"}
              {researchStage === 4 && "Generating Copy Angles"}
            </h3>

            {/* Stage-specific messages */}
            <div className="space-y-3 w-full animate-fade-in">
              {researchStage === 0 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Checking Amazon reviews, industry publications, and market databases...
                  </p>
                </div>
              )}
              
              {researchStage === 1 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Analyzing customer feedback, pain points, and satisfaction patterns...
                  </p>
                </div>
              )}

              {researchStage === 2 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Scanning competitor landing pages and dissecting their messaging strategies...
                  </p>
                </div>
              )}

              {researchStage === 3 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Extracting insights from Reddit discussions, forums, and community feedback...
                  </p>
                </div>
              )}

              {researchStage === 4 && (
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Creating compelling marketing angles and high-converting copy variations...
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Deep-diving into market research and competitive analysis
            </p>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground text-center">
                💡 You can close this dialog and check your dashboard. We'll notify you when the research is complete.
              </p>
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
    </ErrorBoundary>
  )
}
