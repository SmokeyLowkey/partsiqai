#!/usr/bin/env node

// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Worker Process Manager
 *
 * This script starts all BullMQ workers for background job processing.
 * Run this separately from your Next.js application:
 *
 * Development: pnpm workers:dev
 * Production: pnpm workers:start
 */

import { workerLogger } from '@/lib/logger';

workerLogger.info({ cwd: process.cwd() }, 'Environment variables loaded');

import { partsSearchWorker } from './parts-search-worker';
import { emailMonitorWorker } from './email-monitor-worker';
import { quoteExtractionWorker } from './quote-extraction-worker';
import { followUpWorker } from './follow-up-worker';
import { maintenancePdfWorker } from './maintenance-pdf-worker';
import { partsIngestionWorker } from './parts-ingestion-worker';
import { analyticsCollectionWorker } from './analytics-collection-worker';

workerLogger.info('Starting PartsIQ Workers');

// Email monitoring is handled by Vercel cron (/api/cron/email-monitor) every 5 minutes.
// No duplicate scheduler needed here — this avoids excessive Redis commands.

// Track active workers
const workers = [
  { name: 'Parts Search', worker: partsSearchWorker },
  { name: 'Email Monitor', worker: emailMonitorWorker },
  { name: 'Quote Extraction', worker: quoteExtractionWorker },
  { name: 'Follow-Up', worker: followUpWorker },
  { name: 'Maintenance PDF', worker: maintenancePdfWorker },
  { name: 'Parts Ingestion', worker: partsIngestionWorker },
  { name: 'Analytics Collection', worker: analyticsCollectionWorker },
];

// Graceful shutdown handler
async function shutdown(signal: string) {
  workerLogger.info({ signal }, 'Shutting down workers gracefully');

  try {
    await Promise.all(
      workers.map(async ({ name, worker }) => {
        workerLogger.info({ worker: name }, 'Closing worker');
        await worker.close();
        workerLogger.info({ worker: name }, 'Worker closed');
      })
    );

    workerLogger.info('All workers shut down successfully');
    process.exit(0);
  } catch (error) {
    workerLogger.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  workerLogger.error({ reason, promise }, 'Unhandled rejection');
});

process.on('uncaughtException', (error) => {
  workerLogger.fatal({ err: error }, 'Uncaught exception');
  shutdown('UNCAUGHT_EXCEPTION');
});

// Log worker status
workerLogger.info(
  { workers: workers.map((w) => w.name) },
  'Workers are running'
);

// Keep process alive
setInterval(() => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  workerLogger.info({ uptimeHours: hours, uptimeMinutes: minutes }, 'Health check');
}, 5 * 60 * 1000);
