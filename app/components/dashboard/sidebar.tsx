"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { LayoutDashboard, LogOut, PenTool, Loader2, Grid3X3 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSidebar } from "@/contexts/sidebar-context"
import { useState } from "react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Create", href: "/create", icon: PenTool },
  { name: "Gallery", href: "/gallery", icon: Grid3X3 },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const [loadingItem, setLoadingItem] = useState<string | null>(null)

  const handleNavigation = async (href: string) => {
    if (href === pathname) return

    const item = navigation.find(nav => nav.href === href)
    setLoadingItem(href)

    // Add a very short delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 50))

    router.push(href)

    // Clear loading state after navigation
    setTimeout(() => {
      setLoadingItem(null)
    }, 200)
  }

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      <div className={cn(
        "flex h-full flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50",
        // Desktop behavior
        "hidden md:flex",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {/* Desktop sidebar content */}
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <PenTool className="h-6 w-6 text-sidebar-primary" />
            {!isCollapsed && (
              <span className="text-lg font-bold text-sidebar-foreground">AI Copywriting</span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const isLoading = loadingItem === item.href
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                disabled={isLoading}
                data-active={isActive}
                className={cn(
                  "sidebar-nav-item w-full group relative overflow-hidden rounded-md transition-all duration-200 ease-in-out",
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
                  isCollapsed ? "justify-center px-2" : "justify-start",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground",
                  isLoading && "opacity-70 cursor-not-allowed",
                  "hover:scale-[1.02] active:scale-[0.98]"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <div className="flex items-center gap-3 w-full">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                  )}
                  {!isCollapsed && (
                    <span className="truncate">
                      {item.name}
                    </span>
                  )}
                </div>

                {/* Hover effect overlay */}
                <div className={cn(
                  "absolute inset-0 bg-sidebar-accent/20 opacity-0 transition-opacity duration-200",
                  "group-hover:opacity-100",
                  isActive && "opacity-0"
                )} />
              </button>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className={cn("flex items-center gap-3 mb-3", isCollapsed ? "justify-center" : "")}>
            <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-primary-foreground">{user?.name?.charAt(0) || "U"}</span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <div className={cn("flex items-center gap-2 mb-2", isCollapsed ? "flex-col" : "")}>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className={cn(
                "text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer",
                isCollapsed ? "w-full justify-center px-2" : "flex-1 justify-start gap-2"
              )}
              title={isCollapsed ? "Sign Out" : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && "Sign Out"}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={cn(
        "flex h-full flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50",
        // Mobile behavior
        "fixed md:hidden",
        isCollapsed ? "-translate-x-full" : "translate-x-0",
        "w-80"
      )}>
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <PenTool className="h-6 w-6 text-sidebar-primary" />
            <span className="text-lg font-bold text-sidebar-foreground">AI Copywriting</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const isLoading = loadingItem === item.href
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                disabled={isLoading}
                data-active={isActive}
                className={cn(
                  "sidebar-nav-item w-full group relative overflow-hidden rounded-md transition-all duration-200 ease-in-out",
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium justify-start",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground",
                  isLoading && "opacity-70 cursor-not-allowed",
                  "hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {item.name}
                  </span>
                </div>

                {/* Hover effect overlay */}
                <div className={cn(
                  "absolute inset-0 bg-sidebar-accent/20 opacity-0 transition-opacity duration-200",
                  "group-hover:opacity-100",
                  isActive && "opacity-0"
                )} />
              </button>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-primary-foreground">{user?.name?.charAt(0) || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="flex-1 justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
