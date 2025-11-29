"use client"

import { useState, useEffect } from "react"
import { AdminAuth } from "@/components/admin/admin-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { RefreshCw, CheckCircle, AlertCircle, Users, FileText, Database, Plus, Trash2, Upload, Eye, LogOut, Briefcase, Copy, Building2 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast } from "@/hooks/use-toast"
import { TemplateEditor } from "@/components/admin/template-editor"
import { TemplateTester } from "@/components/admin/template-tester"
import { AdminUsersTab } from "@/components/admin/admin-users-tab"
import { UsageLimitsTab } from "@/components/admin/usage-limits-tab"
import { useTemplates } from "@/lib/hooks/use-templates"
import { TemplatePreview } from "@/components/template-preview"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Template } from "@/lib/db/types"

interface UserOrganization {
  id: string
  name: string
  role: string
  status: string
}

interface User {
  id: string
  email: string
  name: string
  created_at: string
  organizations: UserOrganization[]
}

interface Job {
  id: string
  title: string
  status: string
  created_at: string
  user_email: string
  template_name: string | null
  template_id: string | null
}

interface InjectableTemplate {
  id: string
  name: string
  type: 'listicle' | 'advertorial'
  html_content: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Using Template from lib/db/types instead

interface DatabaseStats {
  users: number
  templates: number
  jobs: number
  results: number
}

interface InviteLink {
  id: string
  token: string
  invite_type: string
  waitlist_email?: string | null
  expires_at: string
  used_at?: string | null
  created_at: string
}

interface JobStatus {
  status: string
  count: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [injectableTemplates, setInjectableTemplates] = useState<InjectableTemplate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([])
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [isCreatingInviteLink, setIsCreatingInviteLink] = useState(false)

  // Template grid view state
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const templatesPerPage = 9

  // Use the same hook as /templates route
  const { data: allTemplates = [], isLoading: templatesLoading } = useTemplates()

  // Invite link form state
  const [newInviteLink, setNewInviteLink] = useState({ waitlist_email: '', expiration_days: '7', expiration_hours: '' })
  const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = useState(false)

  // Form states
  const [newTemplate, setNewTemplate] = useState({ id: '', name: '', description: '', category: '', htmlContent: '' })
  const [newInjectableTemplate, setNewInjectableTemplate] = useState({ id: '', name: '', type: 'listicle' as 'listicle' | 'advertorial', description: '', htmlContent: '' })
  const [templateFile, setTemplateFile] = useState<File | null>(null)

  // Dialog states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [injectableTemplateDialogOpen, setInjectableTemplateDialogOpen] = useState(false)
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<InjectableTemplate | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<{ id: string; name: string; description: string | null; category: string | null; created_at: string; content_length: number; html_content: string } | null>(null)
  const [previewInjectableTemplate, setPreviewInjectableTemplate] = useState<InjectableTemplate | null>(null)

  // Check if already authenticated
  useEffect(() => {
    const sessionToken = sessionStorage.getItem('adminSessionToken')
    if (sessionToken) {
      setIsAuthenticated(true)
      loadData()
    }
  }, [])

  // Helper function to get auth headers
  const getAuthHeaders = (): Record<string, string> => {
    const sessionToken = sessionStorage.getItem('adminSessionToken')
    const headers: Record<string, string> = {}
    if (sessionToken) {
      headers['x-admin-session'] = sessionToken
    }
    return headers
  }

  // Filter templates by category
  const filteredTemplates = allTemplates.filter(template => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    return matchesCategory
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredTemplates.length / templatesPerPage)
  const startIndex = (currentPage - 1) * templatesPerPage
  const endIndex = startIndex + templatesPerPage
  const currentTemplates = filteredTemplates.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Reset to first page when category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory])

  // Load all data
  const loadData = async () => {
    setLoading(true)
    try {
      const [injectableTemplatesRes, jobsRes, statsRes, inviteLinksRes] = await Promise.all([
        fetch('/api/admin/injectable-templates', { headers: getAuthHeaders() }),
        fetch('/api/admin/jobs', { headers: getAuthHeaders() }),
        fetch('/api/admin/stats', { headers: getAuthHeaders() }),
        fetch('/api/admin/invite-links', { headers: getAuthHeaders() })
      ])

      if (injectableTemplatesRes.ok) {
        const injectableTemplatesData = await injectableTemplatesRes.json()
        setInjectableTemplates(injectableTemplatesData)
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        setJobs(jobsData.jobs)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.stats)
        setJobStatuses(statsData.jobStatuses)
      }

      if (inviteLinksRes.ok) {
        const inviteLinksData = await inviteLinksRes.json()
        setInviteLinks(inviteLinksData.invite_links || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Invalidate templates cache after creating/deleting
  const invalidateTemplates = () => {
    // The useTemplates hook will automatically refetch when we trigger a reload
    // We can use queryClient if needed, but for now just reloading data is fine
  }



  // Template management
  const handleTemplateFile = (file: File) => {
    setTemplateFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setNewTemplate(prev => ({
        ...prev,
        htmlContent: e.target?.result as string || '',
        name: file.name.replace('.html', '')
      }))
    }
    reader.readAsText(file)
  }

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.htmlContent) {
      toast({
        title: "Error",
        description: "Name and HTML content are required",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(newTemplate)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Template uploaded successfully"
        })
        setNewTemplate({ id: '', name: '', description: '', category: '', htmlContent: '' })
        setTemplateFile(null)
        setTemplateDialogOpen(false)
        // Reload window to refresh templates from useTemplates hook
        window.location.reload()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload template",
        variant: "destructive"
      })
    }
  }

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/templates?id=${templateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Template deleted successfully"
        })
        // Reload window to refresh templates from useTemplates hook
        window.location.reload()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive"
      })
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('adminSessionToken')
    sessionStorage.removeItem('adminUser')
    setIsAuthenticated(false)
    setTemplates([])
    setJobs([])
    setStats(null)
    setJobStatuses([])
  }

  const handlePreviewTemplate = (template: Template) => {
    // Convert Template to the format expected by preview dialog
    const previewTemplate = {
      id: template.id,
      name: template.name,
      description: template.description || null,
      category: template.category || null,
      created_at: template.created_at,
      content_length: template.html_content.length,
      html_content: template.html_content
    }
    setPreviewTemplate(previewTemplate)
    setPreviewDialogOpen(true)
  }

  // Job management
  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This will also delete all related results.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/jobs?id=${jobId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Job deleted successfully"
        })
        loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete job",
        variant: "destructive"
      })
    }
  }

  // Injectable Template Management
  const createInjectableTemplate = async () => {
    try {
      const response = await fetch('/api/admin/injectable-templates', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newInjectableTemplate)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Injectable template created successfully"
        })
        setNewInjectableTemplate({ id: '', name: '', type: 'listicle', description: '', htmlContent: '' })
        setInjectableTemplateDialogOpen(false)
        loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create injectable template",
        variant: "destructive"
      })
    }
  }

  const deleteInjectableTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this injectable template?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/injectable-templates?id=${templateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Injectable template deleted successfully"
        })
        loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete injectable template",
        variant: "destructive"
      })
    }
  }

  const handlePreviewInjectableTemplate = (template: InjectableTemplate) => {
    setPreviewInjectableTemplate(template)
    setPreviewDialogOpen(true)
  }

  const handleEditTemplate = (template: InjectableTemplate) => {
    setEditingTemplate(template)
    setTemplateEditorOpen(true)
  }

  const handleCreateNewTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      type: 'listicle',
      html_content: '',
      description: '',
      is_active: true,
      created_at: '',
      updated_at: ''
    })
    setTemplateEditorOpen(true)
  }

  const handleSaveTemplate = async (templateData: any) => {
    try {
      if (editingTemplate?.id) {
        // Update existing template
        const response = await fetch('/api/admin/injectable-templates', {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: editingTemplate.id, ...templateData })
        })

        if (response.ok) {
          toast({
            title: "Success",
            description: "Injectable template updated successfully"
          })
        } else {
          const error = await response.json()
          throw new Error(error.error)
        }
      } else {
        // Create new template
        const response = await fetch('/api/admin/injectable-templates', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templateData)
        })

        if (response.ok) {
          toast({
            title: "Success",
            description: "Injectable template created successfully"
          })
        } else {
          const error = await response.json()
          throw new Error(error.error)
        }
      }

      setTemplateEditorOpen(false)
      setEditingTemplate(null)
      loadData()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive"
      })
    }
  }


  // Invite link management
  const handleNumericInput = (value: string): string => {
    // Only allow digits
    return value.replace(/[^0-9]/g, '')
  }

  const createInviteLink = async () => {
    setIsCreatingInviteLink(true)

    // Save form values before clearing
    const formData = { ...newInviteLink }

    // Calculate expiration for optimistic UI
    let expiresAt: Date
    if (formData.expiration_days) {
      const days = parseInt(formData.expiration_days, 10)
      if (!isNaN(days) && days > 0) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      } else {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    } else if (formData.expiration_hours) {
      const hours = parseInt(formData.expiration_hours, 10)
      if (!isNaN(hours) && hours > 0) {
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
      } else {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    } else {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }

    // Create optimistic invite link
    const tempId = `temp-${Date.now()}`
    const tempToken = `temp-${Date.now()}`
    const optimisticLink: InviteLink = {
      id: tempId,
      token: tempToken,
      invite_type: 'organization_creator',
      waitlist_email: formData.waitlist_email || null,
      expires_at: expiresAt.toISOString(),
      used_at: null,
      created_at: new Date().toISOString()
    }

    // Add optimistic link to the list immediately
    setInviteLinks(prev => [optimisticLink, ...prev])
    setNewInviteLink({ waitlist_email: '', expiration_days: '7', expiration_hours: '' })
    setInviteLinkDialogOpen(false)

    try {
      const body: any = {}
      if (formData.waitlist_email) {
        body.waitlist_email = formData.waitlist_email
      }
      if (formData.expiration_days) {
        const days = parseInt(formData.expiration_days, 10)
        if (!isNaN(days) && days > 0) {
          body.expiration_days = days
        }
      } else if (formData.expiration_hours) {
        const hours = parseInt(formData.expiration_hours, 10)
        if (!isNaN(hours) && hours > 0) {
          body.expiration_hours = hours
        }
      }

      const response = await fetch('/api/admin/invite-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        const realInviteLink = data.invite_link

        // Replace optimistic link with real one
        setInviteLinks(prev =>
          prev.map(link =>
            link.id === tempId ? realInviteLink : link
          )
        )

        toast({
          title: "Success",
          description: "Invite link created successfully"
        })
      } else {
        // Remove optimistic link on error
        setInviteLinks(prev => prev.filter(link => link.id !== tempId))

        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      // Remove optimistic link on error
      setInviteLinks(prev => prev.filter(link => link.id !== tempId))

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create invite link",
        variant: "destructive"
      })
    } finally {
      setIsCreatingInviteLink(false)
    }
  }

  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(inviteUrl)
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard"
    })
  }

  const deleteInviteLink = async (inviteLinkId: string) => {
    if (!confirm('Are you sure you want to delete this invite link?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/invite-links?id=${inviteLinkId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invite link deleted successfully"
        })
        loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete invite link",
        variant: "destructive"
      })
    }
  }

  if (!isAuthenticated) {
    return <AdminAuth onAuthSuccess={() => {
      setIsAuthenticated(true)
      // Load data after successful authentication
      setTimeout(() => loadData(), 100)
    }} />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-base font-semibold tracking-tight">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Manage users, templates, and system statistics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <Button
                variant="ghost"
                onClick={handleLogout}
                size="sm"
                className="h-8 gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold">{stats.users}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Users</p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground/60" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold">{stats.templates}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Templates</p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground/60" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold">{stats.jobs}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Jobs</p>
                </div>
                <Database className="h-5 w-5 text-muted-foreground/60" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold">{stats.results}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Results</p>
                </div>
                <CheckCircle className="h-5 w-5 text-muted-foreground/60" />
              </div>
            </div>
          </div>
        )}

        {/* Job Status Breakdown */}
        {jobStatuses.length > 0 && (
          <div className="rounded-lg border bg-card p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {jobStatuses.map((status) => (
                <Badge key={status.status} variant="secondary" className="text-xs font-normal">
                  {status.status}: {status.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Main Management Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-muted/50 h-9">
            <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
            <TabsTrigger value="injectable-templates" className="text-xs">Injectable</TabsTrigger>
            <TabsTrigger value="jobs" className="text-xs">Jobs</TabsTrigger>
            <TabsTrigger value="invite-links" className="text-xs">Invites</TabsTrigger>
            <TabsTrigger value="usage-limits" className="text-xs">Limits</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <AdminUsersTab />
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-sm font-semibold">Templates</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload and manage HTML templates</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="advertorial">Advertorial</SelectItem>
                      <SelectItem value="listicle">Listicle</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="h-8">
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Upload
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-base">Upload Template</DialogTitle>
                        <DialogDescription className="text-xs">
                          Upload an HTML template file or paste content directly
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="templateFile">Upload HTML File</Label>
                          <Input
                            id="templateFile"
                            type="file"
                            accept=".html"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleTemplateFile(file)
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="templateName">Template Name</Label>
                          <Input
                            id="templateName"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="My Template"
                          />
                        </div>
                        <div>
                          <Label htmlFor="templateId">Template ID (Optional)</Label>
                          <Input
                            id="templateId"
                            value={newTemplate.id}
                            onChange={(e) => setNewTemplate(prev => ({ ...prev, id: e.target.value }))}
                            placeholder="custom-template-id (leave empty for auto-generated)"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter a custom ID or leave empty to auto-generate one
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="templateDescription">Description</Label>
                          <Input
                            id="templateDescription"
                            value={newTemplate.description}
                            onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Brief description of the template"
                          />
                        </div>
                        <div>
                          <Label htmlFor="templateCategory">Category</Label>
                          <Select value={newTemplate.category} onValueChange={(value) => setNewTemplate(prev => ({ ...prev, category: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="advertorial">Advertorial</SelectItem>
                              <SelectItem value="listicle">Listicle</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="templateContent">HTML Content</Label>
                          <Textarea
                            id="templateContent"
                            value={newTemplate.htmlContent}
                            onChange={(e) => setNewTemplate(prev => ({ ...prev, htmlContent: e.target.value }))}
                            placeholder="Paste your HTML content here..."
                            rows={10}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createTemplate}>
                          Upload Template
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="p-6">
                {templatesLoading ? (
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-[350px] md:h-[400px] bg-muted/20 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredTemplates.length > 0 ? (
                  <>
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {currentTemplates.map((template) => (
                        <div key={template.id} className="relative group">
                          <TemplatePreview
                            template={template}
                            isSelected={false}
                            onClick={() => handlePreviewTemplate(template)}
                          />
                          <div className="absolute bottom-3 right-3">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteTemplate(template.id)
                              }}
                              className="h-8 px-3 text-xs shadow-lg"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-center mt-6">
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
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-sm font-medium mb-2">No templates found</h3>
                    <p className="text-xs text-muted-foreground">
                      Try adjusting your filter or upload a new template
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Injectable Templates Tab */}
          <TabsContent value="injectable-templates" className="space-y-4">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-sm font-semibold">Injectable Templates</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage dynamic content injection templates</p>
                </div>
                <Button
                  onClick={handleCreateNewTemplate}
                  size="sm"
                  className="h-8"
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add
                </Button>
              </div>
              <div className="p-6">
                {injectableTemplates?.length > 0 ? (
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {injectableTemplates.map((template) => (
                      <div key={template.id} className="relative group">
                        <TemplatePreview
                          template={{
                            id: template.id,
                            name: template.name,
                            description: template.description || undefined,
                            html_content: template.html_content,
                            category: template.type
                          }}
                          isSelected={false}
                          onClick={() => handlePreviewInjectableTemplate(template)}
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditTemplate(template)
                            }}
                            className="h-7 px-2 text-xs bg-background/90 backdrop-blur-sm"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteInjectableTemplate(template.id)
                            }}
                            className="h-7 px-2 text-xs shadow-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                        {!template.is_active && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="destructive" className="text-xs font-normal">Inactive</Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-sm font-medium mb-2">No injectable templates found</h3>
                    <p className="text-xs text-muted-foreground">
                      Create your first injectable template to get started
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Invite Links Tab */}
          <TabsContent value="invite-links" className="space-y-4">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-sm font-semibold">Invite Links</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Generate invite links for users</p>
                </div>
                <Dialog open={inviteLinkDialogOpen} onOpenChange={setInviteLinkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Create
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader className="space-y-1 pb-4">
                      <DialogTitle className="text-base">Create Invite Link</DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        Generate a new invite link for users
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="waitlistEmail" className="text-sm font-medium">
                          Waitlist Email
                          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                        </Label>
                        <Input
                          id="waitlistEmail"
                          type="email"
                          value={newInviteLink.waitlist_email}
                          onChange={(e) => setNewInviteLink(prev => ({ ...prev, waitlist_email: e.target.value }))}
                          placeholder="user@example.com"
                          className="h-10"
                        />
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Expiration</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Label htmlFor="expirationDays" className="text-sm font-medium mb-2 block">
                              Days
                            </Label>
                            <Input
                              id="expirationDays"
                              type="text"
                              inputMode="numeric"
                              value={newInviteLink.expiration_days}
                              onChange={(e) => {
                                const numericValue = handleNumericInput(e.target.value)
                                setNewInviteLink(prev => ({ ...prev, expiration_days: numericValue, expiration_hours: '' }))
                              }}
                              placeholder="7"
                              className="h-10"
                            />
                          </div>
                          <div className="pt-7 text-muted-foreground">or</div>
                          <div className="flex-1">
                            <Label htmlFor="expirationHours" className="text-sm font-medium mb-2 block">
                              Hours
                            </Label>
                            <Input
                              id="expirationHours"
                              type="text"
                              inputMode="numeric"
                              value={newInviteLink.expiration_hours}
                              onChange={(e) => {
                                const numericValue = handleNumericInput(e.target.value)
                                setNewInviteLink(prev => ({ ...prev, expiration_hours: numericValue, expiration_days: '' }))
                              }}
                              placeholder="24"
                              className="h-10"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Default: 7 days if left empty
                        </p>
                      </div>
                    </div>

                    <DialogFooter className="gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setInviteLinkDialogOpen(false)}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={createInviteLink}
                        disabled={isCreatingInviteLink}
                        className="w-full sm:w-auto"
                      >
                        {isCreatingInviteLink ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Link'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {inviteLinks.map((inviteLink) => {
                    const isOptimistic = inviteLink.id.startsWith('temp-')
                    const isExpired = new Date(inviteLink.expires_at) < new Date()
                    const isUsed = !!inviteLink.used_at
                    const inviteUrl = `${window.location.origin}/invite/${inviteLink.token}`

                    return (
                      <div
                        key={inviteLink.id}
                        className={`flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors group ${isOptimistic ? 'opacity-60' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isOptimistic ? (
                              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                            ) : (
                              <p className="text-sm font-medium truncate">
                                {inviteLink.waitlist_email || 'No email'}
                              </p>
                            )}
                            {!isOptimistic && (
                              <Badge variant={isUsed ? 'secondary' : isExpired ? 'destructive' : 'default'} className="text-xs font-normal">
                                {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                              </Badge>
                            )}
                            {isOptimistic && (
                              <Badge variant="secondary" className="text-xs font-normal animate-pulse">
                                Creating...
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                            {isOptimistic ? (
                              <span className="inline-block h-3 w-64 bg-muted animate-pulse rounded" />
                            ) : (
                              inviteUrl
                            )}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {isOptimistic ? (
                              <span className="inline-block h-3 w-48 bg-muted animate-pulse rounded" />
                            ) : (
                              <>
                                <span>Expires: {new Date(inviteLink.expires_at).toLocaleDateString()}</span>
                                {inviteLink.used_at && (
                                  <span>Used: {new Date(inviteLink.used_at).toLocaleDateString()}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!isOptimistic && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyInviteLink(inviteLink.token)}
                                disabled={isUsed || isExpired}
                                className="h-7 px-2 text-xs"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteInviteLink(inviteLink.id)}
                                disabled={isUsed}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {inviteLinks.length === 0 && !isCreatingInviteLink && (
                    <p className="text-center text-sm text-muted-foreground py-12">No invite links created yet</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold">Jobs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">View and manage job records</p>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {job.user_email}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="text-xs font-normal">
                            {job.status}
                          </Badge>
                          {job.template_name && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              {job.template_name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteJob(job.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {jobs.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-12">No jobs found</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Usage Limits Tab */}
          <TabsContent value="usage-limits" className="space-y-4">
            <UsageLimitsTab />
          </TabsContent>
        </Tabs>

        {/* Template Editor Dialog */}
        <Dialog open={templateEditorOpen} onOpenChange={setTemplateEditorOpen}>
          <DialogContent className="!max-w-[95vw] !w-[95vw] sm:!max-w-[95vw] max-h-[95vh] flex flex-col">
            <div className="flex-1 overflow-y-auto min-h-0">
              {editingTemplate && (
                <TemplateEditor
                  template={{
                    name: editingTemplate.name,
                    type: editingTemplate.type,
                    description: editingTemplate.description || '',
                    htmlContent: editingTemplate.html_content
                  }}
                  onSave={handleSaveTemplate}
                  onCancel={() => {
                    setTemplateEditorOpen(false)
                    setEditingTemplate(null)
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Template Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="!max-w-[95vw] !w-[95vw] sm:!max-w-[95vw] max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <DialogTitle className="text-base">
                Preview: {previewTemplate?.name || previewInjectableTemplate?.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                HTML template preview
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0">
              {(previewTemplate || previewInjectableTemplate) && (
                <div className="space-y-6">
                  {/* Preview Section */}
                  <div className="px-6 pt-6">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold mb-1">Template Preview</h3>
                      <p className="text-xs text-muted-foreground">Live preview of your template</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <iframe
                        srcDoc={`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { 
      margin: 0; 
      padding: 10px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #333;
      background: #fff;
    }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    .container { max-width: 1200px; margin: 0 auto; }
    
    /* Disable interactions on all clickable elements */
    a, button, input, select, textarea, [onclick], [role="button"], 
    [tabindex]:not([tabindex="-1"]), label[for] {
      pointer-events: none !important;
      cursor: default !important;
    }
    /* Allow scrolling */
    body, html {
      overflow: auto !important;
      pointer-events: auto !important;
    }
  </style>
</head>
<body>
  ${(() => {
                            const raw = (previewTemplate?.html_content || previewInjectableTemplate?.html_content) || '';
                            const name = (previewTemplate?.name || previewInjectableTemplate?.name) || '';
                            const isJavvy = /javvy/i.test(name) || /\bL00002\b/i.test(name) || /javvy/i.test(raw) || /\bL00002\b/i.test(raw);
                            if (!isJavvy) return raw;
                            const noOnError = raw
                              .replace(/\s+onerror="[^"]*"/gi, '')
                              .replace(/\s+onerror='[^']*'/gi, '');
                            const stripFallbackScripts = noOnError.replace(/<script[\s\S]*?<\/script>/gi, (block) => {
                              const lower = block.toLowerCase();
                              return (lower.includes('handlebrokenimages') || lower.includes('createfallbackimage') || lower.includes('placehold.co'))
                                ? ''
                                : block;
                            });
                            return stripFallbackScripts;
                          })()}
</body>
</html>`}
                        className="w-full h-[60vh] border-0"
                        title={`Preview of ${previewTemplate?.name || previewInjectableTemplate?.name}`}
                      />
                    </div>
                  </div>

                  {/* Template Tester Section */}
                  {previewInjectableTemplate && (
                    <div className="px-6 pb-6 border-t pt-6">
                      <TemplateTester
                        htmlContent={previewInjectableTemplate.html_content}
                        templateName={previewInjectableTemplate.name}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="px-6 pb-6 pt-4 flex-shrink-0 border-t">
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)} size="sm" className="h-8">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
