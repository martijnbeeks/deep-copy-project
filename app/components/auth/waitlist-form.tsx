"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, ArrowLeft, ArrowRight, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { isValidEmail, isValidUrl, normalizeUrl } from "@/lib/utils/validation"
import { cn } from "@/lib/utils"

interface WaitlistFormProps {
  onSuccess?: () => void
}

interface WaitlistFormData {
  name: string
  email: string
  company_website: string
  platforms: string[]
  shopify_app_name: string
  platform_other: string
  monthly_volume: '' | 'below-10' | '10-50' | '50-plus'
  interest_reasons: string[]
  interest_other: string
}

const TOTAL_STEPS = 6 // 6 form steps (welcome page commented out)

export function WaitlistForm({ onSuccess }: WaitlistFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepErrors, setStepErrors] = useState<Record<number, string>>({})
  const { toast } = useToast()

  const [formData, setFormData] = useState<WaitlistFormData>({
    name: "",
    email: "",
    company_website: "",
    platforms: [],
    shopify_app_name: "",
    platform_other: "",
    monthly_volume: '',
    interest_reasons: [],
    interest_other: "",
  })

  // Reset body scroll when form opens/closes
  useEffect(() => {
    if (currentStep >= 0 && !isSuccess) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [currentStep, isSuccess])

  const validateStep = (step: number): boolean => {
    const errors: Record<number, string> = {}
    
    switch (step) {
      case 0: // Name
        if (!formData.name.trim()) {
          errors[0] = "Name is required"
          return false
        }
        break
      case 1: // Email
        if (!formData.email.trim()) {
          errors[1] = "Email is required"
          return false
        }
        if (!isValidEmail(formData.email)) {
          errors[1] = "Please enter a valid email address"
          return false
        }
        break
      case 2: // Company website
        if (!formData.company_website.trim()) {
          errors[2] = "Company website is required"
          return false
        }
        if (!isValidUrl(formData.company_website)) {
          errors[2] = "Please enter a valid URL"
          return false
        }
        break
      case 3: // Platforms
        if (formData.platforms.length === 0) {
          errors[3] = "Please select at least one option"
          return false
        }
        if (formData.platforms.includes('shopify') && !formData.shopify_app_name.trim()) {
          errors[3] = "Please specify the Shopify app name"
          return false
        }
        if (formData.platforms.includes('other') && !formData.platform_other.trim()) {
          errors[3] = "Please specify the other platform"
          return false
        }
        break
      case 4: // Monthly volume
        if (!formData.monthly_volume) {
          errors[4] = "Please select an option"
          return false
        }
        break
      case 5: // Interest reasons
        if (formData.interest_reasons.length === 0) {
          errors[5] = "Please select at least one option"
          return false
        }
        if (formData.interest_reasons.includes('other') && !formData.interest_other.trim()) {
          errors[5] = "Please specify the other reason"
          return false
        }
        break
    }

    setStepErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS - 1) {
        setCurrentStep(currentStep + 1)
        setError(null)
      } else {
        handleSubmit()
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setError(null)
      setStepErrors({})
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          name: formData.name.trim(),
          company_website: normalizeUrl(formData.company_website.trim()),
          platforms: formData.platforms,
          shopify_app_name: formData.platforms.includes('shopify') ? formData.shopify_app_name.trim() : undefined,
          platform_other: formData.platforms.includes('other') ? formData.platform_other.trim() : undefined,
          monthly_volume: formData.monthly_volume,
          interest_reasons: formData.interest_reasons,
          interest_other: formData.interest_reasons.includes('other') ? formData.interest_other.trim() : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist')
      }

      setIsSuccess(true)

      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 3000)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join waitlist'
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setFormData(prev => {
      const newPlatforms = prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
      return {
        ...prev,
        platforms: newPlatforms,
        // Clear conditional fields if option is deselected
        shopify_app_name: newPlatforms.includes('shopify') ? prev.shopify_app_name : '',
        platform_other: newPlatforms.includes('other') ? prev.platform_other : '',
      }
    })
    // Clear error when user makes a selection
    if (stepErrors[3]) {
      setStepErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[3]
        return newErrors
      })
    }
  }

  const toggleInterestReason = (reason: string) => {
    setFormData(prev => {
      const newReasons = prev.interest_reasons.includes(reason)
        ? prev.interest_reasons.filter(r => r !== reason)
        : [...prev.interest_reasons, reason]
      return {
        ...prev,
        interest_reasons: newReasons,
        // Clear conditional field if option is deselected
        interest_other: newReasons.includes('other') ? prev.interest_other : '',
      }
    })
    // Clear error when user makes a selection
    if (stepErrors[5]) {
      setStepErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[5]
        return newErrors
      })
    }
  }

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="w-full max-w-2xl px-6 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-bold">You're on the list!</h2>
            <p className="text-lg text-muted-foreground">
              We'll notify you when we launch. Thanks for your interest!
            </p>
          </div>
        </div>
      </div>
    )
  }

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Progress indicator */}
      <div className="absolute top-6 left-6 text-sm text-muted-foreground">
        Step {currentStep + 1} of {TOTAL_STEPS}
      </div>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (onSuccess) {
            onSuccess()
          }
        }}
        className="absolute top-6 right-6"
        aria-label="Close form"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Main content */}
      <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl">
          <div className="relative">
            {/* Question container with slide animation */}
            <div 
              key={currentStep}
              className="animate-in fade-in slide-in-from-right-4 duration-300"
            >
              {/* Step 0: Welcome Page - COMMENTED OUT */}
              {/* {currentStep === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10 text-center">
                  <div className="space-y-6 w-full">
                    <div className="space-y-3">
                      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.2]">
                        <span className="inline-block">Turn </span>
                        <span className="inline-block text-primary">Deep Research</span>
                      </h1>
                      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.2]">
                        <span className="inline-block">Into</span>
                      </h1>
                      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.2]">
                        <span className="inline-block">High-Converting </span>
                        <span className="inline-block text-primary">Pre-Landers</span>
                      </h1>
                    </div>
                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                      Transform customer insights into conversion-optimized Pre-Landers with AI-powered deep research.
                    </p>
                  </div>
                </div>
              )} */}

              {/* Step 0: Name (was Step 1) */}
              {currentStep === 0 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                      What's your name? <span className="text-destructive">*</span>
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, name: e.target.value }))
                        if (stepErrors[0]) {
                          setStepErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors[0]
                            return newErrors
                          })
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && formData.name.trim()) {
                          handleNext()
                        }
                      }}
                      className="h-14 text-lg bg-background border-2 focus:border-primary transition-colors"
                      autoFocus
                    />
                    {stepErrors[0] && (
                      <p className="text-sm text-destructive">{stepErrors[0]}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 1: Email (was Step 2) */}
              {currentStep === 1 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                      What's your email? <span className="text-destructive">*</span>
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }))
                        if (stepErrors[1]) {
                          setStepErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors[1]
                            return newErrors
                          })
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && formData.email.trim() && isValidEmail(formData.email)) {
                          handleNext()
                        }
                      }}
                      className="h-14 text-lg bg-background border-2 focus:border-primary transition-colors"
                      autoFocus
                    />
                    {stepErrors[1] && (
                      <p className="text-sm text-destructive">{stepErrors[1]}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Company website (was Step 3) */}
              {currentStep === 2 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                      What's your company website? <span className="text-destructive">*</span>
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={formData.company_website}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, company_website: e.target.value }))
                        if (stepErrors[2]) {
                          setStepErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors[2]
                            return newErrors
                          })
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const normalized = normalizeUrl(formData.company_website.trim())
                          if (formData.company_website.trim() && isValidUrl(normalized)) {
                            handleNext()
                          }
                        }
                      }}
                      className="h-14 text-lg bg-background border-2 focus:border-primary transition-colors"
                      autoFocus
                    />
                    {stepErrors[2] && (
                      <p className="text-sm text-destructive">{stepErrors[2]}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Platforms (was Step 4) */}
              {currentStep === 3 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                      What platform are you using to make pre-landers?
                    </h2>
                    <p className="text-lg text-muted-foreground mt-2">
                      Multiple answers are possible
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.platforms.includes('funnelish')}
                          onCheckedChange={() => togglePlatform('funnelish')}
                        />
                        <span className="text-lg">Funnelish</span>
                      </label>

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.platforms.includes('checkoutchamp')}
                          onCheckedChange={() => togglePlatform('checkoutchamp')}
                        />
                        <span className="text-lg">CheckoutChamp</span>
                      </label>

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.platforms.includes('shopify')}
                          onCheckedChange={() => togglePlatform('shopify')}
                        />
                        <span className="text-lg">Shopify app, namely</span>
                      </label>
                      {formData.platforms.includes('shopify') && (
                        <div className="ml-11">
                          <Input
                            type="text"
                            placeholder="Enter Shopify app name"
                            value={formData.shopify_app_name}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, shopify_app_name: e.target.value }))
                              if (stepErrors[3]) {
                                setStepErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors[3]
                                  return newErrors
                                })
                              }
                            }}
                            className="h-12 text-base bg-background border-2 focus:border-primary transition-colors"
                            autoFocus
                          />
                        </div>
                      )}

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.platforms.includes('none')}
                          onCheckedChange={() => togglePlatform('none')}
                        />
                        <span className="text-lg">Don't make pre-landers yet</span>
                      </label>

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.platforms.includes('other')}
                          onCheckedChange={() => togglePlatform('other')}
                        />
                        <span className="text-lg">Other, namely</span>
                      </label>
                      {formData.platforms.includes('other') && (
                        <div className="ml-11">
                          <Input
                            type="text"
                            placeholder="Enter other platform name"
                            value={formData.platform_other}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, platform_other: e.target.value }))
                              if (stepErrors[3]) {
                                setStepErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors[3]
                                  return newErrors
                                })
                              }
                            }}
                            className="h-12 text-base bg-background border-2 focus:border-primary transition-colors"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                    {stepErrors[3] && (
                      <p className="text-sm text-destructive">{stepErrors[3]}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Monthly volume (was Step 5) */}
              {currentStep === 4 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                      How many pre-landers would you like to make a month?
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <RadioGroup
                      value={formData.monthly_volume}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, monthly_volume: value as 'below-10' | '10-50' | '50-plus' }))
                        if (stepErrors[4]) {
                          setStepErrors(prev => {
                            const newErrors = { ...prev }
                            delete newErrors[4]
                            return newErrors
                          })
                        }
                      }}
                      className="space-y-3"
                    >
                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <RadioGroupItem value="below-10" id="below-10" />
                        <span className="text-lg flex-1">Below 10</span>
                      </label>
                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <RadioGroupItem value="10-50" id="10-50" />
                        <span className="text-lg flex-1">10-50</span>
                      </label>
                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <RadioGroupItem value="50-plus" id="50-plus" />
                        <span className="text-lg flex-1">50 or more</span>
                      </label>
                    </RadioGroup>
                    {stepErrors[4] && (
                      <p className="text-sm text-destructive">{stepErrors[4]}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Interest reasons (was Step 6) */}
              {currentStep === 5 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                      Why are you interested in DeepCopy?
                    </h2>
                    <p className="text-lg text-muted-foreground mt-2">
                      Multiple answers are possible
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.interest_reasons.includes('autopilot')}
                          onCheckedChange={() => toggleInterestReason('autopilot')}
                        />
                        <span className="text-lg">Creating converting pre-landers on autopilot</span>
                      </label>

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.interest_reasons.includes('customer-insights')}
                          onCheckedChange={() => toggleInterestReason('customer-insights')}
                        />
                        <span className="text-lg">Deeper understanding of customer</span>
                      </label>

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.interest_reasons.includes('team-efficiency')}
                          onCheckedChange={() => toggleInterestReason('team-efficiency')}
                        />
                        <span className="text-lg">Reducing team size while increasing output</span>
                      </label>

                      <label className="flex items-center space-x-3 p-4 rounded-lg border-2 border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={formData.interest_reasons.includes('other')}
                          onCheckedChange={() => toggleInterestReason('other')}
                        />
                        <span className="text-lg">Other:</span>
                      </label>
                      {formData.interest_reasons.includes('other') && (
                        <div className="ml-11">
                          <Input
                            type="text"
                            placeholder="Enter other reason"
                            value={formData.interest_other}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, interest_other: e.target.value }))
                              if (stepErrors[5]) {
                                setStepErrors(prev => {
                                  const newErrors = { ...prev }
                                  delete newErrors[5]
                                  return newErrors
                                })
                              }
                            }}
                            className="h-12 text-base bg-background border-2 focus:border-primary transition-colors"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                    {stepErrors[5] && (
                      <p className="text-sm text-destructive">{stepErrors[5]}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-12">
              <Button
                variant="ghost"
                onClick={currentStep === 0 && onSuccess ? () => onSuccess() : handleBack}
                disabled={currentStep === 0 || isLoading}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </Button>

              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2 min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : currentStep === TOTAL_STEPS - 1 ? (
                  <>
                    Submit
                    <CheckCircle className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Global error message */}
            {error && (
              <Alert variant="destructive" className="mt-6 border-destructive/50">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
