"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

// Memoized skeleton components for better performance
export const MemoizedSkeleton = memo(function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted animate-pulse-slow rounded-md', className)}
      {...props}
    />
  )
})

// Optimized card skeleton with memoization
export const OptimizedCardSkeleton = memo(function CardSkeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-6 shadow-sm",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
        className
      )}
      {...props}
    />
  )
})

// Optimized job card skeleton
export const OptimizedJobCardSkeleton = memo(function JobCardSkeleton() {
  return (
    <OptimizedCardSkeleton className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <MemoizedSkeleton className="h-5 w-3/4" />
          <MemoizedSkeleton className="h-4 w-1/2" />
        </div>
        <MemoizedSkeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <MemoizedSkeleton className="h-4 w-full" />
        <MemoizedSkeleton className="h-4 w-2/3" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <MemoizedSkeleton className="h-6 w-20 rounded-full" />
          <MemoizedSkeleton className="h-6 w-16 rounded-full" />
        </div>
        <MemoizedSkeleton className="h-8 w-8 rounded" />
      </div>
    </OptimizedCardSkeleton>
  )
})

// Optimized results card skeleton
export const OptimizedResultCardSkeleton = memo(function ResultCardSkeleton() {
  return (
    <OptimizedCardSkeleton className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <MemoizedSkeleton className="h-5 w-3/4" />
          <MemoizedSkeleton className="h-4 w-1/2" />
        </div>
        <MemoizedSkeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-3">
        <MemoizedSkeleton className="h-4 w-full" />
        <MemoizedSkeleton className="h-4 w-5/6" />
        <MemoizedSkeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <MemoizedSkeleton className="h-6 w-16 rounded-full" />
          <MemoizedSkeleton className="h-6 w-20 rounded-full" />
        </div>
        <MemoizedSkeleton className="h-8 w-8 rounded" />
      </div>
    </OptimizedCardSkeleton>
  )
})

// Optimized page skeleton
export const OptimizedPageSkeleton = memo(function PageSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 border-r bg-card">
        <div className="p-6 space-y-4">
          <MemoizedSkeleton className="h-8 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <MemoizedSkeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
      <main className="flex-1 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <MemoizedSkeleton className="h-8 w-48" />
            <MemoizedSkeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <OptimizedJobCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
})
