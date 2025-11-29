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
import { Loader2, AlertCircle, Building2, Users, UserCheck, Plus, ArrowRight } from "lucide-react"
import { UserRole, MemberStatus } from "@/lib/db/types"

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
  const { user, isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [allPendingMembers, setAllPendingMembers] = useState<OrganizationMember[]>([])
  const [allMembers, setAllMembers] = useState<OrganizationMember[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }

    fetchOrganizations()
  }, [isAuthenticated, user, router])

  // Redirect if user is not an admin
  useEffect(() => {
    const checkAdminAndRedirect = async () => {
      if (!user?.email || !isAuthenticated) return

      try {
        const authStorage = localStorage.getItem('auth-storage')
        let userEmail = ''
        if (authStorage) {
          try {
            const authData = JSON.parse(authStorage)
            userEmail = authData.state?.user?.email || ''
          } catch {
            // Ignore parse errors
          }
        }

        if (!userEmail) return

        const response = await fetch('/api/organizations/check-admin', {
          headers: {
            'Authorization': `Bearer ${userEmail}`,
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (!data.isAdmin) {
            // User is not an admin, redirect to dashboard
            router.push('/dashboard')
            toast({
              title: "Access Denied",
              description: "You don't have permission to access this page.",
              variant: "destructive",
            })
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
      }
    }

    if (isAuthenticated && user) {
      checkAdminAndRedirect()
    }
  }, [isAuthenticated, user, router, toast])

  const fetchOrganizations = async () => {
    setIsLoading(true)
    try {
      const authStorage = localStorage.getItem('auth-storage')
      let userEmail = ''
      if (authStorage) {
        try {
          const authData = JSON.parse(authStorage)
          userEmail = authData.state?.user?.email || ''
        } catch {
          // Ignore parse errors
        }
      }

      if (!userEmail) {
        throw new Error('Not authenticated')
      }

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

      // Fetch all members across all organizations
      const pendingMembers: OrganizationMember[] = []
      const allMembersList: OrganizationMember[] = []

      for (const org of orgsData.organizations || []) {
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

          allMembersList.push(...members)

          // Filter pending members
          const pending = members.filter((m: OrganizationMember) => m.status === 'pending')
          pendingMembers.push(...pending)
        }
      }

      setAllPendingMembers(pendingMembers)
      setAllMembers(allMembersList)

      // Auto-select first organization if available
      if (orgsData.organizations?.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgsData.organizations[0].id)
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

  const handleMemberApproved = () => {
    fetchOrganizations()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (organizations.length === 0) {
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
              </TabsList>

              {/* Organizations Tab */}
              <TabsContent value="organizations" className="space-y-4">
                {organizations.map((org) => (
                  <Card key={org.id}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {org.name}
                        </CardTitle>
                        <CardDescription>
                          Created {new Date(org.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <MemberInviteDialog
                          organizationId={org.id}
                          onInviteCreated={fetchOrganizations}
                        >
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Invite Member
                          </Button>
                        </MemberInviteDialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrgId(org.id)
                            // Scroll to members section
                            setTimeout(() => {
                              document.getElementById(`org-${org.id}`)?.scrollIntoView({ behavior: 'smooth' })
                            }, 100)
                          }}
                        >
                          Manage
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    {selectedOrgId === org.id && (
                      <CardContent id={`org-${org.id}`}>
                        <MembersList organizationId={org.id} />
                      </CardContent>
                    )}
                  </Card>
                ))}
              </TabsContent>

              {/* Pending Approvals Tab */}
              <TabsContent value="pending" className="space-y-4">
                {allPendingMembers.length === 0 ? (
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
                              onApproved={handleMemberApproved}
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
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}

