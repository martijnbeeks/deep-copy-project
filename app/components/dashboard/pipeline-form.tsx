"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, X, AlertCircle, Eye } from "lucide-react"
import { useTemplatesStore } from "@/stores/templates-store"
import { useJobsStore } from "@/stores/jobs-store"
import { useAuthStore } from "@/stores/auth-store"

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
  const [showTemplatePreview, setShowTemplatePreview] = useState(false)

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
            <Label htmlFor="template_id">
              Select Template <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.template_id}
              onValueChange={handleTemplateChange}
              disabled={isLoading}
            >
              <SelectTrigger className={errors.template_id ? "border-destructive" : ""}>
                <SelectValue placeholder="Choose a template for your content" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{template.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {template.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.template_id && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.template_id}
              </p>
            )}
            {selectedTemplate && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedTemplate.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>
            )}
          </div>

          {showTemplatePreview && selectedTemplate && (
            <div className="space-y-2">
              <Label>Template Preview</Label>
              <div className="border rounded-lg p-4 bg-muted max-h-96 overflow-auto">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }}
                />
              </div>
            </div>
          )}

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
