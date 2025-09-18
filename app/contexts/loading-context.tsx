"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface LoadingContextType {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  loadingMessage: string
  setLoadingMessage: (message: string) => void
  loadingPage: string | null
  setLoadingPage: (page: string | null) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("Loading...")
  const [loadingPage, setLoadingPage] = useState<string | null>(null)

  return (
    <LoadingContext.Provider value={{ 
      isLoading, 
      setIsLoading, 
      loadingMessage, 
      setLoadingMessage,
      loadingPage,
      setLoadingPage
    }}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider")
  }
  return context
}
