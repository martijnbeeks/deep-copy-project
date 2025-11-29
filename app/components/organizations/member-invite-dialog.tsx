"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Copy, Check } from "lucide-react"

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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

      const body: any = {}
      if (expirationDays) {
        body.expiration_days = parseInt(expirationDays)
      } else if (expirationHours) {
        body.expiration_hours = parseInt(expirationHours)
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

      setInviteUrl(data.invite_url)
      toast({
        title: "Success!",
        description: "Invite link created successfully",
      })

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

  const copyToClipboard = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setInviteUrl(null)
    setExpirationDays("7")
    setExpirationHours("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Create an invite link for a new staff member to join your organization
          </DialogDescription>
        </DialogHeader>
        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Expiration Period</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expirationDays">Days</Label>
                  <Input
                    id="expirationDays"
                    type="number"
                    min="1"
                    value={expirationDays}
                    onChange={(e) => {
                      setExpirationDays(e.target.value)
                      setExpirationHours("")
                    }}
                    placeholder="7"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="expirationHours">Hours</Label>
                  <Input
                    id="expirationHours"
                    type="number"
                    min="1"
                    value={expirationHours}
                    onChange={(e) => {
                      setExpirationHours(e.target.value)
                      setExpirationDays("")
                    }}
                    placeholder="24"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave both empty for default (7 days)
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Invite Link'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Invite Link</Label>
              <div className="flex gap-2 mt-2">
                <Input value={inviteUrl} readOnly className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

