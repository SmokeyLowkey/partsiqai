#!/usr/bin/env node

// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Worker Process Manager
 *
 * This script starts BullMQ workers for background job processing.
 * Run this separately from your Next.js application:
 *
 * Development: pnpm workers:dev
 * Production:  pnpm workers:start
 *
 * Profile split (WORKER_PROFILE env var):
 *   - "realtime"  — latency-sensitive workers (VOIP, email, search, follow-up,
 *                   commander, analytics, quote-extraction). Do NOT run CPU-
 *                   heavy ingestion here — Node is single-threaded and a
 *                   30-second Zod loop would freeze every other worker on the
 *                   process, including live supplier phone calls.
 *   - "ingestion" — CPU-heavy workers (ingestion-prepare, the three backend
 *                   writers, maintenance-pdf). Safe to burn the event loop
 *                   here because nothing here is user-facing.
 *   - "all" (default) — everything in one process. Fine in dev; on Render
 *                   Starter in prod, prefer splitting into two services.
 */

import { workerLogger } from '@/lib/logger';

workerLogger.info({ cwd: process.cwd() }, 'Environment variables loaded');

type WorkerProfile = 'all' | 'realtime' | 'ingestion';
const rawProfile = (process.env.WORKER_PROFILE || 'all').toLowerCase();
const WORKER_PROFILE: WorkerProfile =
  rawProfile === 'realtime' || rawProfile === 'ingestion' ? rawProfile : 'all';

workerLogger.info({ profile: WORKER_PROFILE }, 'Starting PartsIQ Workers');

const runRealtime = WORKER_PROFILE === 'all' || WORKER_PROFILE === 'realtime';
const runIngestion = WORKER_PROFILE === 'all' || WORKER_PROFILE === 'ingestion';

const workers: Array<{ name: string; worker: { close(): Promise<void> } }> = [];

// --- Realtime workers ---
if (runRealtime) {
  const { partsSearchWorker } = require('./parts-search-worker');
  const { emailMonitorWorker } = require('./email-monitor-worker');
  const { quoteExtractionWorker } = require('./quote-extraction-worker');
  const { followUpWorker } = require('./follow-up-worker');
  const { analyticsCollectionWorker } = require('./analytics-collection-worker');
  const { startVoipCallInitiationWorker } = require('./voip-call-initiation-worker');
  const { startVoipFallbackWorker } = require('./voip-fallback-worker');
  const { startCommanderWorker } = require('./commander-worker');

  workers.push(
    { name: 'Parts Search', worker: partsSearchWorker },
    { name: 'Email Monitor', worker: emailMonitorWorker },
    { name: 'Quote Extraction', worker: quoteExtractionWorker },
    { name: 'Follow-Up', worker: followUpWorker },
    { name: 'Analytics Collection', worker: analyticsCollectionWorker },
    { name: 'VOIP Call Initiation', worker: startVoipCallInitiationWorker() },
    { name: 'VOIP Fallback', worker: startVoipFallbackWorker() },
    { name: 'Commander', worker: startCommanderWorker() },
  );
}

// --- Ingestion workers ---
if (runIngestion) {
  const { maintenancePdfWorker } = require('./maintenance-pdf-worker');
  const { partsIngestionWorker } = require('./parts-ingestion-worker');
  const { ingestionPrepareWorker } = require('./ingestion-prepare-worker');
  const { ingestionPostgresWorker } = require('./ingestion-postgres-worker');
  const { ingestionPineconeWorker } = require('./ingestion-pinecone-worker');
  const { ingestionNeo4jWorker } = require('./ingestion-neo4j-worker');

  workers.push(
    { name: 'Maintenance PDF', worker: maintenancePdfWorker },
    // Legacy monolithic ingestion worker — retained until all in-flight jobs
    // on the old `parts-ingestion` queue drain. New uploads go through the
    // outbox pipeline (ingestion-prepare → per-backend writers).
    { name: 'Parts Ingestion (legacy)', worker: partsIngestionWorker },
    { name: 'Ingestion Prepare', worker: ingestionPrepareWorker },
    { name: 'Ingestion Postgres', worker: ingestionPostgresWorker },
    { name: 'Ingestion Pinecone', worker: ingestionPineconeWorker },
    { name: 'Ingestion Neo4j', worker: ingestionNeo4jWorker },
  );
}

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
