"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MemberInviteDialog } from "./member-invite-dialog"
import { MemberApprovalDialog } from "./member-approval-dialog"
import { MemberRoleDialog } from "./member-role-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Loader2, UserCheck, Edit } from "lucide-react"
import { UserRole, MemberStatus } from "@/lib/db/types"

interface Member {
  id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  user: {
    id: string
    email: string
    name: string
    username?: string | null
  }
}

interface MembersListProps {
  organizationId: string
}

export function MembersList({ organizationId }: MembersListProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchMembers = async () => {
    setIsLoading(true)
    try {
      // Get user email from auth store for authorization header
      const { getUserEmailFromStorage } = await import('@/lib/utils/local-storage')
      const userEmail = getUserEmailFromStorage()

      if (!userEmail) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        headers: {
          'Authorization': `Bearer ${userEmail}`,
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch members')
      }

      setMembers(data.members || [])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch members',
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [organizationId])

  const pendingMembers = members.filter(m => m.status === 'pending')
  const approvedMembers = members.filter(m => m.status === 'approved')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Organization Members</CardTitle>
          <CardDescription>Manage members and their roles</CardDescription>
        </div>
        <MemberInviteDialog organizationId={organizationId} onInviteCreated={fetchMembers}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </MemberInviteDialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            {/* Skeleton for pending members section */}
            <div>
              <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-9 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
            {/* Skeleton for approved members section */}
            <div>
              <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-20 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-9 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {pendingMembers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Pending Approval ({pendingMembers.length})</h3>
                <div className="space-y-2">
                  {pendingMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{member.user.name}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                        {member.user.username && (
                          <p className="text-xs text-muted-foreground">@{member.user.username}</p>
                        )}
                      </div>
                      <MemberApprovalDialog
                        organizationId={organizationId}
                        memberId={member.id}
                        memberName={member.user.name}
                        memberEmail={member.user.email}
                        currentRole={member.role}
                        onApproved={() => fetchMembers()}
                      >
                        <Button size="sm">
                          <UserCheck className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </MemberApprovalDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-3">
                Approved Members ({approvedMembers.length})
              </h3>
              {approvedMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No approved members yet</p>
              ) : (
                <div className="space-y-2">
                  {approvedMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.user.name}</p>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role === 'admin' ? 'Admin' : 'Normal User'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                        {member.user.username && (
                          <p className="text-xs text-muted-foreground">@{member.user.username}</p>
                        )}
                      </div>
                      <MemberRoleDialog
                        organizationId={organizationId}
                        memberId={member.id}
                        memberName={member.user.name}
                        memberEmail={member.user.email}
                        currentRole={member.role}
                        onRoleUpdated={fetchMembers}
                      >
                        <Button variant="outline" size="sm">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Role
                        </Button>
                      </MemberRoleDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {members.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No members yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

