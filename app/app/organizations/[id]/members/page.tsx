"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { MembersList } from "@/components/organizations/members-list"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"

export default function OrganizationMembersPage() {
  const params = useParams()
  const router = useRouter()
  const organizationId = params.id as string
  const { user, isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }

    // For now, we'll allow access if authenticated
    // In a real app, you'd verify the user is an admin of this organization
    setHasAccess(true)
    setIsLoading(false)
  }, [isAuthenticated, user, router])

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

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have access to this organization.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <MembersList organizationId={organizationId} />
      </div>
    </div>
  )
}

