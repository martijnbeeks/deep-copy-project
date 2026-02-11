import winston from 'winston';
import { getLogContext } from './context';

/**
 * Custom format to inject context into the log entry
 */
const contextFormat = winston.format((info) => {
  const context = getLogContext();
  if (context) {
    info.requestId = context.requestId;
    if (context.userId) info.userId = context.userId;
    if (context.organizationId) info.organizationId = context.organizationId;
    if (context.eventId) info.eventId = context.eventId;
    if (context.eventType) info.eventType = context.eventType;
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    contextFormat(),
    winston.format.json({ space: 2 })
  ),
  transports: [
    new winston.transports.Console()
  ],
});

export { logger };
