"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface InviteAcceptFormProps {
  token: string
  inviteType: 'organization_creator' | 'staff_member'
  waitlistEmail?: string | null
}

export function InviteAcceptForm({ token, inviteType, waitlistEmail }: InviteAcceptFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for organization creator
  const [name, setName] = useState("")
  const [email, setEmail] = useState(waitlistEmail || "")
  const [companyName, setCompanyName] = useState("")
  const [orgPassword, setOrgPassword] = useState("")
  const [orgConfirmPassword, setOrgConfirmPassword] = useState("")

  // Form state for staff member
  const [staffName, setStaffName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (inviteType === 'organization_creator') {
        if (!name || !email || !companyName || !orgPassword) {
          throw new Error('All fields are required')
        }

        if (orgPassword !== orgConfirmPassword) {
          throw new Error('Passwords do not match')
        }

        if (orgPassword.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }

        const response = await fetch(`/api/invite/${token}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            company_name: companyName.trim(),
            password: orgPassword
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to accept invite')
        }

        toast({
          title: "Success!",
          description: "Organization created successfully. You can now log in.",
        })

        // Redirect to login
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        // Staff member flow
        if (!staffName || !staffEmail || !username || !password) {
          throw new Error('All fields are required')
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }

        const response = await fetch(`/api/invite/${token}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: staffName.trim(),
            email: staffEmail.toLowerCase().trim(),
            username: username.trim(),
            password
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to accept invite')
        }

        toast({
          title: "Success!",
          description: "Account created. Waiting for admin approval.",
        })

        // Redirect to login
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept invite'
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (inviteType === 'organization_creator') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Create Your Organization</CardTitle>
          <CardDescription>
            Complete your profile to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="orgPassword">Password</Label>
              <Input
                id="orgPassword"
                type="password"
                value={orgPassword}
                onChange={(e) => setOrgPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="orgConfirmPassword">Confirm Password</Label>
              <Input
                id="orgConfirmPassword"
                type="password"
                value={orgConfirmPassword}
                onChange={(e) => setOrgConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Join Organization</CardTitle>
        <CardDescription>
          Create your account to join the organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="staffName">Name</Label>
            <Input
              id="staffName"
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="John Doe"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="staffEmail">Email</Label>
            <Input
              id="staffEmail"
              type="email"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="john@example.com"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

