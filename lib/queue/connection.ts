// CRITICAL: Load environment variables FIRST
// This runs when the module is imported, ensuring env vars are available
if (!process.env.UPSTASH_REDIS_REST_URL) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
}

import { Redis } from 'ioredis';
import { queueLogger } from '../logger';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;

if (!redisUrl) {
  queueLogger.fatal('UPSTASH_REDIS_REST_URL is not defined. Check your .env file');
  throw new Error('UPSTASH_REDIS_REST_URL is required');
}

queueLogger.info({ url: redisUrl.replace(/:[^:@]+@/, ':****@') }, 'Connecting to Redis');

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true, // Don't connect immediately
  family: 0, // Use IPv4 and IPv6
  tls: {
    // Ensure TLS is enabled for rediss:// protocol
  },
};

// Shared connection for Queue instances (non-blocking operations only)
export const redisConnection = new Redis(redisUrl, redisOptions);

/**
 * Create a dedicated Redis connection for a BullMQ Worker.
 * Workers use blocking commands (BRPOPLPUSH) internally, so each
 * worker MUST have its own connection to avoid interference.
 */
export function createWorkerConnection(): Redis {
  const conn = new Redis(redisUrl!, redisOptions);
  conn.on('error', (err) => {
    queueLogger.error({ err: err.message }, 'Worker Redis connection error');
  });
  conn.connect().catch((err) => {
    queueLogger.error({ err: err.message }, 'Worker Redis connection failed');
  });
  return conn;
}

redisConnection.on('connect', () => {
  queueLogger.info('Connected to Upstash Redis');
});

redisConnection.on('error', (err) => {
  queueLogger.error({ err: err.message }, 'Redis connection error');
});

redisConnection.connect().catch((err) => {
  queueLogger.fatal(
    { err: err.message, url: redisUrl.replace(/:[^:@]+@/, ':****@') },
    'Failed to connect to Upstash Redis'
  );
});
