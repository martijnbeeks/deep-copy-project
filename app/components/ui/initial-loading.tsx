"use client"

import { memo } from "react"

// Optimized initial loading component for first page visit
export const InitialLoading = memo(function InitialLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-primary/20 animate-pulse-slow rounded-full mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-primary mb-2">AI Copywriting</h1>
          <p className="text-muted-foreground">Professional content creation platform</p>
        </div>
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted animate-pulse-slow rounded" />
          <div className="h-10 w-full bg-muted animate-pulse-slow rounded" />
          <div className="h-10 w-full bg-muted animate-pulse-slow rounded" />
        </div>
        <div className="mt-6 text-center">
          <div className="h-4 w-32 bg-muted animate-pulse-slow rounded mx-auto" />
        </div>
      </div>
    </div>
  )
})

// Quick loading for protected pages
export const QuickLoading = memo(function QuickLoading() {
  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 border-r bg-card">
        <div className="p-6 space-y-4">
          <div className="h-8 w-32 bg-muted animate-pulse-slow rounded" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-muted animate-pulse-slow rounded" />
            ))}
          </div>
        </div>
      </div>
      <main className="flex-1 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse-slow rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse-slow rounded" />
            </div>
            <div className="h-10 w-32 bg-muted animate-pulse-slow rounded" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-6 border rounded-lg bg-card space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-3/4 bg-muted animate-pulse-slow rounded" />
                    <div className="h-4 w-1/2 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="h-6 w-16 bg-muted animate-pulse-slow rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse-slow rounded" />
                  <div className="h-4 w-2/3 bg-muted animate-pulse-slow rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <div className="h-6 w-20 bg-muted animate-pulse-slow rounded" />
                    <div className="h-6 w-16 bg-muted animate-pulse-slow rounded" />
                  </div>
                  <div className="h-8 w-8 bg-muted animate-pulse-slow rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
})
