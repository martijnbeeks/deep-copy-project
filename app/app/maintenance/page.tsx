"use client"

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function MaintenanceContent() {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Check if bypass token is provided in URL
    const bypassToken = searchParams.get('bypass')
    
    if (bypassToken === process.env.NEXT_PUBLIC_MAINTENANCE_BYPASS_TOKEN || 
        bypassToken === 'your-secret-token-here') {
      // Set bypass cookie and redirect to home
      document.cookie = `maintenance-bypass=true; path=/; max-age=${60 * 60 * 24 * 7}` // 7 days
      window.location.href = '/'
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
            <svg
              className="w-10 h-10 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Under Maintenance
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            We're currently performing scheduled maintenance
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Our application is temporarily unavailable while we make improvements. 
            We'll be back shortly.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please check back soon
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    }>
      <MaintenanceContent />
    </Suspense>
  )
}

