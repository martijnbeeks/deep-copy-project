/**
 * Centralized logging utility
 * Replaces console.log/error/warn with a configurable logger
 */

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug'

export const logger = {
  log: (...args: any[]) => {

    console.log(...args)

  },

  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args)
  },

  warn: (...args: any[]) => {

    console.warn(...args)

  },

  info: (...args: any[]) => {

    console.info(...args)

  },

  debug: (...args: any[]) => {

    console.debug(...args)

  }
}

