"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Home, ArrowLeft, Search, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-16 h-16 text-primary-foreground" />
          </div>
          <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-muted-foreground mb-6">
            Page Not Found
          </h2>
        </div>

        {/* Error Message */}
        <Card className="p-8 mb-8 bg-card/50 border-border/50">
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            The page you're looking for doesn't exist or has been moved. 
            Don't worry, it happens to the best of us!
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild className="text-lg px-6 py-3">
              <Link href="/">
                <Home className="w-5 h-5 mr-2" />
                Go Home
              </Link>
            </Button>
            
            <Button variant="outline" onClick={() => window.history.back()} className="text-lg px-6 py-3">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Go Back
            </Button>
          </div>
        </Card>

        {/* Helpful Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <Card className="p-4 bg-card/30 border-border/30 hover:bg-card/50 transition-colors">
            <Search className="w-6 h-6 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-foreground mb-1">Search</h3>
            <p className="text-muted-foreground">Find what you're looking for</p>
          </Card>
          
          <Card className="p-4 bg-card/30 border-border/30 hover:bg-card/50 transition-colors">
            <Home className="w-6 h-6 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-foreground mb-1">Dashboard</h3>
            <p className="text-muted-foreground">Access your workspace</p>
          </Card>
          
          <Card className="p-4 bg-card/30 border-border/30 hover:bg-card/50 transition-colors">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold text-foreground mb-1">Support</h3>
            <p className="text-muted-foreground">Get help when needed</p>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Still having trouble?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
