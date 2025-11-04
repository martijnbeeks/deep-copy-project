"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { useTemplatesStore } from "@/stores/templates-store"
import { LayoutDashboard, LogOut, PenTool, Loader2, FileText } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSidebar } from "@/contexts/sidebar-context"
import { useState, useEffect } from "react"
import { TemplatePreview } from "@/components/template-preview"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Separator } from "@/components/ui/separator"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Create", href: "/create", icon: PenTool },
  /*{ name: "Gallery", href: "/gallery", icon: Grid3X3 }*/
  { name: "Templates", href: "/templates", icon: FileText },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const [loadingItem, setLoadingItem] = useState<string | null>(null)

  // Template display state - Same source as create page
  const { templates, fetchTemplates, isLoading: templatesLoading, preloadTemplates } = useTemplatesStore()
  const [currentPage, setCurrentPage] = useState(1)
  const templatesPerPage = 4 // Same as create page

  // Preload templates early for better UX - Same as create page
  useEffect(() => {
    preloadTemplates()
  }, [preloadTemplates])

  // Fetch templates - Same as create page
  useEffect(() => {
    if (!isCollapsed) {
      fetchTemplates()
    }
  }, [isCollapsed, fetchTemplates])

  // Pagination logic
  const totalPages = Math.ceil(templates.length / templatesPerPage)
  const startIndex = (currentPage - 1) * templatesPerPage
  const endIndex = startIndex + templatesPerPage
  const currentTemplates = templates.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleTemplateClick = (templateId: string) => {
    router.push(`/create?template=${templateId}`)
  }

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
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AI</span>
            </div>
            {!isCollapsed && (
              <span className="text-xl font-bold text-sidebar-foreground">DeepCopy</span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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
                  "sidebar-nav-item w-full group relative overflow-hidden rounded-lg transition-all duration-200 ease-in-out",
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
                  isCollapsed ? "justify-center px-2" : "justify-start",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/20",
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

          {/* Templates Section - Only show when not collapsed */}
          {!isCollapsed && (
            <>
              <Separator className="my-4" />
              <div className="space-y-6 px-3">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-sidebar-foreground">Available Templates</h3>
                  <p className="text-sm text-sidebar-foreground/60">Click on any template to preview and select it</p>
                </div>

                {templatesLoading ? (
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[350px] md:h-[400px] bg-sidebar-accent/20 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : templates.length > 0 ? (
                  <>
                    <div id="template-section" className="grid gap-6 grid-cols-1 md:grid-cols-2">
                      {currentTemplates.map((template) => (
                        <TemplatePreview
                          key={template.id}
                          template={template}
                          isSelected={false}
                          onClick={() => handleTemplateClick(template.id)}
                        />
                      ))}
                    </div>

                    {/* Pagination - Same as create page */}
                    {totalPages > 1 && (
                      <div className="flex justify-center">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => handlePageChange(currentPage - 1)}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => handlePageChange(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => handlePageChange(currentPage + 1)}
                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-sidebar-foreground/60 text-center py-4">
                    No templates available
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className={cn("flex items-center gap-3 mb-3", isCollapsed ? "justify-center" : "")}>
            <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center shadow-elegant">
              <span className="text-sm font-medium text-accent-foreground">{user?.name?.charAt(0) || "U"}</span>
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
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AI</span>
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">DeepCopy</span>
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
                  "sidebar-nav-item w-full group relative overflow-hidden rounded-lg transition-all duration-200 ease-in-out",
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium justify-start",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/20",
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
            <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center shadow-elegant">
              <span className="text-sm font-medium text-accent-foreground">{user?.name?.charAt(0) || "U"}</span>
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
