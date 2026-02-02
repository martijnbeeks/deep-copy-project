// Global cleanup for polling when page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Component cleanup should handle polling cleanup
  })
}
