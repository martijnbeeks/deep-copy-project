"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ImageIcon, X } from "lucide-react"

interface ImageGenerationFloaterProps {
  onYes: () => void
  onNo: () => void
}

export function ImageGenerationFloater({ onYes, onNo }: ImageGenerationFloaterProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4 max-w-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Generate images for this prelander?</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setIsVisible(false)
            onYes()
          }}
          className="w-full"
        >
          Yes
        </Button>
      </div>
    </div>
  )
}

