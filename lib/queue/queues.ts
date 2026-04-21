import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './connection';
import type {
  EmailMonitorJobData,
  PartsSearchJobData,
  QuoteRequestJobData,
  QuoteExtractionJobData,
  OrderConfirmationJobData,
  FollowUpJobData,
  PostOrderJobData,
  MaintenancePdfJobData,
  PartsIngestionJobData,
  IngestionPrepareJobData,
  IngestionBackendWriteJobData,
  AnalyticsCollectionJobData,
  VoipCallInitiationJobData,
  VoipFallbackJobData,
  VoipCallRetryJobData,
  CommanderEventJobData,
} from './types';

export const QUEUE_NAMES = {
  EMAIL_MONITOR: 'email-monitor',
  PARTS_SEARCH: 'parts-search',
  QUOTE_REQUEST: 'quote-request',
  ORDER_CONFIRMATION: 'order-confirmation',
  FOLLOW_UP: 'follow-up',
  POST_ORDER: 'post-order',
  QUOTE_EXTRACTION: 'quote-extraction',
  MAINTENANCE_PDF: 'maintenance-pdf',
  PARTS_INGESTION: 'parts-ingestion',
  INGESTION_PREPARE: 'ingestion-prepare',
  INGESTION_POSTGRES: 'ingestion-postgres',
  INGESTION_PINECONE: 'ingestion-pinecone',
  INGESTION_NEO4J: 'ingestion-neo4j',
  ANALYTICS_COLLECTION: 'analytics-collection',
  VOIP_CALL_INITIATION: 'voip-call-initiation',
  VOIP_FALLBACK: 'voip-fallback',
  VOIP_CALL_RETRY: 'voip-call-retry',
  COMMANDER_EVENTS: 'commander-events',
} as const;

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: { age: 3600, count: 20 },
  removeOnFail: { age: 86400, count: 50 },
};

// Email Monitor Queue
export const emailMonitorQueue = new Queue<EmailMonitorJobData, any, string>(
  QUEUE_NAMES.EMAIL_MONITOR,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// Parts Search Queue
export const partsSearchQueue = new Queue<PartsSearchJobData, any, string>(
  QUEUE_NAMES.PARTS_SEARCH,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
    } as any,
  }
);

// Quote Request Queue
export const quoteRequestQueue = new Queue<QuoteRequestJobData, any, string>(
  QUEUE_NAMES.QUOTE_REQUEST,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// Quote Extraction Queue
export const quoteExtractionQueue = new Queue<QuoteExtractionJobData, any, string>(
  QUEUE_NAMES.QUOTE_EXTRACTION,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// Order Confirmation Queue
export const orderConfirmationQueue = new Queue<OrderConfirmationJobData, any, string>(
  QUEUE_NAMES.ORDER_CONFIRMATION,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// Follow-Up Queue
export const followUpQueue = new Queue<FollowUpJobData, any, string>(
  QUEUE_NAMES.FOLLOW_UP,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// Post-Order Tracking Queue
export const postOrderQueue = new Queue<PostOrderJobData, any, string>(
  QUEUE_NAMES.POST_ORDER,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// Maintenance PDF Parsing Queue
export const maintenancePdfQueue = new Queue<MaintenancePdfJobData, any, string>(
  QUEUE_NAMES.MAINTENANCE_PDF,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
    } as any,
  }
);

// Parts Ingestion Queue — LEGACY monolithic pipeline. New uploads go through
// the outbox pipeline (ingestionPrepare → ingestion{Postgres,Pinecone,Neo4j}).
// Kept so any in-flight jobs at deploy time can drain.
export const partsIngestionQueue = new Queue<PartsIngestionJobData, any, string>(
  QUEUE_NAMES.PARTS_INGESTION,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 1, // No auto-retry for ingestion - manual re-run preferred
      removeOnComplete: { age: 86400, count: 10 },
      removeOnFail: { age: 604800, count: 50 },
    },
  }
);

// Ingestion Prepare Queue — streams uploaded file from S3, validates + dedups,
// writes chunked blobs to S3, fans out backend-write outbox rows. One job per
// upload. Concurrency 1 (CPU-bound, event-loop dominating).
export const ingestionPrepareQueue = new Queue<IngestionPrepareJobData, any, string>(
  QUEUE_NAMES.INGESTION_PREPARE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 1, // Prepare is idempotent-ish but a failed run should be explicitly retried via UI
      removeOnComplete: { age: 86400, count: 20 },
      removeOnFail: { age: 604800, count: 50 },
    },
  }
);

// Per-backend ingestion queues. One job per (job, backend, chunk) outbox row.
// Backend writers re-verify authorization at process time and are idempotent
// (upsert-by-natural-key) so failed jobs can be retried without double-write.
const backendIngestionJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 86400, count: 200 },
  removeOnFail: { age: 604800, count: 200 },
};

export const ingestionPostgresQueue = new Queue<IngestionBackendWriteJobData, any, string>(
  QUEUE_NAMES.INGESTION_POSTGRES,
  { connection: redisConnection, defaultJobOptions: backendIngestionJobOptions }
);

export const ingestionPineconeQueue = new Queue<IngestionBackendWriteJobData, any, string>(
  QUEUE_NAMES.INGESTION_PINECONE,
  { connection: redisConnection, defaultJobOptions: backendIngestionJobOptions }
);

export const ingestionNeo4jQueue = new Queue<IngestionBackendWriteJobData, any, string>(
  QUEUE_NAMES.INGESTION_NEO4J,
  { connection: redisConnection, defaultJobOptions: backendIngestionJobOptions }
);

// Analytics Collection Queue
export const analyticsQueue = new Queue<AnalyticsCollectionJobData, any, string>(
  QUEUE_NAMES.ANALYTICS_COLLECTION,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

// VOIP Call Initiation Queue
export const voipCallInitiationQueue = new Queue<VoipCallInitiationJobData, any, string>(
  QUEUE_NAMES.VOIP_CALL_INITIATION,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 1, // No auto-retry - use explicit retry worker
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 604800, count: 100 },
    },
  }
);

// VOIP Fallback Queue (email fallback when call fails)
export const voipFallbackQueue = new Queue<VoipFallbackJobData, any, string>(
  QUEUE_NAMES.VOIP_FALLBACK,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
      removeOnComplete: { age: 86400, count: 50 },
      removeOnFail: { age: 604800, count: 50 },
    },
  }
);

// VOIP Call Retry Queue
export const voipCallRetryQueue = new Queue<VoipCallRetryJobData, any, string>(
  QUEUE_NAMES.VOIP_CALL_RETRY,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 1, // Single attempt per retry job
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 604800, count: 100 },
    },
  }
);

// Commander Events Queue (Overseer → Commander)
export const commanderEventsQueue = new Queue<CommanderEventJobData, any, string>(
  QUEUE_NAMES.COMMANDER_EVENTS,
  {
    connection: redisConnection,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 1, // Commander events are idempotent, no retry needed
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 100 },
    },
  }
);

// QueueEvents for listening to job completion (needed for waitUntilFinished)
export const voipCallInitiationQueueEvents = new QueueEvents(
  QUEUE_NAMES.VOIP_CALL_INITIATION,
  {
    connection: redisConnection.duplicate(),
  }
);

import { queueLogger } from '../logger';

queueLogger.info('BullMQ queues initialized');
