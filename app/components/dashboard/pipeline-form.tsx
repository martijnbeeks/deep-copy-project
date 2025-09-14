"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Plus, X, AlertCircle, Eye } from "lucide-react"
import { useTemplatesStore } from "@/stores/templates-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useAuthStore } from "@/stores/auth-store"
import { TemplatePreview } from "@/components/template-preview"

interface PipelineFormData {
  title: string
  brand_info: string
  sales_page_url?: string
  template_id?: string
}

interface PipelineFormProps {
  onSubmit?: (data: PipelineFormData) => Promise<void>
  isLoading?: boolean
}

export function PipelineForm({ onSubmit, isLoading = false }: PipelineFormProps) {
  const { templates, fetchTemplates, selectedTemplate, setSelectedTemplate } = useTemplatesStore()
  const { createJob } = useJobsStore()
  const { user } = useAuthStore()
  
  const [formData, setFormData] = useState<PipelineFormData>({
    title: "",
    brand_info: "",
    sales_page_url: "",
    template_id: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PipelineFormData, string>>>({})

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PipelineFormData, string>> = {}

    if (!formData.title.trim()) {
      newErrors.title = "Project title is required"
    }

    if (!formData.brand_info.trim()) {
      newErrors.brand_info = "Brand information is required"
    } else if (formData.brand_info.trim().length < 10) {
      newErrors.brand_info = "Brand information must be at least 10 characters"
    }

    if (!formData.template_id) {
      newErrors.template_id = "Template selection is required"
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
        // Use store directly if no onSubmit prop
        await createJob(formData)
      }
      
      // Reset form on success
      setFormData({
        title: "",
        brand_info: "",
        sales_page_url: "",
        template_id: "",
      })
      setSelectedTemplate(null)
      setErrors({})
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
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

          <div className="space-y-2">
            <Label>
              Select Template <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <Button type="submit" className="w-full" disabled={isLoading}>
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
