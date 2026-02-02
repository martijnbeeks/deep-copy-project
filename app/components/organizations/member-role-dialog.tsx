"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/auth-store"
import { RefreshCw, Shield, User, Check } from "lucide-react"
import { UserRole } from "@/lib/db/types"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface MemberRoleDialogProps {
  organizationId: string
  memberId: string
  memberName: string
  memberEmail: string
  currentRole: UserRole
  onRoleUpdated?: () => void
  children: React.ReactNode
}

export function MemberRoleDialog({
  organizationId,
  memberId,
  memberName,
  memberEmail,
  currentRole,
  onRoleUpdated,
  children
}: MemberRoleDialogProps) {
  const { toast } = useToast()
  const { user, refreshAdminStatus } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState<UserRole>(currentRole)
  
  // Check if the member being updated is the current user
  const isCurrentUser = user?.email === memberEmail

  const handleUpdate = async () => {
    setIsLoading(true)

    try {
      // Get user email from auth store for authorization header
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

      const response = await fetch(`/api/organizations/${organizationId}/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userEmail}`,
        },
        body: JSON.stringify({ role })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update member role')
      }

      toast({
        title: "Success!",
        description: `${memberName}'s role has been updated to ${role === 'admin' ? 'Admin' : 'Normal User'}`,
      })

      // If this is the current user, refresh their admin status
      if (isCurrentUser) {
        await refreshAdminStatus()
      }

      setOpen(false)
      if (onRoleUpdated) {
        onRoleUpdated()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update member role',
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-xl">Update Member Role</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Change the role for <span className="font-medium text-foreground">{memberName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Select Role
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={cn(
                  "relative flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                  "hover:border-primary/50 hover:bg-primary/5",
                  role === 'admin'
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={cn(
                    "h-5 w-5",
                    role === 'admin' ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium text-sm",
                    role === 'admin' ? "text-primary" : "text-foreground"
                  )}>
                    Admin
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Full access: read, write, create, and delete
                </p>
                {role === 'admin' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRole('normal_user')}
                className={cn(
                  "relative flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                  "hover:border-primary/50 hover:bg-primary/5",
                  role === 'normal_user'
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <User className={cn(
                    "h-5 w-5",
                    role === 'normal_user' ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "font-medium text-sm",
                    role === 'normal_user' ? "text-primary" : "text-foreground"
                  )}>
                    Normal User
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Standard access: read, write, and create
                </p>
                {role === 'normal_user' && (
                  <div className="absolute top-2 right-2">
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter className="gap-2 pt-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isLoading || role === currentRole}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Role'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

