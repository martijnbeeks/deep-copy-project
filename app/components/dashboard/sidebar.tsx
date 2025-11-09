"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { LayoutDashboard, LogOut, PenTool, Loader2, FileText, ChevronLeft, ChevronRight, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSidebar } from "@/contexts/sidebar-context"
import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Create", href: "/create", icon: PenTool },
  { name: "Templates", href: "/templates", icon: FileText },
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

    await new Promise(resolve => setTimeout(resolve, 50))
    router.push(href)

    setTimeout(() => {
      setLoadingItem(null)
    }, 200)
  }

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className={cn(
        "relative flex h-screen flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-50",
        "hidden md:flex",
        isCollapsed ? "w-20" : "w-80"
      )}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border bg-sidebar/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">AI</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="text-xl font-bold text-sidebar-foreground block truncate">DeepCopy</span>
                <span className="text-xs text-sidebar-foreground/60">AI Content</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="p-3 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const isLoading = loadingItem === item.href
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  disabled={isLoading}
                  className={cn(
                    "w-full group relative rounded-xl transition-all duration-200",
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium",
                    isCollapsed ? "justify-center px-3" : "justify-start",
                    isActive
                      ? "bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    isLoading && "opacity-70 cursor-not-allowed"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                  ) : (
                    <item.icon className={cn(
                      "h-5 w-5 flex-shrink-0 transition-transform",
                      isActive && "scale-110"
                    )} />
                  )}
                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{item.name}</span>
                  )}
                  {isActive && !isCollapsed && (
                    <div className="absolute right-2 w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                  )}
                </button>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4 bg-sidebar/95 backdrop-blur-sm">
          <div className={cn("flex items-center gap-3 mb-3", isCollapsed ? "justify-center" : "")}>
            <div className="h-10 w-10 rounded-full bg-gradient-accent flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-sm font-semibold text-accent-foreground">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <div className={cn("flex items-center gap-2", isCollapsed ? "flex-col" : "")}>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className={cn(
                "text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
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

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 flex h-screen flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 z-50",
        "md:hidden",
        isCollapsed ? "-translate-x-full" : "translate-x-0",
        "w-80"
      )}>
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-sm">AI</span>
            </div>
            <div>
              <span className="text-xl font-bold text-sidebar-foreground block">DeepCopy</span>
              <span className="text-xs text-sidebar-foreground/60">AI Content</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <nav className="p-3 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const isLoading = loadingItem === item.href
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  disabled={isLoading}
                  className={cn(
                    "w-full group relative rounded-xl transition-all duration-200",
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium justify-start",
                    isActive
                      ? "bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    isLoading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                </button>
              )
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gradient-accent flex items-center justify-center shadow-lg">
              <span className="text-sm font-semibold text-accent-foreground">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="flex-1 justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent/50"
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

// Sidebar Trigger Button Component
export function SidebarTrigger() {
  const { isCollapsed, setIsCollapsed } = useSidebar()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsCollapsed(!isCollapsed)}
      className="h-9 w-9 p-0 border-border/50 hover:border-border hover:bg-muted/50 transition-all duration-200 shadow-sm hover:shadow-md"
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? (
        <ChevronRight className="h-4 w-4" />
      ) : (
        <ChevronLeft className="h-4 w-4" />
      )}
    </Button>
  )
}
