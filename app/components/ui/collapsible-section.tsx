"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
    title: string
    description?: string
    icon?: React.ReactNode
    children: React.ReactNode
    defaultExpanded?: boolean
    className?: string
    isExpanded?: boolean
    onToggle?: () => void
}

export function CollapsibleSection({
    title,
    description,
    icon,
    children,
    defaultExpanded = false,
    className,
    isExpanded = false,
    onToggle
}: CollapsibleSectionProps) {
    const handleToggle = () => {
        onToggle?.()
    }

    return (
        <div className={cn("border-b border-border/50 pb-6", className)}>
            <button
                onClick={handleToggle}
                className="flex items-center justify-between w-full text-left py-4 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="text-muted-foreground">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                        {description && (
                            <p className="text-sm text-muted-foreground mt-1">{description}</p>
                        )}
                    </div>
                </div>
                <div className="text-muted-foreground">
                    {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                    ) : (
                        <ChevronRight className="h-5 w-5" />
                    )}
                </div>
            </button>

            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "max-h-none opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <div className="pt-2">
                    {children}
                </div>
            </div>
        </div>
    )
}
