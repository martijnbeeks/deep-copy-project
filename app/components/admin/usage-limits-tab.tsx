"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Edit, Building2, AlertCircle } from "lucide-react"
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
  // Credit-based system (from feat/v2-api-miro-ui)
  credits: {
    plan_credits: number
    admin_bonus_credits: number
    total_available: number
    used: number
    remaining: number
    billing_period_end: string
  }
  usage: {
    deep_research: {
      current: number
      limit: number
      week_start: string | null
    }
    pre_lander: {
      current: number
      limit: number
      week_start: string | null
    }
    static_ads: {
      current: number
      limit: number
      week_start: string | null
    }
    templates_images: {
      current: number
      limit: number
      week_start: string | null
    }
  }
  created_at: string
  updated_at: string
}

export function UsageLimitsTab() {
  const [organizations, setOrganizations] = useState<OrganizationUsageData[]>([])
  const [loading, setLoading] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrganizationUsageData | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const hasLoadedRef = useRef(false)
  
  const [editForm, setEditForm] = useState({
    admin_bonus_credits: '0'
  })

  // Helper function to handle numeric input
  const handleNumericInput = (value: string): string => {
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
    // Check sessionStorage first for cached data
    const cachedData = sessionStorage.getItem('usageLimitsData')
    const cacheTimestamp = sessionStorage.getItem('usageLimitsTimestamp')
    const now = Date.now()
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
    
    // Use cached data if it exists and is less than 5 minutes old
    if (cachedData && cacheTimestamp) {
      const age = now - parseInt(cacheTimestamp, 10)
      if (age < CACHE_DURATION) {
        try {
          const data = JSON.parse(cachedData)
          const orgs = data.organizations || []
          
          // Validate cache has credit system fields
          const hasValidShape = Array.isArray(orgs) && orgs.every((o: any) => 
            o?.credits && 
            typeof o.credits.used === 'number'
          )
          
          if (hasValidShape) {
            setOrganizations(orgs)
            return // Don't fetch if we have fresh cache
          }

          // Cache exists but is not in expected shape, clear it and fetch fresh
          sessionStorage.removeItem('usageLimitsData')
          sessionStorage.removeItem('usageLimitsTimestamp')
        } catch (e) {
          // If cache is invalid, clear it and continue to fetch
          sessionStorage.removeItem('usageLimitsData')
          sessionStorage.removeItem('usageLimitsTimestamp')
        }
      } else {
        // Cache is too old, clear it
        sessionStorage.removeItem('usageLimitsData')
        sessionStorage.removeItem('usageLimitsTimestamp')
      }
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/organizations/usage-limits', {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
        // Cache the data
        sessionStorage.setItem('usageLimitsData', JSON.stringify(data))
        sessionStorage.setItem('usageLimitsTimestamp', now.toString())
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
    // Only load if we haven't loaded data yet
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      loadOrganizations()
    }
  }, [])

  const handleEdit = (org: OrganizationUsageData) => {
    setEditingOrg(org)
    setEditForm({
      admin_bonus_credits: String(org.credits.admin_bonus_credits)
    })
    setEditDialogOpen(true)
  }

  const handleSaveLimits = async () => {
    if (!editingOrg) return

    const adminBonusCredits = parseInt(editForm.admin_bonus_credits, 10)
    
    if (Number.isNaN(adminBonusCredits) || adminBonusCredits < 0) {
      toast({
        title: "Validation Error",
        description: "Admin bonus credits must be a non-negative integer",
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
          admin_bonus_credits: adminBonusCredits
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Usage limits updated successfully"
        })
        setEditDialogOpen(false)
        setEditingOrg(null)
        // Clear cache and reload fresh data
        sessionStorage.removeItem('usageLimitsData')
        sessionStorage.removeItem('usageLimitsTimestamp')
        hasLoadedRef.current = false
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (!Number.isFinite(limit) || limit <= 0) return 0
    if (!Number.isFinite(current) || current <= 0) return 0
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
              View job credits used and edit job credit limit per organization
            </p>
          </div>
          <Button onClick={() => {
            sessionStorage.removeItem('usageLimitsData')
            sessionStorage.removeItem('usageLimitsTimestamp')
            hasLoadedRef.current = false
            loadOrganizations()
          }} disabled={loading} variant="ghost" size="sm" className="h-8">
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
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Job Credits (credit-based system from feat/v2-api-miro-ui) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Credits</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant={getUsageColor(org.credits?.used ?? 0, org.credits?.total_available ?? 0)}>
                            {org.credits?.used ?? 0} / {org.credits?.total_available ?? 0}
                          </Badge>
                          {(org.credits?.remaining ?? 0) <= 0 && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${getUsagePercentage(org.credits?.used ?? 0, org.credits?.total_available ?? 0)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Plan: {org.credits?.plan_credits ?? 0} | Bonus: {org.credits?.admin_bonus_credits ?? 0}</div>
                        <div>Remaining: {org.credits?.remaining ?? 0}</div>
                        <div>Period ends: {formatDate(org.credits?.billing_period_end ?? null)}</div>
                      </div>
                    </div>

                    {/* Analytics only (read-only) - Deep Research, Pre-Landers, Static Ads, Template Images */}
                    <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground border-t pt-3">
                      <span>Deep Research: {org.usage?.deep_research?.current ?? 0}</span>
                      <span>Pre-Landers: {org.usage?.pre_lander?.current ?? 0}</span>
                      <span>Static Ads: {org.usage?.static_ads?.current ?? 0}</span>
                      <span>Template Images: {org.usage?.templates_images?.current ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog - combines both admin bonus credits and template images limit */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-1 pb-4">
            <DialogTitle className="text-base">Edit Usage Limits</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update admin bonus credits for {editingOrg?.organization.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin_bonus_credits" className="text-sm font-medium">
                Admin bonus credits
              </Label>
              <Input
                id="admin_bonus_credits"
                type="text"
                inputMode="numeric"
                value={editForm.admin_bonus_credits}
                onChange={(e) => {
                  const numericValue = handleNumericInput(e.target.value)
                  setEditForm(prev => ({ ...prev, admin_bonus_credits: numericValue }))
                }}
                placeholder="0"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Additional credits added to the organization's plan (admin controlled)
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
    </>
  )
}