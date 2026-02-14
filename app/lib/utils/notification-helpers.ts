import type { JobWithTemplate } from '@/lib/db/types'

export function getResultPath(job: JobWithTemplate): string {
  if (job.target_approach === 'v2') {
    return `/results/${job.id}`
  }
  if (job.avatars && Array.isArray(job.avatars) && job.avatars.length > 0) {
    return `/avatars/${job.id}`
  }
  return `/results/${job.id}`
}

export function getRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(isoString).toLocaleDateString()
}
