"use client"

import { createContext, useContext, useReducer, useRef, useCallback, useEffect, type ReactNode } from "react"

interface AppState {
  notifications: Array<{
    id: string
    type: "success" | "error" | "warning" | "info"
    title: string
    message: string
    timestamp: number
  }>
  isOnline: boolean
  lastSync: number | null
}

type AppAction =
  | { type: "ADD_NOTIFICATION"; payload: AppState["notifications"][0] }
  | { type: "REMOVE_NOTIFICATION"; payload: { id: string } }
  | { type: "SET_ONLINE_STATUS"; payload: { isOnline: boolean } }
  | { type: "UPDATE_LAST_SYNC"; payload: { timestamp: number } }
  | { type: "CLEAR_NOTIFICATIONS" }

const initialState: AppState = {
  notifications: [],
  isOnline: true,
  lastSync: null,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_NOTIFICATION":
      // ID and timestamp are now provided in payload
      return {
        ...state,
        notifications: [
          ...state.notifications,
          action.payload as AppState["notifications"][0],
        ],
      }
    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.payload.id),
      }
    case "SET_ONLINE_STATUS":
      return {
        ...state,
        isOnline: action.payload.isOnline,
      }
    case "UPDATE_LAST_SYNC":
      return {
        ...state,
        lastSync: action.payload.timestamp,
      }
    case "CLEAR_NOTIFICATIONS":
      return {
        ...state,
        notifications: [],
      }
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  addNotification: (notification: Omit<AppState["notifications"][0], "id" | "timestamp">) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  setOnlineStatus: (isOnline: boolean) => void
  updateLastSync: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}

interface AppProviderProps {
  children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout))
      timeoutRefs.current.clear()
    }
  }, [])

  const addNotification = useCallback((notification: Omit<AppState["notifications"][0], "id" | "timestamp">) => {
    // Generate ID before dispatching
    const id = Math.random().toString(36).substr(2, 9)
    
    dispatch({ 
      type: "ADD_NOTIFICATION", 
      payload: { ...notification, id, timestamp: Date.now() } 
    })

    // Auto-remove notification after 5 seconds
    const timeoutId = setTimeout(() => {
      dispatch({ type: "REMOVE_NOTIFICATION", payload: { id } })
      timeoutRefs.current.delete(id)
    }, 5000)
    
    timeoutRefs.current.set(id, timeoutId)
  }, [])

  const removeNotification = useCallback((id: string) => {
    // Clear timeout if notification is manually removed
    const timeoutId = timeoutRefs.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutRefs.current.delete(id)
    }
    dispatch({ type: "REMOVE_NOTIFICATION", payload: { id } })
  }, [])

  const clearNotifications = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout))
    timeoutRefs.current.clear()
    dispatch({ type: "CLEAR_NOTIFICATIONS" })
  }, [])

  const setOnlineStatus = useCallback((isOnline: boolean) => {
    dispatch({ type: "SET_ONLINE_STATUS", payload: { isOnline } })
  }, [])

  const updateLastSync = useCallback(() => {
    dispatch({ type: "UPDATE_LAST_SYNC", payload: { timestamp: Date.now() } })
  }, [])

  return (
    <AppContext.Provider
      value={{
        state,
        addNotification,
        removeNotification,
        clearNotifications,
        setOnlineStatus,
        updateLastSync,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
