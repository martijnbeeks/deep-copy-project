"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"

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
  | { type: "ADD_NOTIFICATION"; payload: Omit<AppState["notifications"][0], "id" | "timestamp"> }
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
      return {
        ...state,
        notifications: [
          ...state.notifications,
          {
            ...action.payload,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
          },
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

  const addNotification = (notification: Omit<AppState["notifications"][0], "id" | "timestamp">) => {
    dispatch({ type: "ADD_NOTIFICATION", payload: notification })

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      dispatch({ type: "REMOVE_NOTIFICATION", payload: { id: notification.title } })
    }, 5000)
  }

  const removeNotification = (id: string) => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: { id } })
  }

  const clearNotifications = () => {
    dispatch({ type: "CLEAR_NOTIFICATIONS" })
  }

  const setOnlineStatus = (isOnline: boolean) => {
    dispatch({ type: "SET_ONLINE_STATUS", payload: { isOnline } })
  }

  const updateLastSync = () => {
    dispatch({ type: "UPDATE_LAST_SYNC", payload: { timestamp: Date.now() } })
  }

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
