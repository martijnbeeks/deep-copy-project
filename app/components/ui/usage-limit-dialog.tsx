"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertCircle } from "lucide-react"

interface UsageLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usageType: 'deep_research' | 'pre_lander' | 'static_ads'
  currentUsage: number
  limit: number
}

export function UsageLimitDialog({
  open,
  onOpenChange,
  usageType,
  currentUsage,
  limit
}: UsageLimitDialogProps) {
  const usageTypeLabel = usageType === 'deep_research' ? 'Deep Research' : usageType === 'static_ads' ? 'Static Ads' : 'Pre-Lander'
  const usagePercentage = limit > 0 ? Math.min(100, (currentUsage / limit) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1.5 pb-4 border-b">
          <DialogTitle className="text-base font-semibold">Usage Limit Reached</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            You've reached your weekly limit for {usageTypeLabel} actions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Usage Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Current Usage</span>
              <span className="text-xs text-muted-foreground">
                {currentUsage} of {limit}
              </span>
            </div>
            <Progress value={usagePercentage} className="h-1.5" />
          </div>

          {/* Info Message */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your limit resets automatically based on a rolling 7-day window. 
                Please wait for older actions to expire before creating new ones.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <Button 
              onClick={() => onOpenChange(false)} 
              size="sm" 
              className="h-8 px-4"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

