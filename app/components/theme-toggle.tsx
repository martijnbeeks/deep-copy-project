"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const handleThemeToggle = () => {
    const html = document.documentElement
    const isDark = html.classList.contains("dark")
    
    if (isDark) {
      html.classList.remove("dark")
      localStorage.setItem("theme", "light")
    } else {
      html.classList.add("dark")
      localStorage.setItem("theme", "dark")
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleThemeToggle}
      className="cursor-pointer"
      type="button"
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="h-4 w-4 hidden dark:block" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
