"use client"

import type React from "react"

import { useState, useEffect, memo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, X, AlertCircle, Eye } from "lucide-react"
import { useTemplates } from "@/lib/hooks/use-templates"
import { useCreateJob } from "@/lib/hooks/use-jobs"
import { useAuthStore } from "@/stores/auth-store"
import { TemplatePreview } from "@/components/template-preview"
import { Template } from "@/lib/db/types"
import { logger } from "@/lib/utils/logger"

interface PipelineFormData {
  title: string
  brand_info: string
  sales_page_url?: string
  template_id?: string
  advertorial_type: string
  persona?: string
  age_range?: string
  gender?: string
}

interface PipelineFormProps {
  onSubmit?: (data: PipelineFormData) => Promise<void>
  isLoading?: boolean
}

function PipelineFormComponent({ onSubmit, isLoading = false }: PipelineFormProps) {
  // Use TanStack Query for templates data
  const { data: templates = [], isLoading: templatesLoading } = useTemplates()
  const createJobMutation = useCreateJob()
  const { user } = useAuthStore()

  // Local state for selected template
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

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

  // Check if all required fields are empty
  const isFormEmpty = (): boolean => {
    // Check if title is empty
    if (formData.title.trim()) {
      return false
    }

    // Check if template_id is selected
    if (formData.template_id) {
      return false
    }

    // Check if advertorial_type is selected
    if (formData.advertorial_type) {
      return false
    }

    return true
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    if (!formData.title.trim()) {
      newErrors.title = "Project title is required"
    }

    if (!formData.template_id) {
      newErrors.template_id = "Template selection is required"
    }

    if (!formData.advertorial_type) {
      newErrors.advertorial_type = "Advertorial type is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      if (onSubmit) {
        await onSubmit(formData)
      } else {
        // Use mutation if no onSubmit prop
        await createJobMutation.mutateAsync({
          title: formData.title,
          brand_info: formData.brand_info,
          sales_page_url: formData.sales_page_url,
          template_id: formData.template_id,
          advertorial_type: formData.advertorial_type || 'Advertorial',
          target_approach: 'explore',
          avatars: [],
        })
      }

      // Reset form on success
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
    } catch (error) {
      logger.error('Form submission error:', error)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t: Template) => t.id === templateId)
    setFormData(prev => ({ ...prev, template_id: templateId }))
    setSelectedTemplate(template || null)
    if (errors.template_id) setErrors(prev => ({ ...prev, template_id: undefined }))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create New AI Content</CardTitle>
        <CardDescription>Generate marketing content using our AI-powered templates</CardDescription>
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
            <Label htmlFor="sales_page_url">Current Sales Page URL (Optional)</Label>
            <Input
              id="sales_page_url"
              placeholder="https://example.com/current-page"
              value={formData.sales_page_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, sales_page_url: e.target.value }))}
              disabled={isLoading}
            />
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
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Select Template <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templatesLoading ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No templates available
                </div>
              ) : (
                templates.map((template: Template) => (
                  <TemplatePreview
                    key={template.id}
                    template={template}
                    isSelected={formData.template_id === template.id}
                    onClick={() => handleTemplateChange(template.id)}
                  />
                ))
              )}
            </div>
            {errors.template_id && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.template_id}
              </p>
            )}
          </div>

          {Object.keys(errors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please fix the errors above before submitting.</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || isFormEmpty()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Content...
              </>
            ) : (
              "Generate AI Content"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Memoize component to prevent unnecessary re-renders
export const PipelineForm = memo(PipelineFormComponent)
