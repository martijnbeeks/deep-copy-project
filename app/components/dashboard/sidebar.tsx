"use client"

import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { LayoutDashboard, LogOut, PenTool, Loader2, FileText, Sun, Moon, Building2, User as UserIcon, Coins, Bell } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Sidebar as UISidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { useBillingStore } from "@/stores/billing-store"
import { useNotificationsStore, selectUnseenCount } from "@/stores/notifications-store"
import { Zap } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  /*{ name: "Create", href: "/create", icon: PenTool },*/
  { name: "Templates", href: "/templates", icon: FileText },
]

export function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore()
  const { currentUsage, creditLimit, fetchBillingStatus, isLoading: isBillingLoading } = useBillingStore()
  const unseenCount = useNotificationsStore(selectUnseenCount)
  const togglePanel = useNotificationsStore((s) => s.togglePanel)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loadingItem, setLoadingItem] = useState<string | null>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initial fetch of billing status
  useEffect(() => {
    if (mounted && user?.email) {
      fetchBillingStatus(user.email)
    }
  }, [mounted, user, fetchBillingStatus])

  // Build navigation array based on admin status (from auth store - set during login)
  const navigation = [
    ...baseNavigation,
    ...(isAdmin ? [{ name: "Manage Organization", href: "/organizations/admin", icon: Building2 }] : [])
  ]

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

  const usagePercentage = creditLimit > 0 ? (currentUsage / creditLimit) * 100 : 0
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toString()
  }

  return (
    <div className="fixed left-0 top-0 h-screen z-50 w-16 hover:w-64 transition-all duration-300 group bg-sidebar border-r border-sidebar-border overflow-hidden">
      <UISidebar className="h-full w-full bg-sidebar" collapsible="none">
        <SidebarContent>
          <Link href="/dashboard" className="p-4 pb-0 flex items-center justify-center gap-2 transition-opacity">
            <div className="w-7 h-7 group-hover:w-[134px] group-hover:h-[34px] flex items-center justify-center flex-shrink-0 relative transition-all duration-300">
              {/* Favicon - shown when collapsed */}
              <Image
                src="/favicon.svg"
                alt="DeepCopy"
                width={28}
                height={28}
                className="opacity-100 group-hover:opacity-0 transition-opacity duration-300"
              />
              {/* Full logo - shown when expanded */}
              <Image
                src="/deepcopy-logo.svg"
                alt="DeepCopy"
                width={134}
                height={34}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 object-contain"
              />
            </div>
          </Link>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  const isLoading = loadingItem === item.href

                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                      >
                        <button
                          onClick={() => handleNavigation(item.href)}
                          disabled={isLoading}
                          className={cn(
                            "w-full flex items-center gap-3",
                            isActive
                              ? "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground"
                              : "hover:bg-primary/50",
                            isLoading && "opacity-70 cursor-not-allowed"
                          )}
                        >
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                          ) : (
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                          )}
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                            {item.name}
                          </span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="px-0 group-hover:px-3 py-4 mb-2 transition-all duration-300">
            {/* Credits Display */}
            <div 
              className="flex flex-col gap-1 group-hover:gap-2.5 p-1.5 group-hover:p-3 rounded-none group-hover:rounded-xl border border-transparent group-hover:border-sidebar-border bg-transparent group-hover:bg-muted/30 group/credits cursor-pointer hover:group-hover:bg-muted/50 transition-all duration-300 overflow-hidden items-center group-hover:items-stretch"
              onClick={() => router.push("/billing")}
            >
              {/* Line 1: Credits Label */}
              <div className="flex items-center min-w-0 w-full justify-center group-hover:justify-start">
                <span className="text-[10px] group-hover:text-[10px] font-bold text-muted-foreground uppercase tracking-widest transition-all duration-300">
                  Credits
                </span>
              </div>
              
              {/* Line 2: Usage (x / x) */}
              <div className="flex items-center justify-center group-hover:justify-start min-w-0 w-full">
                <p className="text-[10px] group-hover:text-xs font-bold text-foreground whitespace-nowrap leading-none transition-all duration-300">
                  <span className="text-primary">{formatNumber(currentUsage)}</span>
                  <span className="text-muted-foreground/60 mx-1 font-medium">/</span>
                  <span>{formatNumber(creditLimit)}</span>
                </p>
              </div>
              
              {/* Progress Bar (Expanded only) */}
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-all duration-300 hidden group-hover:block mt-2">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, usagePercentage)}%` }}
                />
              </div>
            </div>
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button 
                  onClick={() => router.push("/billing")}
                  className="flex items-center gap-2 w-full cursor-pointer pl-0"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                    {user?.name || user?.email || "Account"}
                  </span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton onClick={togglePanel}>
                <div className="relative flex-shrink-0">
                  <Bell className="h-5 w-5" />
                  {mounted && unseenCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {unseenCount > 99 ? '99+' : unseenCount}
                    </span>
                  )}
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                  Notifications
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  if (mounted) {
                    const newTheme = theme === "dark" ? "light" : "dark"
                    setTheme(newTheme)
                    // Also update localStorage to sync with ThemeToggle component
                    localStorage.setItem("theme", newTheme)
                  }
                }}
              >
                {mounted && theme === "dark" ? (
                  <Sun className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <Moon className="h-5 w-5 flex-shrink-0" />
                )}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                  Theme
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => {
                logout();
                router.replace("/login");
              }}>
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                  Logout
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </UISidebar>
    </div>
  )
}

// Sidebar Trigger Button Component - keeping the existing one but simplified
export function SidebarTrigger() {
  return null // Not needed with hover-based sidebar
}
