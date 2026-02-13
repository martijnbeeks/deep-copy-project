import { imageJobBackgroundPollingService } from './image-job-background-polling'

// Initialize the image job background polling service
// This should be imported in your app's entry point (e.g., _app.tsx or layout.tsx)

export const initializeImageJobPolling = () => {
  // Start the service in the background
  if (typeof window !== 'undefined') {
    // Only run on client side
    imageJobBackgroundPollingService.start()
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      imageJobBackgroundPollingService.stop()
    })
  }
}

// Export the service for direct access if needed
export { imageJobBackgroundPollingService }
