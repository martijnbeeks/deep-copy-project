"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MemberInviteDialog } from "./member-invite-dialog"
import { MemberApprovalDialog } from "./member-approval-dialog"
import { MemberRoleDialog } from "./member-role-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, UserCheck, Edit, Mail, AtSign } from "lucide-react"
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
    <Card className="border-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg">Organization Members</CardTitle>
          <CardDescription className="text-sm">Manage members and their roles</CardDescription>
        </div>
        <MemberInviteDialog organizationId={organizationId} onInviteCreated={fetchMembers}>
          <Button size="sm" className="h-9">
            <Plus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </MemberInviteDialog>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingMembers.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Pending Approval ({pendingMembers.length})
                </h3>
                <div className="space-y-1.5">
                  {pendingMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {member.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.user.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                          </div>
                        </div>
                      </div>
                      <MemberApprovalDialog
                        organizationId={organizationId}
                        memberId={member.id}
                        memberName={member.user.name}
                        memberEmail={member.user.email}
                        currentRole={member.role}
                        onApproved={() => fetchMembers()}
                      >
                        <Button size="sm" variant="default" className="h-8 text-xs">
                          <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                          Approve
                        </Button>
                      </MemberApprovalDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Approved Members ({approvedMembers.length})
              </h3>
              {approvedMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No approved members yet</p>
              ) : (
                <div className="space-y-1.5">
                  {approvedMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {member.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-sm truncate">{member.user.name}</p>
                            <Badge 
                              variant={member.role === 'admin' ? 'default' : 'secondary'} 
                              className="text-[10px] px-1.5 py-0 h-5 font-medium"
                            >
                              {member.role === 'admin' ? 'Admin' : 'Normal User'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{member.user.email}</span>
                            </div>
                            {member.user.username && (
                              <div className="flex items-center gap-1.5">
                                <AtSign className="h-3 w-3" />
                                <span>{member.user.username}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <MemberRoleDialog
                        organizationId={organizationId}
                        memberId={member.id}
                        memberName={member.user.name}
                        memberEmail={member.user.email}
                        currentRole={member.role}
                        onRoleUpdated={fetchMembers}
                      >
                        <Button variant="ghost" size="sm" className="h-8 text-xs">
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Edit Role
                        </Button>
                      </MemberRoleDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {members.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No members yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

