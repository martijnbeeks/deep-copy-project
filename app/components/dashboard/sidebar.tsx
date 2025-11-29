"use client"

import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { LayoutDashboard, LogOut, PenTool, Loader2, FileText, Sun, Moon, Building2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  /*{ name: "Create", href: "/create", icon: PenTool },*/
  { name: "Templates", href: "/templates", icon: FileText },
]

export function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [loadingItem, setLoadingItem] = useState<string | null>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

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

  return (
    <div className="fixed left-0 top-0 h-screen z-50 w-16 hover:w-64 transition-all duration-300 group bg-sidebar border-r border-sidebar-border overflow-hidden">
      <UISidebar className="h-full w-full bg-sidebar" collapsible="none">
        <SidebarContent>
          <Link href="/dashboard" className="p-4 pb-0 flex items-center justify-center gap-2 transition-opacity">
            <div className="w-10 h-10 group-hover:w-48 group-hover:h-12 flex items-center justify-center flex-shrink-0 relative transition-all duration-300">
              {/* Favicon - shown when collapsed */}
              <Image
                src="/favicon.svg"
                alt="DeepCopy"
                width={40}
                height={40}
                className="opacity-100 group-hover:opacity-0 transition-opacity duration-300"
              />
              {/* Full logo - shown when expanded */}
              <Image
                src="/deepcopy-logo.svg"
                alt="DeepCopy"
                width={192}
                height={48}
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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button className="flex items-center gap-2 w-full cursor-pointer pl-0">
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
