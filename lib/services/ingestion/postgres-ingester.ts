import { prisma } from '@/lib/prisma';
import type { PartIngestionRecord, PhaseResult, ValidationError } from './types';
import type { Logger } from 'pino';

const BATCH_SIZE = 50;

/**
 * Upsert parts into PostgreSQL using Prisma.
 * Uses the @@unique([organizationId, partNumber]) constraint for idempotency.
 */
export async function ingestToPostgres(
  records: PartIngestionRecord[],
  organizationId: string,
  onProgress: (processed: number) => void,
  logger: Logger
): Promise<PhaseResult> {
  let success = 0;
  let failed = 0;
  const errors: ValidationError[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const record = batch[j];
      const row = i + j + 1;

      try {
        // Extract category from breadcrumb (last segment)
        let category: string | undefined;
        if (record.categoryBreadcrumb) {
          const segments = record.categoryBreadcrumb.split(' - ');
          category = segments[0]?.trim(); // Use first segment as main category
        }

        await prisma.part.upsert({
          where: {
            organizationId_partNumber: {
              organizationId,
              partNumber: record.partNumber,
            },
          },
          create: {
            organizationId,
            partNumber: record.partNumber,
            description: record.partTitle,
            category: category || record.technicalDomain,
            subcategory: record.technicalDomain,
            price: record.price ?? 0,
            cost: record.cost,
            stockQuantity: 0,
            minStockLevel: 0,
            compatibility: {
              makes: record.manufacturer ? [record.manufacturer] : [],
              models: record.machineModel ? [record.machineModel] : [],
              manufacturer: record.manufacturer,
              machineModel: record.machineModel,
              serialNumberRange: record.serialNumberRange,
              namespace: record.namespace,
            },
            specifications: {
              diagramTitle: record.diagramTitle,
              categoryBreadcrumb: record.categoryBreadcrumb,
              sourceUrl: record.sourceUrl,
              quantity: record.quantity,
              remarks: record.remarks,
              relatedParts: record.relatedParts,
              requiredParts: record.requiredParts,
            },
          },
          update: {
            description: record.partTitle,
            category: category || record.technicalDomain,
            subcategory: record.technicalDomain,
            price: record.price ?? undefined,
            cost: record.cost,
            compatibility: {
              makes: record.manufacturer ? [record.manufacturer] : [],
              models: record.machineModel ? [record.machineModel] : [],
              manufacturer: record.manufacturer,
              machineModel: record.machineModel,
              serialNumberRange: record.serialNumberRange,
              namespace: record.namespace,
            },
            specifications: {
              diagramTitle: record.diagramTitle,
              categoryBreadcrumb: record.categoryBreadcrumb,
              sourceUrl: record.sourceUrl,
              quantity: record.quantity,
              remarks: record.remarks,
              relatedParts: record.relatedParts,
              requiredParts: record.requiredParts,
            },
          },
        });

        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          row,
          field: 'postgres',
          message: error.message,
          value: record.partNumber,
        });
        logger.error({ err: error, partNumber: record.partNumber }, 'PostgreSQL upsert failed');
      }
    }

    onProgress(i + batch.length);
  }

  logger.info({ success, failed }, 'PostgreSQL ingestion complete');
  return { success, failed, errors };
}
