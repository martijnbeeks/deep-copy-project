"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Edit, RotateCcw, Building2, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface OrganizationUsageData {
  organization_id: string
  organization: {
    id: string
    name: string
    created_by: string
    created_at: string
    updated_at: string
  }
  deep_research_limit: number
  pre_lander_limit: number
  current_deep_research_usage: number
  current_pre_lander_usage: number
  deep_research_week_start: string | null
  pre_lander_week_start: string | null
  created_at: string
  updated_at: string
}

export function UsageLimitsTab() {
  const [organizations, setOrganizations] = useState<OrganizationUsageData[]>([])
  const [loading, setLoading] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrganizationUsageData | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resettingOrg, setResettingOrg] = useState<OrganizationUsageData | null>(null)
  const [resetType, setResetType] = useState<'all' | 'deep_research' | 'pre_lander'>('all')
  
  const [editForm, setEditForm] = useState({
    deep_research_limit: '3',
    pre_lander_limit: '30'
  })

  // Helper function to handle numeric input (same as invite link)
  const handleNumericInput = (value: string): string => {
    // Only allow digits
    return value.replace(/[^0-9]/g, '')
  }

  // Helper function to get auth headers
  const getAuthHeaders = (): Record<string, string> => {
    const sessionToken = sessionStorage.getItem('adminSessionToken')
    const headers: Record<string, string> = {}
    if (sessionToken) {
      headers['x-admin-session'] = sessionToken
    }
    return headers
  }

  const loadOrganizations = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/organizations/usage-limits', {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      } else {
        throw new Error('Failed to load organizations')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load usage limits data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  const handleEdit = (org: OrganizationUsageData) => {
    setEditingOrg(org)
    setEditForm({
      deep_research_limit: org.deep_research_limit.toString(),
      pre_lander_limit: org.pre_lander_limit.toString()
    })
    setEditDialogOpen(true)
  }

  const handleSaveLimits = async () => {
    if (!editingOrg) return

    // Type cast to integers before sending
    const deepResearchLimit = parseInt(editForm.deep_research_limit) || 0
    const preLanderLimit = parseInt(editForm.pre_lander_limit) || 0

    // Validate that values are positive
    if (deepResearchLimit < 0 || preLanderLimit < 0) {
      toast({
        title: "Validation Error",
        description: "Limits must be non-negative integers",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch(`/api/admin/organizations/${editingOrg.organization_id}/usage-limits`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          deep_research_limit: deepResearchLimit,
          pre_lander_limit: preLanderLimit
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Usage limits updated successfully"
        })
        setEditDialogOpen(false)
        setEditingOrg(null)
        loadOrganizations()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update limits')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update usage limits",
        variant: "destructive"
      })
    }
  }

  const handleResetUsage = async () => {
    if (!resettingOrg) return

    try {
      const response = await fetch(`/api/admin/organizations/${resettingOrg.organization_id}/usage-limits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          usage_type: resetType === 'all' ? undefined : resetType
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Usage reset successfully for ${resetType === 'all' ? 'all types' : resetType}`
        })
        setResetDialogOpen(false)
        setResettingOrg(null)
        setResetType('all')
        loadOrganizations()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reset usage')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset usage",
        variant: "destructive"
      })
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === 0) return 0
    return Math.min(100, (current / limit) * 100)
  }

  const getUsageColor = (current: number, limit: number) => {
    const percentage = getUsagePercentage(current, limit)
    if (percentage >= 100) return 'destructive'
    if (percentage >= 80) return 'default'
    return 'secondary'
  }

  if (loading && organizations.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="text-center text-sm text-muted-foreground">Loading usage limits...</div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-sm font-semibold">Usage Limits</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage Deep Research and Pre-Lander limits per organization
            </p>
          </div>
          <Button onClick={loadOrganizations} disabled={loading} variant="ghost" size="sm" className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="p-4">
          {organizations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No organizations found</p>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div key={org.organization_id} className="rounded-lg border bg-card">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-semibold">{org.organization.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(org)}
                          className="h-7 px-2 text-xs"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResettingOrg(org)
                            setResetDialogOpen(true)
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Deep Research Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Deep Research</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant={getUsageColor(org.current_deep_research_usage, org.deep_research_limit)}>
                            {org.current_deep_research_usage} / {org.deep_research_limit}
                          </Badge>
                          {org.current_deep_research_usage >= org.deep_research_limit && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${getUsagePercentage(org.current_deep_research_usage, org.deep_research_limit)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Week started: {formatDate(org.deep_research_week_start)}
                      </p>
                    </div>

                    {/* Pre-Lander Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Pre-Landers</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant={getUsageColor(org.current_pre_lander_usage, org.pre_lander_limit)}>
                            {org.current_pre_lander_usage} / {org.pre_lander_limit}
                          </Badge>
                          {org.current_pre_lander_usage >= org.pre_lander_limit && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${getUsagePercentage(org.current_pre_lander_usage, org.pre_lander_limit)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Week started: {formatDate(org.pre_lander_week_start)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Limits Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-1 pb-4">
            <DialogTitle className="text-base">Edit Usage Limits</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update limits for {editingOrg?.organization.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="deep_research_limit" className="text-sm font-medium">
                Deep Research Limit
              </Label>
              <Input
                id="deep_research_limit"
                type="text"
                inputMode="numeric"
                value={editForm.deep_research_limit}
                onChange={(e) => {
                  const numericValue = handleNumericInput(e.target.value)
                  setEditForm(prev => ({ ...prev, deep_research_limit: numericValue }))
                }}
                placeholder="3"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of Deep Research actions per week
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pre_lander_limit" className="text-sm font-medium">
                Pre-Lander Limit
              </Label>
              <Input
                id="pre_lander_limit"
                type="text"
                inputMode="numeric"
                value={editForm.pre_lander_limit}
                onChange={(e) => {
                  const numericValue = handleNumericInput(e.target.value)
                  setEditForm(prev => ({ ...prev, pre_lander_limit: numericValue }))
                }}
                placeholder="30"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of Pre-Lander generations per week
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLimits}
              className="w-full sm:w-auto"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Usage Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-1 pb-4">
            <DialogTitle className="text-base">Reset Usage</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reset usage tracking for {resettingOrg?.organization.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Reset Type</Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    value="all"
                    checked={resetType === 'all'}
                    onChange={() => setResetType('all')}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">All Usage Types</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    value="deep_research"
                    checked={resetType === 'deep_research'}
                    onChange={() => setResetType('deep_research')}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">Deep Research Only</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    value="pre_lander"
                    checked={resetType === 'pre_lander'}
                    onChange={() => setResetType('pre_lander')}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">Pre-Landers Only</span>
                </label>
              </div>
            </div>

            {resettingOrg && (
              <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
                <p className="text-sm font-medium text-foreground mb-2">Current Usage</p>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Deep Research: <span className="font-medium text-foreground">{resettingOrg.current_deep_research_usage}</span> / {resettingOrg.deep_research_limit}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pre-Landers: <span className="font-medium text-foreground">{resettingOrg.current_pre_lander_usage}</span> / {resettingOrg.pre_lander_limit}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetUsage}
              className="w-full sm:w-auto"
            >
              Reset Usage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

