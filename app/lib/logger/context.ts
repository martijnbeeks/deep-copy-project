import { AsyncLocalStorage } from 'async_hooks';

export interface LogContext {
  requestId: string;
  userId?: string;
  organizationId?: string;
  [key: string]: any;
}

export const logContextStorage = new AsyncLocalStorage<LogContext>();

/**
 * Returns the current request context from storage.
 */
export const getLogContext = (): LogContext | undefined => {
  return logContextStorage.getStore();
};
