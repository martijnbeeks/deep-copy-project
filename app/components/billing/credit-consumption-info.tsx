"use client";

import { Info, Zap, Search, Layout, FileText, Image as ImageIcon } from "lucide-react";
import { getAllFeaturePricing, FeaturePricing } from "@/lib/constants/job-credits";
import { Card, CardContent } from "@/components/ui/card";

const FEATURE_ICONS: Record<string, any> = {
  "Deep Research": Search,
  "Pre Lander": Layout,
  "Static Ads": FileText,
  "Advetorial Image": ImageIcon,
};

export function CreditConsumptionInfo() {
  const featureCosts = getAllFeaturePricing();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              <h4 className="font-bold text-lg">Credit Consumption Breakdown</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Credits are consumed based on the type of job you run. Here's a breakdown of the cost for each feature.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {featureCosts.map((feature, index) => {
          const Icon = FEATURE_ICONS[feature.name] || Info;
          return (
            <Card key={index} className="border-none bg-muted/50 overflow-hidden group hover:bg-muted transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-background border group-hover:border-primary/50 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{feature.name}</span>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {feature.cost} credits
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground italic">
                      {feature.unit}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">About Rollover & Resets</p>
            <p className="text-xs text-muted-foreground">
              Included credits reset at the start of each billing cycle. If you go over your limit, additional usage is billed at your plan's overage rate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
