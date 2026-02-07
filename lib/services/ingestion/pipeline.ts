import { downloadFromS3 } from '../storage/s3-client';
import { parseJsonIngestionFile, parseCsvIngestionFile } from './parsers';
import { validateRecords } from './validators';
import { ingestToPostgres } from './postgres-ingester';
import { ingestToPinecone } from './pinecone-ingester';
import { ingestToNeo4j } from './neo4j-ingester';
import type { PartsIngestionJobData } from '@/lib/queue/types';
import type { IngestionProgress, PartIngestionRecord, IngestionFileMetadata } from './types';
import type { Logger } from 'pino';

type ProgressCallback = (progress: IngestionProgress) => Promise<void>;

/**
 * Main ingestion pipeline orchestrator.
 * Downloads file from S3, parses, validates, then ingests sequentially
 * into PostgreSQL → Pinecone → Neo4j.
 */
export async function runIngestion(
  jobData: PartsIngestionJobData,
  onProgress: ProgressCallback,
  logger: Logger
): Promise<void> {
  const { organizationId, s3Key, fileType, options } = jobData;

  // Phase 1: Download and parse
  logger.info({ s3Key, fileType }, 'Downloading file from S3');
  const fileBuffer = await downloadFromS3(s3Key);

  let records: PartIngestionRecord[];
  const defaults: IngestionFileMetadata = {
    manufacturer: options.defaultManufacturer,
    machineModel: options.defaultMachineModel,
    namespace: options.defaultNamespace,
    technicalDomain: options.defaultTechnicalDomain,
    serialNumberRange: options.defaultSerialNumberRange,
  };

  if (fileType === 'json') {
    const parsed = parseJsonIngestionFile(fileBuffer);
    records = parsed.records;
    // Merge form defaults into records where metadata didn't provide values
    records = records.map((r) => ({
      ...r,
      manufacturer: r.manufacturer || defaults.manufacturer || '',
      machineModel: r.machineModel || defaults.machineModel || '',
      namespace: r.namespace || defaults.namespace,
      technicalDomain: r.technicalDomain || defaults.technicalDomain,
      serialNumberRange: r.serialNumberRange || defaults.serialNumberRange,
    }));
  } else {
    const parsed = parseCsvIngestionFile(fileBuffer, defaults);
    records = parsed.records;
  }

  logger.info({ recordCount: records.length }, 'File parsed successfully');

  // Phase 2: Validate
  await onProgress({
    percent: 5,
    phase: 'validating',
    processed: 0,
    total: records.length,
    success: 0,
    failed: 0,
    postgresStatus: 'PENDING',
    pineconeStatus: 'PENDING',
    neo4jStatus: 'PENDING',
    overallStatus: 'VALIDATING',
  });

  const validation = validateRecords(records);
  logger.info(
    { valid: validation.valid.length, errors: validation.errors.length, warnings: validation.warnings.length },
    'Validation complete'
  );

  // Update total records count
  await onProgress({
    percent: 10,
    phase: 'validating',
    processed: records.length,
    total: records.length,
    success: validation.valid.length,
    failed: validation.errors.length,
    postgresStatus: 'PENDING',
    pineconeStatus: 'PENDING',
    neo4jStatus: 'PENDING',
    overallStatus: validation.errors.length > 0 && validation.valid.length === 0 ? 'FAILED' : 'PROCESSING',
  });

  // If all records are invalid, fail early
  if (validation.valid.length === 0) {
    throw new Error(`All ${records.length} records failed validation. First error: ${validation.errors[0]?.message}`);
  }

  // If dry run, stop here
  if (options.dryRun) {
    await onProgress({
      percent: 100,
      phase: 'completed',
      processed: records.length,
      total: records.length,
      success: validation.valid.length,
      failed: validation.errors.length,
      postgresStatus: 'SKIPPED',
      pineconeStatus: 'SKIPPED',
      neo4jStatus: 'SKIPPED',
      overallStatus: 'COMPLETED',
    });
    return;
  }

  const validRecords = validation.valid;
  let postgresStatus = options.skipPostgres ? 'SKIPPED' : 'PENDING';
  let pineconeStatus = options.skipPinecone ? 'SKIPPED' : 'PENDING';
  let neo4jStatus = options.skipNeo4j ? 'SKIPPED' : 'PENDING';
  let totalSuccess = 0;
  let totalFailed = validation.errors.length;

  // Phase 3: PostgreSQL ingestion (10-40%)
  if (!options.skipPostgres) {
    postgresStatus = 'IN_PROGRESS';
    await onProgress({
      percent: 10,
      phase: 'postgres',
      processed: 0,
      total: validRecords.length,
      success: totalSuccess,
      failed: totalFailed,
      postgresStatus,
      pineconeStatus,
      neo4jStatus,
      overallStatus: 'PROCESSING',
    });

    try {
      const pgResult = await ingestToPostgres(validRecords, organizationId, (processed) => {
        const percent = 10 + Math.round((processed / validRecords.length) * 30);
        // Fire and forget progress updates during batch processing
        onProgress({
          percent,
          phase: 'postgres',
          processed,
          total: validRecords.length,
          success: totalSuccess,
          failed: totalFailed,
          postgresStatus: 'IN_PROGRESS',
          pineconeStatus,
          neo4jStatus,
          overallStatus: 'PROCESSING',
        }).catch(() => {});
      }, logger);

      totalSuccess += pgResult.success;
      totalFailed += pgResult.failed;
      postgresStatus = pgResult.failed > 0 ? 'FAILED' : 'COMPLETED';
    } catch (error: any) {
      postgresStatus = 'FAILED';
      logger.error({ err: error }, 'PostgreSQL ingestion phase failed');
    }
  }

  // Phase 4: Pinecone ingestion (40-75%)
  if (!options.skipPinecone) {
    pineconeStatus = 'IN_PROGRESS';
    await onProgress({
      percent: 40,
      phase: 'pinecone',
      processed: 0,
      total: validRecords.length,
      success: totalSuccess,
      failed: totalFailed,
      postgresStatus,
      pineconeStatus,
      neo4jStatus,
      overallStatus: 'PROCESSING',
    });

    try {
      const pcResult = await ingestToPinecone(validRecords, organizationId, (processed) => {
        const percent = 40 + Math.round((processed / validRecords.length) * 35);
        onProgress({
          percent,
          phase: 'pinecone',
          processed,
          total: validRecords.length,
          success: totalSuccess,
          failed: totalFailed,
          postgresStatus,
          pineconeStatus: 'IN_PROGRESS',
          neo4jStatus,
          overallStatus: 'PROCESSING',
        }).catch(() => {});
      }, logger);

      totalSuccess += pcResult.success;
      totalFailed += pcResult.failed;
      pineconeStatus = pcResult.failed > 0 ? 'FAILED' : 'COMPLETED';
    } catch (error: any) {
      pineconeStatus = 'FAILED';
      logger.error({ err: error }, 'Pinecone ingestion phase failed');
    }
  }

  // Phase 5: Neo4j ingestion (75-100%)
  if (!options.skipNeo4j) {
    neo4jStatus = 'IN_PROGRESS';
    await onProgress({
      percent: 75,
      phase: 'neo4j',
      processed: 0,
      total: validRecords.length,
      success: totalSuccess,
      failed: totalFailed,
      postgresStatus,
      pineconeStatus,
      neo4jStatus,
      overallStatus: 'PROCESSING',
    });

    try {
      const n4jResult = await ingestToNeo4j(validRecords, organizationId, (processed) => {
        const percent = 75 + Math.round((processed / validRecords.length) * 25);
        onProgress({
          percent,
          phase: 'neo4j',
          processed,
          total: validRecords.length,
          success: totalSuccess,
          failed: totalFailed,
          postgresStatus,
          pineconeStatus,
          neo4jStatus: 'IN_PROGRESS',
          overallStatus: 'PROCESSING',
        }).catch(() => {});
      }, logger);

      totalSuccess += n4jResult.success;
      totalFailed += n4jResult.failed;
      neo4jStatus = n4jResult.failed > 0 ? 'FAILED' : 'COMPLETED';
    } catch (error: any) {
      neo4jStatus = 'FAILED';
      logger.error({ err: error }, 'Neo4j ingestion phase failed');
    }
  }

  // Final status
  const anyFailed = postgresStatus === 'FAILED' || pineconeStatus === 'FAILED' || neo4jStatus === 'FAILED';
  const overallStatus = anyFailed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

  await onProgress({
    percent: 100,
    phase: 'completed',
    processed: validRecords.length,
    total: records.length,
    success: totalSuccess,
    failed: totalFailed,
    postgresStatus,
    pineconeStatus,
    neo4jStatus,
    overallStatus,
  });

  logger.info({ overallStatus, totalSuccess, totalFailed }, 'Ingestion pipeline complete');
}
