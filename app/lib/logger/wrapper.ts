import { v4 as uuidv4 } from 'uuid';
import { logContextStorage, LogContext } from './context';
import { logger } from './index';

/**
 * Higher-order function to wrap API handlers with a logging context.
 */
export function withLogger<T = any>(
  handler: (request: any, ...args: any[]) => Promise<T>
) {
  return async (request: any, ...args: any[]) => {
    // Generate or extract request ID
    const requestId = request.headers.get('x-request-id') || uuidv4();
    
    const context: LogContext = {
      requestId,
    };

    return logContextStorage.run(context, async () => {
      logger.info(`Incoming request: ${request.method} ${request.url}`);
      
      try {
        const response = await handler(request, ...args);
        
        // If it's a NextResponse/Response object, attach the requestId header
        if (response instanceof Response) {
          response.headers.set('X-Request-Id', requestId);
        }
        
        return response;
      } catch (error: any) {
        logger.error(`Request failed: ${error.message}`, { 
          stack: error.stack,
          url: request.url,
          method: request.method
        });
        throw error;
      }
    });
  };
}
