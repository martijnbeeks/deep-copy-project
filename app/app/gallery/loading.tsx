import { Suspense } from "react"
import { Loader2 } from "lucide-react"

export default function GalleryLoading() {
  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 overflow-hidden md:ml-0">
        <div className="p-4 md:p-6 overflow-y-auto h-full">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Results Gallery</h1>
                <p className="text-muted-foreground">Loading your generated templates...</p>
              </div>
            </div>
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
