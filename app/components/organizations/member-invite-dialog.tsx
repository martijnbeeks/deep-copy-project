"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw } from "lucide-react"

interface MemberInviteDialogProps {
  organizationId: string
  onInviteCreated?: () => void
  children: React.ReactNode
}

export function MemberInviteDialog({ organizationId, onInviteCreated, children }: MemberInviteDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [expirationDays, setExpirationDays] = useState("7")
  const [expirationHours, setExpirationHours] = useState("")

  const handleNumericInput = (value: string): string => {
    // Only allow digits
    return value.replace(/[^0-9]/g, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const body: Record<string, unknown> = {}
      if (expirationDays) {
        const days = parseInt(expirationDays, 10)
        if (!isNaN(days) && days > 0) {
          body.expiration_days = days
        }
      } else if (expirationHours) {
        const hours = parseInt(expirationHours, 10)
        if (!isNaN(hours) && hours > 0) {
          body.expiration_hours = hours
        }
      }

      const response = await fetch(`/api/organizations/${organizationId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userEmail}`,
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invite link')
      }

      toast({
        title: "Success!",
        description: "Invite link created successfully",
      })

      // Close dialog and reset form
      handleClose()
      
      if (onInviteCreated) {
        onInviteCreated()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create invite link',
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setExpirationDays("7")
    setExpirationHours("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-2 pb-4">
          <DialogTitle className="text-xl">Create Invite Link</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Generate a new invite link for team members
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-2">
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
                    value={expirationDays}
                    onChange={(e) => {
                      const numericValue = handleNumericInput(e.target.value)
                      setExpirationDays(numericValue)
                      setExpirationHours("")
                    }}
                    placeholder="7"
                    className="h-10"
                    disabled={isLoading}
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
                    value={expirationHours}
                    onChange={(e) => {
                      const numericValue = handleNumericInput(e.target.value)
                      setExpirationHours(numericValue)
                      setExpirationDays("")
                    }}
                    placeholder="24"
                    className="h-10"
                    disabled={isLoading}
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
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Link'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

