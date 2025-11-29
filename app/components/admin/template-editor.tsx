"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save } from "lucide-react"
import { TemplateTester } from "@/components/admin/template-tester"
// Removed complex field validation - keeping it simple

interface TemplateEditorProps {
  template: {
    id?: string
    name: string
    type: 'listicle' | 'advertorial'
    description: string
    htmlContent: string
  }
  onSave: (template: any) => void
  onCancel: () => void
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [formData, setFormData] = useState(template)
  const [activeTab, setActiveTab] = useState("basic")

  // Simple template editor - no complex field extraction needed

  // Simple template editor - no complex field management needed

  const handleBasicChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setFormData(prev => ({ ...prev, htmlContent: content }))
      }
      reader.readAsText(file)
    }
  }

  const handleSave = () => {
    onSave(formData)
  }

  const loadTemplateFromSwipe = async (templateName: string) => {
    try {
      if (templateName === 'blank') {
        setFormData(prev => ({ ...prev, htmlContent: '' }))
        return
      }

      // Load template from swipe_templates folder
      const response = await fetch(`/api/admin/load-swipe-template?template=${templateName}`)
      if (response.ok) {
        const data = await response.json()
        setFormData(prev => ({
          ...prev,
          htmlContent: data.htmlContent,
          name: data.name || prev.name,
          type: data.type || prev.type
        }))
      } else {
        console.error('Failed to load template:', templateName)
      }
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }

  // Removed complex sections - keeping it simple

  return (
    <div className="space-y-6 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Template Editor</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Create and edit injectable templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} type="button" className="h-8">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Simple Status */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Upload your HTML template or paste content below. The system will automatically detect placeholders like{" "}
          <code className="bg-background border border-border px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
            {"{{content.hero.headline}}"}
          </code>
          {" "}for dynamic content injection.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 h-9">
          <TabsTrigger value="basic" className="text-xs">Basic Info</TabsTrigger>
          <TabsTrigger value="html" className="text-xs">HTML Editor</TabsTrigger>
          <TabsTrigger value="test" className="text-xs">Test</TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="templateName" className="text-xs font-medium">Template Name</Label>
              <Input
                id="templateName"
                value={formData.name}
                onChange={(e) => handleBasicChange('name', e.target.value)}
                placeholder="My Injectable Template"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="templateType" className="text-xs font-medium">Type</Label>
              <Select
                value={formData.type || 'listicle'}
                onValueChange={(value: 'listicle' | 'advertorial') => handleBasicChange('type', value)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listicle">Listicle</SelectItem>
                  <SelectItem value="advertorial">Advertorial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="templateId" className="text-xs font-medium">
              Template ID <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="templateId"
              value={formData.id || ''}
              onChange={(e) => handleBasicChange('id', e.target.value)}
              placeholder="custom-template-id"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to auto-generate
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="templateDescription" className="text-xs font-medium">Description</Label>
            <Input
              id="templateDescription"
              value={formData.description}
              onChange={(e) => handleBasicChange('description', e.target.value)}
              placeholder="Brief description of the template"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="templateFile" className="text-xs font-medium">Upload HTML File</Label>
            <Input
              id="templateFile"
              type="file"
              accept=".html"
              onChange={handleFileUpload}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload an HTML file or edit content in the HTML Editor tab
            </p>
          </div>
        </TabsContent>


        {/* HTML Editor Tab */}
        <TabsContent value="html" className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">HTML Editor</Label>
            <Textarea
              value={formData.htmlContent}
              onChange={(e) => handleBasicChange('htmlContent', e.target.value)}
              placeholder="Paste your HTML template content here..."
              rows={25}
              className="font-mono text-xs resize-none"
            />
          </div>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-4">
          <TemplateTester
            htmlContent={formData.htmlContent}
            templateName={formData.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
