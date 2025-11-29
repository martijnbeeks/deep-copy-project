"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>
  isLoading?: boolean
  error?: string
}

export function LoginForm({ onLogin, isLoading = false, error }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onLogin(email, password)
    } catch (error) {
      // Error is already handled in the auth store and displayed via the error prop
      // This catch prevents the unhandled promise rejection
    }
  }

  return (
    <Card className="w-full border bg-card/50 backdrop-blur-sm">
      <CardContent className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Welcome Back</h2>
          <p className="text-sm text-muted-foreground">Sign in to continue to your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 bg-background border-border focus:border-primary transition-colors"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 bg-background border-border focus:border-primary transition-colors"
            />
          </div>
          
          {error && (
            <Alert variant="destructive" className="border-destructive/50">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            type="submit" 
            className="w-full h-11 font-medium transition-all" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
