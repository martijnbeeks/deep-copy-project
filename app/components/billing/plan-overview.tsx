"use client";

import { CreditCard, Calendar, CheckCircle2 } from "lucide-react";
import { UserSubscription, BILLING_PLANS } from "@/lib/constants/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PlanOverviewProps {
  subscription: UserSubscription;
  onManage: () => void;
}

export function PlanOverview({ subscription, onManage }: PlanOverviewProps) {
  const plan = BILLING_PLANS.find(p => p.id === subscription.planId);
  
  if (!plan) return null;

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">{plan.name} Plan</h3>
          <p className="text-sm text-muted-foreground">Monthly subscription</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {subscription.status}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">Monthly Cost</div>
          <div className="text-xl font-semibold">€{plan.price}</div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">Billing Cycle</div>
          <div className="text-xl font-semibold capitalize">{subscription.billingCycle}</div>
        </div>

        <div className="bg-muted/30 rounded-lg p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">Subscription</div>
          <Button onClick={onManage} variant="outline" className="w-full">
            Manage Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
