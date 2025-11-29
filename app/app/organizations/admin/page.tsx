"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MembersList } from "@/components/organizations/members-list"
import { MemberInviteDialog } from "@/components/organizations/member-invite-dialog"
import { MemberApprovalDialog } from "@/components/organizations/member-approval-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/auth-store"
import { Loader2, AlertCircle, Building2, Users, UserCheck, Plus, ArrowRight, Copy, Trash2, Link2, RefreshCw } from "lucide-react"
import { UserRole, MemberStatus, InviteLink } from "@/lib/db/types"
import { logger } from "@/lib/utils/logger"

interface Organization {
  id: string
  name: string
  created_by: string
  created_at: string
}

interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  user: {
    id: string
    email: string
    name: string
    username?: string | null
  }
  organization?: {
    id: string
    name: string
  }
}

export default function OrganizationAdminPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [allPendingMembers, setAllPendingMembers] = useState<OrganizationMember[]>([])
  const [allMembers, setAllMembers] = useState<OrganizationMember[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [orgInviteLinks, setOrgInviteLinks] = useState<Record<string, InviteLink[]>>({})
  const [isLoadingInviteLinks, setIsLoadingInviteLinks] = useState<Record<string, boolean>>({})

  // Wait for auth to hydrate, then check authentication
  useEffect(() => {
    // Wait for auth store to finish hydrating from localStorage
    if (authLoading) return

    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }

    setIsCheckingAdmin(false)
  }, [authLoading, isAuthenticated, user, router])

  // Check admin status and fetch organizations together (only after auth is ready)
  useEffect(() => {
    if (authLoading || isCheckingAdmin || !isAuthenticated || !user) return

    const checkAdminAndFetch = async () => {
      try {
        const { getUserEmailFromStorage } = await import('@/lib/utils/local-storage')
        const userEmail = getUserEmailFromStorage()

        if (!userEmail) {
          router.push('/login')
          return
        }

        // Check admin status first
        const adminResponse = await fetch('/api/organizations/check-admin', {
          headers: {
            'Authorization': `Bearer ${userEmail}`,
          }
        })

        if (adminResponse.ok) {
          const adminData = await adminResponse.json()
          const userIsAdmin = adminData.isAdmin || false
          setIsAdmin(userIsAdmin)
          
          if (!userIsAdmin) {
            // User is not an admin, redirect to dashboard
            router.push('/dashboard')
            toast({
              title: "Access Denied",
              description: "You don't have permission to access this page.",
              variant: "destructive",
            })
            return
          }

          // If admin check passes, fetch organizations
          await fetchOrganizations(userEmail)
        } else {
          // If check fails, assume not admin
          setIsAdmin(false)
          router.push('/dashboard')
        }
      } catch (error) {
        logger.error('Error checking admin status:', error)
        setIsAdmin(false)
        router.push('/dashboard')
      }
    }

    checkAdminAndFetch()
  }, [authLoading, isCheckingAdmin, isAuthenticated, user, router, toast])

  const fetchOrganizations = async (userEmail: string) => {
    setIsLoading(true)
    try {

      // Fetch user's organizations where they are admin
      const orgsResponse = await fetch('/api/organizations/my-organizations', {
        headers: {
          'Authorization': `Bearer ${userEmail}`,
        }
      })

      if (!orgsResponse.ok) {
        throw new Error('Failed to fetch organizations')
      }

      const orgsData = await orgsResponse.json()
      setOrganizations(orgsData.organizations || [])

      // Fetch all members across all organizations in parallel
      const memberPromises = (orgsData.organizations || []).map(async (org: Organization) => {
        try {
          const membersResponse = await fetch(`/api/organizations/${org.id}/members`, {
            headers: {
              'Authorization': `Bearer ${userEmail}`,
            }
          })

          if (membersResponse.ok) {
            const membersData = await membersResponse.json()
            const members = (membersData.members || []).map((m: OrganizationMember) => ({
              ...m,
              organization: { id: org.id, name: org.name }
            }))
            return { members, orgId: org.id }
          }
          return { members: [], orgId: org.id }
        } catch (error) {
          logger.error(`Error fetching members for organization ${org.id}:`, error)
          return { members: [], orgId: org.id }
        }
      })

      const memberResults = await Promise.all(memberPromises)
      
      // Combine all members and filter pending ones
      const allMembersList: OrganizationMember[] = []
      const pendingMembers: OrganizationMember[] = []

      memberResults.forEach(({ members }) => {
        allMembersList.push(...members)
        const pending = members.filter((m: OrganizationMember) => m.status === 'pending')
        pendingMembers.push(...pending)
      })

      setAllPendingMembers(pendingMembers)
      setAllMembers(allMembersList)

      // Auto-select first organization if available
      if (orgsData.organizations?.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgsData.organizations[0].id)
      }

      // Automatically fetch invite links for all organizations
      if (orgsData.organizations?.length > 0) {
        fetchAllInviteLinks(orgsData.organizations, userEmail)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load organizations',
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInviteLinks = async (organizationId: string, userEmail?: string) => {
    setIsLoadingInviteLinks(prev => ({ ...prev, [organizationId]: true }))
    try {
      if (!userEmail) {
        const { getUserEmailFromStorage } = await import('@/lib/utils/local-storage')
        userEmail = getUserEmailFromStorage()
      }

      if (!userEmail) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/organizations/${organizationId}/invite-links`, {
        headers: {
          'Authorization': `Bearer ${userEmail}`,
        }
      })

      if (response.ok) {
        const data = await response.json()
        setOrgInviteLinks(prev => ({
          ...prev,
          [organizationId]: data.invite_links || []
        }))
      }
    } catch (error) {
      logger.error(`Error fetching invite links for organization ${organizationId}:`, error)
    } finally {
      setIsLoadingInviteLinks(prev => ({ ...prev, [organizationId]: false }))
    }
  }

  const fetchAllInviteLinks = async (organizations: Organization[], userEmail: string) => {
    // Fetch invite links for all organizations in parallel
    const fetchPromises = organizations.map(org => fetchInviteLinks(org.id, userEmail))
    await Promise.all(fetchPromises)
  }

  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(inviteUrl)
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard"
    })
  }

  const deleteInviteLink = async (organizationId: string, inviteLinkId: string) => {
    if (!confirm('Are you sure you want to delete this invite link?')) {
      return
    }

    try {
      const { getUserEmailFromStorage } = await import('@/lib/utils/local-storage')
      const userEmail = getUserEmailFromStorage()

      if (!userEmail) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/organizations/${organizationId}/invite-links?id=${inviteLinkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userEmail}`,
        }
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invite link deleted successfully"
        })
        // Remove from local state
        setOrgInviteLinks(prev => ({
          ...prev,
          [organizationId]: (prev[organizationId] || []).filter(link => link.id !== inviteLinkId)
        }))
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

  const handleMemberApproved = async (memberId: string, role: UserRole) => {
    // Optimistic update: immediately update the UI
    setAllPendingMembers(prev => prev.filter(m => m.id !== memberId))
    
    // Find the member being approved
    const approvedMember = allPendingMembers.find(m => m.id === memberId)
    if (approvedMember) {
      // Add to approved members with updated role
      const updatedMember: OrganizationMember = {
        ...approvedMember,
        status: 'approved',
        role: role
      }
      setAllMembers(prev => {
        // Remove from pending, add as approved
        const filtered = prev.filter(m => m.id !== memberId)
        return [...filtered, updatedMember]
      })
    }

    // Refetch to ensure data consistency
    const { getUserEmailFromStorage } = await import('@/lib/utils/local-storage')
    const userEmail = getUserEmailFromStorage()
    if (userEmail) {
      // Refetch in background without blocking UI
      fetchOrganizations(userEmail).catch(error => {
        logger.error('Error refetching organizations after approval:', error)
        // On error, revert optimistic update by refetching
        fetchOrganizations(userEmail)
      })
    }
  }

  // Skeleton loader component
  const SkeletonCard = () => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-7 w-16 bg-muted animate-pulse rounded" />
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const SkeletonOrganizationCard = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-muted animate-pulse rounded" />
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )

  // Show loading while checking auth or admin status
  if (authLoading || isCheckingAdmin || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated or not admin (after check), show nothing (redirect is happening)
  if (!isAuthenticated || !user || isAdmin === false) {
    return null
  }

  // Only show "No Organizations" message if loading is complete and there are no organizations
  if (!isLoading && organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              No Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You are not an admin of any organizations yet.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-16">
        <div className="p-4 md:p-6 pb-24 md:pb-28">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">Manage Organization</h1>
                  <p className="text-muted-foreground mt-2">
                    Manage your organizations and team members
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                <>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="text-2xl font-bold">{organizations.length}</p>
                          <p className="text-sm text-muted-foreground">Organizations</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-8 w-8 text-orange-600" />
                        <div>
                          <p className="text-2xl font-bold">{allPendingMembers.length}</p>
                          <p className="text-sm text-muted-foreground">Pending Approvals</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <Users className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold">
                            {allMembers.filter(m => m.status === 'approved').length}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Members</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="organizations" className="space-y-4">
              <TabsList>
                <TabsTrigger value="organizations">Organizations</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending Approvals
                  {allPendingMembers.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {allPendingMembers.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="invite-links">Invite Links</TabsTrigger>
              </TabsList>

              {/* Organizations Tab */}
              <TabsContent value="organizations" className="space-y-4">
                {isLoading ? (
                  <>
                    <SkeletonOrganizationCard />
                    <SkeletonOrganizationCard />
                  </>
                ) : (
                  organizations.map((org) => (
                    <Card key={org.id}>
                      <CardHeader 
                        className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedOrgId(selectedOrgId === org.id ? null : org.id)}
                      >
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {org.name}
                          </CardTitle>
                          <CardDescription>
                            Created {new Date(org.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <ArrowRight 
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            selectedOrgId === org.id ? 'rotate-90' : ''
                          }`} 
                        />
                      </CardHeader>
                      {selectedOrgId === org.id && (
                        <CardContent id={`org-${org.id}`}>
                          <MembersList organizationId={org.id} />
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Pending Approvals Tab */}
              <TabsContent value="pending" className="space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    <SkeletonOrganizationCard />
                    <SkeletonOrganizationCard />
                  </div>
                ) : allPendingMembers.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No pending member approvals</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {allPendingMembers.map((member) => (
                      <Card key={member.id}>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium">{member.user.name}</p>
                                  <p className="text-sm text-muted-foreground">{member.user.email}</p>
                                  {member.user.username && (
                                    <p className="text-xs text-muted-foreground">@{member.user.username}</p>
                                  )}
                                </div>
                                <Badge variant="outline">
                                  {member.organization?.name || 'Unknown Organization'}
                                </Badge>
                              </div>
                            </div>
                            <MemberApprovalDialog
                              organizationId={member.organization_id}
                              memberId={member.id}
                              memberName={member.user.name}
                              memberEmail={member.user.email}
                              currentRole={member.role}
                              onApproved={(memberId, role) => handleMemberApproved(memberId, role)}
                            >
                              <Button>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Approve & Assign Role
                              </Button>
                            </MemberApprovalDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Invite Links Tab */}
              <TabsContent value="invite-links" className="space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    <SkeletonOrganizationCard />
                    <SkeletonOrganizationCard />
                  </div>
                ) : organizations.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No organizations found</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {organizations.map((org) => {
                      const inviteLinks = orgInviteLinks[org.id] || []
                      const isLoadingLinks = isLoadingInviteLinks[org.id]

                      return (
                        <Card key={org.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <Building2 className="h-5 w-5" />
                                  {org.name}
                                </CardTitle>
                                <CardDescription>
                                  {inviteLinks.length} invite link{inviteLinks.length !== 1 ? 's' : ''}
                                </CardDescription>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchInviteLinks(org.id)}
                                disabled={isLoadingLinks}
                              >
                                {isLoadingLinks ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Refresh
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {isLoadingLinks ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                              </div>
                            ) : inviteLinks.length === 0 ? (
                              <div className="text-center py-8">
                                <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">No invite links created yet</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                  Create invite links from the Organizations tab
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {inviteLinks.map((inviteLink) => {
                                  const isExpired = new Date(inviteLink.expires_at) < new Date()
                                  const isUsed = !!inviteLink.used_at
                                  const inviteUrl = `${window.location.origin}/invite/${inviteLink.token}`

                                  return (
                                    <div
                                      key={inviteLink.id}
                                      className="flex items-center justify-between p-3 border rounded-lg"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            variant={
                                              isUsed
                                                ? 'secondary'
                                                : isExpired
                                                ? 'destructive'
                                                : 'default'
                                            }
                                          >
                                            {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground font-mono mt-1">
                                          {inviteUrl}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                          <span>
                                            Expires: {new Date(inviteLink.expires_at).toLocaleString()}
                                          </span>
                                          {inviteLink.used_at && (
                                            <span>
                                              Used: {new Date(inviteLink.used_at).toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => copyInviteLink(inviteLink.token)}
                                          disabled={isUsed || isExpired}
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copy
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => deleteInviteLink(org.id, inviteLink.id)}
                                          disabled={isUsed}
                                          className="flex items-center gap-1"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          Delete
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}

