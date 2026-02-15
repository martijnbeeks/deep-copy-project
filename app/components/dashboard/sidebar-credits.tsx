"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Coins, AlertCircle, CreditCard, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

interface SidebarCreditsProps {
  /** Current number of credits used */
  currentUsage: number;
  /** Total credit limit available */
  creditLimit: number;
  /** Whether the billing data is loading */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
  /** Optional expiration date string to display in tooltip */
  expirationDate?: string;
}

/**
 * SidebarCredits component displays credit usage in a compact circular progress format.
 * Designed to fit within the collapsed sidebar (w-16) while providing detailed info on hover via tooltip.
 *
 * @example
 * <SidebarCredits
 *   currentUsage={500}
 *   creditLimit={1000}
 *   isLoading={false}
 * />
 */
export function SidebarCredits({
  currentUsage = 0,
  creditLimit = 0,
  isLoading = false,
  className,
  expirationDate,
}: SidebarCreditsProps) {
  const router = useRouter();
  const usagePercentage =
    creditLimit > 0 ? (currentUsage / creditLimit) * 100 : 0;

  // Format numbers for compact display (e.g. 1.2k)
  const formatCompact = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  };

  // Determine status color based on usage
  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-500";
    if (percentage >= 75) return "text-yellow-500";
    return "text-primary";
  };

  const statusColor = getStatusColor(usagePercentage);

  return (
    <div
      className={cn(
        "relative flex items-center p-[0.25rem] w-full h-full cursor-pointer group/credits transition-all duration-300 hover:bg-muted/50 rounded-md",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        router.push("/billing");
      }}
      role="button"
      aria-label={`Credits usage: ${currentUsage} of ${creditLimit}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push("/billing");
        }
      }}
    >
      {/* Compact View (Icon + Ring) */}
      <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
        <div className="flex flex-col items-center justify-center gap-0.5 z-10">
          <span
            className={cn(
              "text-[9px] font-bold leading-none tracking-tight",
              statusColor
            )}
          >
            {formatCompact(currentUsage)}
          </span>
          <div className="w-3 h-[1px] bg-border" />
          <span className="text-[9px] text-muted-foreground leading-none tracking-tight">
            {formatCompact(creditLimit)}
          </span>
        </div>

        {/* Circular progress indicator */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox="0 0 32 32"
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted/20"
          />
          <motion.circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={statusColor}
            strokeDasharray={88} // 2 * pi * 14 approx 88
            strokeDashoffset={88 - (88 * Math.min(100, usagePercentage)) / 100}
            initial={{ strokeDashoffset: 88 }}
            animate={{
              strokeDashoffset:
                88 - (88 * Math.min(100, usagePercentage)) / 100,
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Expanded View (Label + Text) - Only visible when sidebar expands (group-hover on parent sidebar) */}
      <div className="hidden group-hover:flex flex-col ml-3 min-w-0 flex-1 transition-opacity duration-300 opacity-0 group-hover:opacity-100 overflow-hidden">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-semibold truncate">Credits</span>
          <span className={cn("text-[10px] font-bold", statusColor)}>
            {Math.round(usagePercentage)}%
          </span>
        </div>
        <div className="w-full bg-muted/30 rounded-full h-1.5 mt-1 overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              statusColor.replace("text-", "bg-")
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, usagePercentage)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground truncate mt-0.5">
          {formatCompact(currentUsage)} / {formatCompact(creditLimit)} used
        </span>
      </div>
    </div>
  );
}
