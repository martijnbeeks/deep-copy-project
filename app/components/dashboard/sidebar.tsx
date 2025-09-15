"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { LayoutDashboard, FileText, BarChart3, Settings, LogOut, PenTool } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSidebar } from "@/contexts/sidebar-context"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Create", href: "/create", icon: PenTool },
  { name: "Jobs", href: "/jobs", icon: FileText },
  { name: "Results", href: "/results", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const { isCollapsed, setIsCollapsed } = useSidebar()

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
            return (
              <Link key={item.name} href={item.href} className="cursor-pointer">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full cursor-pointer",
                    isCollapsed ? "justify-center px-2" : "justify-start gap-3",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {!isCollapsed && item.name}
                </Button>
              </Link>
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
            return (
              <Link key={item.name} href={item.href} className="cursor-pointer">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full cursor-pointer justify-start gap-3",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
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
