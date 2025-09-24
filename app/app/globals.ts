// Global cleanup for polling when page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // This will be called when the page is about to unload
    // We can't directly call the store here, but the component cleanup should handle it
    console.log('Page unloading - polling should be cleaned up by component unmount')
  })
}
