"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { InviteAcceptForm } from "@/components/invite/invite-accept-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<{
    invite_type: 'organization_creator' | 'staff_member'
    waitlist_email?: string | null
  } | null>(null)

  useEffect(() => {
    const fetchInviteData = async () => {
      if (!token) {
        setError('Invalid invite link')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/invite/${token}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load invite')
        }

        setInviteData(data.invite_link)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInviteData()
  }, [token])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    )
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Invalid Invite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {error || 'This invite link is invalid or has expired.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
      <InviteAcceptForm
        token={token}
        inviteType={inviteData.invite_type}
        waitlistEmail={inviteData.waitlist_email}
      />
    </div>
  )
}

