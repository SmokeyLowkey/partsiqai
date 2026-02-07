import { z } from 'zod';
import type { PartIngestionRecord, ValidationResult, ValidationError, ValidationWarning } from './types';

const PartRecordSchema = z.object({
  partNumber: z.string().min(1, 'Part number is required').max(50).trim(),
  partTitle: z.string().min(1, 'Part title is required').max(500).trim(),
  manufacturer: z.string().min(1, 'Manufacturer is required').max(100).trim(),
  machineModel: z.string().min(1, 'Machine model is required').max(200).trim(),
  namespace: z.string().max(100).trim().optional(),
  categoryBreadcrumb: z.string().max(500).trim().optional(),
  diagramTitle: z.string().max(500).trim().optional(),
  serialNumberRange: z.string().max(500).trim().optional(),
  technicalDomain: z.string().max(100).trim().optional(),
  quantity: z.string().max(20).trim().optional(),
  remarks: z.string().max(1000).trim().optional(),
  sourceUrl: z.string().max(2000).optional(),
  price: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
});

/**
 * Validate an array of parsed PartIngestionRecords.
 * Returns valid records, errors, and warnings.
 */
export function validateRecords(records: PartIngestionRecord[]): ValidationResult {
  const valid: PartIngestionRecord[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const seenPartNumbers = new Map<string, number>();

  for (let i = 0; i < records.length; i++) {
    const row = i + 1; // 1-based row number for user display
    const record = records[i];

    // Zod schema validation
    const result = PartRecordSchema.safeParse(record);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row,
          field: issue.path.join('.') || 'unknown',
          message: issue.message,
          value: (record as any)[issue.path[0] as string],
        });
      }
      continue;
    }

    // Duplicate detection within file (based on partNumber + categoryBreadcrumb)
    const partKey = `${record.partNumber}_${record.categoryBreadcrumb || 'default'}`;
    const existingRow = seenPartNumbers.get(partKey);
    if (existingRow !== undefined) {
      warnings.push({
        row,
        field: 'partNumber',
        message: `Duplicate part "${record.partNumber}" in same category (first seen at row ${existingRow}). Later occurrence will overwrite.`,
        value: record.partNumber,
      });
    }
    seenPartNumbers.set(partKey, row);

    // Warnings for optional but recommended fields
    if (!record.categoryBreadcrumb) {
      warnings.push({
        row,
        field: 'categoryBreadcrumb',
        message: 'Missing category breadcrumb - part may not appear in category filters',
      });
    }

    if (!record.namespace) {
      warnings.push({
        row,
        field: 'namespace',
        message: 'Missing namespace - part will be in the default namespace',
      });
    }

    valid.push(record);
  }

  return { valid, errors, warnings };
}
