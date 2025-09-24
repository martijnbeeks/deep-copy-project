import { recoverProcessingJobs } from './services/job-recovery'
import { backgroundPollingService } from './services/background-polling'

// Run job recovery on startup
export async function runStartupTasks() {
  console.log('🚀 Starting application...')
  
  // Wait a bit for the database to be ready
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Recover any processing jobs
  await recoverProcessingJobs()
  
  // Start background polling service
  backgroundPollingService.start()
  
  console.log('✅ Startup tasks completed')
}

// Run immediately if this is the main process
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  runStartupTasks().catch(console.error)
}
