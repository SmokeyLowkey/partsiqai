import pino from 'pino';
import { randomUUID } from 'crypto';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;

export const workerLogger = logger.child({ module: 'worker' });
export const cronLogger = logger.child({ module: 'cron' });
export const queueLogger = logger.child({ module: 'queue' });
export const apiLogger = logger.child({ module: 'api' });

/**
 * Create a request-scoped logger with a unique request ID.
 * Use in API route handlers to trace a request through the pipeline.
 */
export function createRequestLogger(service: string = 'api') {
  const requestId = randomUUID().slice(0, 8);
  return apiLogger.child({ requestId, service });
}
