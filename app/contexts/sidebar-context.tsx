"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed"

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Always initialize to false on server to prevent hydration mismatch
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(false)
  const [isMounted, setIsMounted] = useState(false)

  // Sync with localStorage after hydration
  useEffect(() => {
    setIsMounted(true)
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored) {
      try {
        setIsCollapsedState(JSON.parse(stored))
      } catch {
        // Invalid stored value, use default
      }
    }
  }, [])

  // Persist to localStorage whenever state changes (only after mount)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isCollapsed))
    }
  }, [isCollapsed, isMounted])

  const setIsCollapsed = (collapsed: boolean) => {
    setIsCollapsedState(collapsed)
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}
