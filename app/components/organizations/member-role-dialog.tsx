"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { UserRole } from "@/lib/db/types"

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
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState<UserRole>(currentRole)

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Member Role</DialogTitle>
          <DialogDescription>
            Change the role for {memberName} ({memberEmail})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="normal_user">Normal User</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Admin: Full access (read, write, create, delete)
              <br />
              Normal User: Read, write, create (no delete)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isLoading || role === currentRole}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

