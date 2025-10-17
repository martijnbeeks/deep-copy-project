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
import { RefreshCw, CheckCircle, AlertCircle, Users, FileText, Database, Plus, Trash2, Upload, Eye, LogOut, Briefcase } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { TemplateEditor } from "@/components/admin/template-editor"
import { TemplateTester } from "@/components/admin/template-tester"

interface User {
  id: string
  email: string
  name: string
  created_at: string
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

interface Template {
  id: string
  name: string
  description: string | null
  category: string | null
  created_at: string
  content_length: number
  html_content: string
}

interface DatabaseStats {
  users: number
  templates: number
  jobs: number
  results: number
}

interface JobStatus {
  status: string
  count: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [injectableTemplates, setInjectableTemplates] = useState<InjectableTemplate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([])
  
  // Form states
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '' })
  const [newTemplate, setNewTemplate] = useState({ id: '', name: '', description: '', category: '', htmlContent: '' })
  const [newInjectableTemplate, setNewInjectableTemplate] = useState({ id: '', name: '', type: 'listicle' as 'listicle' | 'advertorial', description: '', htmlContent: '' })
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  
  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [injectableTemplateDialogOpen, setInjectableTemplateDialogOpen] = useState(false)
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<InjectableTemplate | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
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
  const getAuthHeaders = () => {
    const sessionToken = sessionStorage.getItem('adminSessionToken')
    return sessionToken ? { 'x-admin-session': sessionToken } : {}
  }

  // Load all data
  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, templatesRes, injectableTemplatesRes, jobsRes, statsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: getAuthHeaders() }),
        fetch('/api/admin/templates', { headers: getAuthHeaders() }),
        fetch('/api/admin/injectable-templates', { headers: getAuthHeaders() }),
        fetch('/api/admin/jobs', { headers: getAuthHeaders() }),
        fetch('/api/admin/stats', { headers: getAuthHeaders() })
      ])
      
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users)
      }
      
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json()
        setTemplates(templatesData.templates)
      }
      
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

  // User management
  const createUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(newUser)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "User created successfully"
        })
        setNewUser({ email: '', password: '', name: '' })
        setUserDialogOpen(false)
        loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive"
      })
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their jobs and results.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "User deleted successfully"
        })
        loadData()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive"
      })
    }
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
        loadData()
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
        loadData()
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
    setUsers([])
    setTemplates([])
    setJobs([])
    setStats(null)
    setJobStatuses([])
  }

  const handlePreviewTemplate = (template: Template) => {
    setPreviewTemplate(template)
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

  const handlePreviewTemplateContent = (htmlContent: string) => {
    // Create a temporary template object for preview
    const tempTemplate = {
      id: 'preview',
      name: 'Preview',
      type: 'listicle' as const,
      html_content: htmlContent,
      description: 'Preview',
      is_active: true,
      created_at: '',
      updated_at: ''
    }
    setPreviewInjectableTemplate(tempTemplate)
    setPreviewDialogOpen(true)
  }

  if (!isAuthenticated) {
    return <AdminAuth onAuthSuccess={() => {
      setIsAuthenticated(true)
      // Load data after successful authentication
      setTimeout(() => loadData(), 100)
    }} />
  }

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
          <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">
                Manage users, templates, and view database statistics
            </p>
          </div>
            <div className="flex items-center gap-2">
              <Button onClick={loadData} disabled={loading} className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
                </Button>
                  </div>
              </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.users}</p>
                      <p className="text-sm text-muted-foreground">Users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.templates}</p>
                      <p className="text-sm text-muted-foreground">Templates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Database className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.jobs}</p>
                      <p className="text-sm text-muted-foreground">Jobs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.results}</p>
                      <p className="text-sm text-muted-foreground">Results</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Job Status Breakdown */}
          {jobStatuses.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle>Job Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {jobStatuses.map((status) => (
                    <Badge key={status.status} variant="outline" className="text-sm">
                      {status.status}: {status.count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        {/* Main Management Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="injectable-templates">Injectable Templates</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Add, view, and delete users</CardDescription>
                  </div>
                  <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>
                          Add a new user to the system
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="user@example.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={newUser.name}
                            onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Enter password"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createUser}>
                          Create User
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
            </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                <Button 
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteUser(user.id)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                </Button>
                  </div>
                    ))}
                    {users.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No users found</p>
                )}
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-4">
          <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Template Management</CardTitle>
                    <CardDescription>Upload, view, and delete HTML templates</CardDescription>
                  </div>
                  <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Template
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Upload New Template</DialogTitle>
                        <DialogDescription>
                          Upload an HTML template file or paste the content directly
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
            </CardHeader>
            <CardContent>
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {template.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {template.category && (
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {(template.content_length / 1024).toFixed(1)} KB
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Created: {new Date(template.created_at).toLocaleDateString()}
                            </span>
                </div>
                </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewTemplate(template)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteTemplate(template.id)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                </div>
                </div>
                    ))}
                    {templates.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No templates found</p>
                    )}
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* Injectable Templates Tab */}
            <TabsContent value="injectable-templates" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Injectable Template Management</CardTitle>
                    <CardDescription>
                      Create, edit, and manage templates for dynamic content injection. 
                      Simply upload HTML files or paste content - no complex validation required!
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleCreateNewTemplate} 
                    className="flex items-center gap-2"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Add Template
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Upload Options Info */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">How to Add Templates</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
                      <div className="flex items-start gap-2">
                        <Upload className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Upload HTML File</div>
                          <div>Click "Add Template" → Upload .html file</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Paste HTML Content</div>
                          <div>Click "Add Template" → Paste in editor</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Start with Templates</div>
                          <div>Use pre-built swipe templates</div>
                        </div>
                    </div>
                  </div>
                </div>

                  <div className="space-y-2">
                    {injectableTemplates?.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{template.name}</h3>
                            <Badge variant={template.type === 'listicle' ? 'default' : 'secondary'}>
                              {template.type}
                            </Badge>
                            {!template.is_active && (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description || 'No description'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created: {new Date(template.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                            className="flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewInjectableTemplate(template)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteInjectableTemplate(template.id)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {injectableTemplates?.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No injectable templates found</p>
                    )}
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* Jobs Tab */}
            <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Job Management
              </CardTitle>
                  <CardDescription>View and delete jobs</CardDescription>
            </CardHeader>
            <CardContent>
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-muted-foreground">
                            User: {job.user_email}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                              {job.status}
                            </Badge>
                            {job.template_name && (
                              <Badge variant="outline" className="text-xs">
                                Template: {job.template_name}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Created: {new Date(job.created_at).toLocaleDateString()}
                            </span>
                </div>
                </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteJob(job.id)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                </div>
                    ))}
                    {jobs.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No jobs found</p>
                    )}
              </div>
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>

      {/* Template Editor Dialog */}
      <Dialog open={templateEditorOpen} onOpenChange={setTemplateEditorOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingTemplate?.id ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate?.id ? 'Edit your injectable template' : 'Create a new injectable template - simply upload HTML or paste content'}
            </DialogDescription>
          </DialogHeader>
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
                onPreview={handlePreviewTemplateContent}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Template Preview: {previewTemplate?.name || previewInjectableTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Preview of the HTML template content
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {(previewTemplate || previewInjectableTemplate) && (
              <div className="space-y-4">
                <iframe
                  srcDoc={(previewTemplate?.html_content || previewInjectableTemplate?.html_content) || ''}
                  className="w-full h-[70vh] border rounded-lg"
                  title={`Preview of ${previewTemplate?.name || previewInjectableTemplate?.name}`}
                />
                {previewInjectableTemplate && (
                  <TemplateTester
                    htmlContent={previewInjectableTemplate.html_content}
                    templateName={previewInjectableTemplate.name}
                  />
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  )
}
