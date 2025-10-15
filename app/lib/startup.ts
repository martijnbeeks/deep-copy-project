import { recoverProcessingJobs } from './services/job-recovery'
import { backgroundPollingService } from './services/background-polling'

// Run job recovery on startup
export async function runStartupTasks() {
  // Wait a bit for the database to be ready
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Recover any processing jobs
  await recoverProcessingJobs()
  
  // Start background polling service
  backgroundPollingService.start()
}

// Run immediately if this is the main process
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  runStartupTasks().catch(() => {})
}
