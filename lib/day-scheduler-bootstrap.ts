import { ensureSchedulerInitialized } from './day-scheduler'

if (typeof window === 'undefined') {
  ensureSchedulerInitialized().catch((error) => {
    console.error('[auto-day] Failed to initialize scheduler', error)
  })
}
