"use client";

import { Check } from "lucide-react";
import { BILLING_PLANS } from "@/lib/constants/billing";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingCardsProps {
  onSubscribe: (priceId: string) => void;
  isLoading?: boolean;
}

export function PricingCards({ onSubscribe, isLoading }: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {BILLING_PLANS.map((plan) => (
        <Card key={plan.id} className={cn(
          "relative flex flex-col transition-all duration-300 hover:shadow-lg border-2",
          plan.id === 'business' ? "border-primary shadow-md scale-105 z-10" : "hover:border-primary/50"
        )}>
          {plan.id === 'business' && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Most Popular
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-2xl">{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-6">
              <span className="text-4xl font-bold">€{plan.price}</span>
              <span className="text-muted-foreground ml-1">/month</span>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-semibold mb-1">Credits included: {plan.credits}</div>
                <div className="text-xs text-muted-foreground">€{plan.overagePrice} per extra credit</div>
              </div>
              
              <ul className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              variant={plan.id === 'business' ? 'default' : 'outline'}
              onClick={() => onSubscribe(plan.priceId)}
              disabled={isLoading}
            >
              Subscribe
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
