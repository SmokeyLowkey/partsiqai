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

// Upstash Redis connection for BullMQ using TCP connection URL
// The URL format is: rediss://default:password@host:port
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true, // Don't connect immediately
  family: 0, // Use IPv4 and IPv6
  tls: {
    // Ensure TLS is enabled for rediss:// protocol
  },
});

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
