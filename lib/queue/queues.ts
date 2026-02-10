import { Queue } from 'bullmq';
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
  AnalyticsCollectionJobData,
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
  ANALYTICS_COLLECTION: 'analytics-collection',
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

// Parts Ingestion Queue
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

// Analytics Collection Queue
export const analyticsQueue = new Queue<AnalyticsCollectionJobData, any, string>(
  QUEUE_NAMES.ANALYTICS_COLLECTION,
  {
    connection: redisConnection,
    defaultJobOptions,
  }
);

import { queueLogger } from '../logger';

queueLogger.info('BullMQ queues initialized');
