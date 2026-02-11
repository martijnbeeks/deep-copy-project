"use client";

import { CreditCard, Calendar, CheckCircle2, Zap, HelpCircle, Info } from "lucide-react";
import { UserSubscription, BILLING_PLANS } from "@/lib/constants/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditConsumptionInfo } from "./credit-consumption-info";

interface UnifiedPlanSectionProps {
  subscription: UserSubscription;
  onManage: () => void;
}

export function UnifiedPlanSection({ subscription, onManage }: UnifiedPlanSectionProps) {
  const plan = BILLING_PLANS.find(p => p.id === subscription.planId);
  
  if (!plan) return null;

  return (
    <div className="space-y-6">
      <Card className="border shadow-sm overflow-hidden pt-0">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl pt-4">{plan.name} Plan</CardTitle>
                <CardDescription>Monthly subscription</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 capitalize px-3 py-1">
              {subscription.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Cost</p>
              <p className="text-2xl font-black">€{plan.price}</p>
            </div>
            
            <div className="space-y-1 border-l md:pl-6 border-muted">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Plan Credits</p>
              <p className="text-2xl font-black">{subscription.planCredits ?? subscription.creditLimit}</p>
              {subscription.adminBonusCredits && subscription.adminBonusCredits > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                  + {subscription.adminBonusCredits} admin bonus
                </p>
              )}
            </div>

            <div className="flex gap-4 md:pl-6 border-l border-muted">
              <Button onClick={onManage} variant="outline" className="flex-1 h-12 gap-2 font-semibold">
                <CreditCard className="h-4 w-4" />
                Manage Plan
              </Button>
            </div>
          </div>

          <div className="pt-8 border-t border-dashed">
            <CreditConsumptionInfo />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
