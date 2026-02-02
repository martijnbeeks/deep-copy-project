/**
 * Polling interval constants (in milliseconds)
 * Centralized to avoid magic numbers throughout the codebase
 */
export const POLLING_INTERVALS = {
  /** Simple polling interval for processing jobs */
  SIMPLE_POLLING: 5000,
  /** Job polling interval */
  JOB_POLLING: 10000,
  /** Marketing angle polling interval */
  MARKETING_ANGLE_POLLING: 5000,
  /** Global polling interval */
  GLOBAL_POLLING: 5000,
} as const

/**
 * Debounce delay constants (in milliseconds)
 */
export const DEBOUNCE_DELAYS = {
  /** Search input debounce delay */
  SEARCH: 500,
  /** Form input debounce delay */
  FORM_INPUT: 300,
} as const

