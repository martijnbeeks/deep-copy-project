"use client";

import { Info, TrendingUp, Zap, HelpCircle } from "lucide-react";
import { UserSubscription, BILLING_PLANS } from "@/lib/constants/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditConsumptionInfo } from "./credit-consumption-info";

interface UsageSectionProps {
  subscription: UserSubscription;
}

export function UsageSection({ subscription }: UsageSectionProps) {
  const plan = BILLING_PLANS.find(p => p.id === subscription.planId);
  const usagePercentage = (subscription.currentUsage / subscription.creditLimit) * 100;
  const isNearLimit = usagePercentage > 80;
  const isOverLimit = subscription.currentUsage > subscription.creditLimit;

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary fill-primary/10" />
              Credit Wallet
            </h3>
            <p className="text-sm text-muted-foreground">Manage and track your usage</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Credits</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-primary">
                  {Math.max(0, subscription.creditLimit - subscription.currentUsage).toLocaleString()}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  Credits remaining
                </p>
              </div>
            </div>

            <div className="text-left md:text-right space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Usage</p>
              <p className={`text-xl font-bold ${isOverLimit ? "text-destructive" : "text-foreground"}`}>
                {subscription.currentUsage.toLocaleString()} <span className="text-muted-foreground font-medium text-sm">/ {subscription.creditLimit.toLocaleString()} used</span>
              </p>
            </div>
          </div>
          
          <div className="relative pt-2">
            <Progress 
              value={Math.min(100, usagePercentage)} 
              className="h-4 bg-muted"
            />
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3.5 w-3.5" />
                  {Math.round(usagePercentage)}% of plan limit
                </TooltipTrigger>
                <TooltipContent>
                  <p>Usage resets at the beginning of each billing cycle.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex gap-2">
              {isNearLimit && !isOverLimit && (
                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                  Running low
                </span>
              )}
              {isOverLimit && (
                <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                  Overage active
                </span>
              )}
            </div>
          </div>
        </div>

        {isOverLimit && plan && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-5 border border-amber-200 dark:border-amber-900/50 shadow-inner">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-100">Overage Billing Active</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Your account has exceeded the plan limit. Additional usage is automatically billed.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-amber-200/50 dark:border-amber-900/50 text-center">
                    <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Price Per Credit</p>
                    <p className="text-lg font-black text-amber-900 dark:text-amber-100">€{plan.overagePrice}</p>
                  </div>
                  <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-amber-200/50 dark:border-amber-900/50 text-center">
                    <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Current Overage Est.</p>
                    <p className="text-lg font-black text-amber-900 dark:text-amber-100">
                      €{((subscription.currentUsage - subscription.creditLimit) * plan.overagePrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
