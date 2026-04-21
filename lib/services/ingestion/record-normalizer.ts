import type { PartIngestionRecord, IngestionFileMetadata } from './types';

/**
 * Normalize a raw object parsed from a JSON file's `parts` array into a
 * PartIngestionRecord. Pulled out of parsers.ts so the streaming prepare
 * worker can call it on each yielded element without loading the full file.
 */
export function normalizeJsonPart(
  part: any,
  metadata: IngestionFileMetadata,
): PartIngestionRecord {
  return {
    partKey: part.partKey ?? part.part_key,
    partNumber: (part.partNumber || part.part_number || '').trim(),
    partTitle: (part.partTitle || part.part_title || '').trim(),
    manufacturer: (part.manufacturer || metadata.manufacturer || '').trim(),
    machineModel: (part.machineModel || part.machine_model || metadata.machineModel || '').trim(),
    namespace: (part.namespace || metadata.namespace || '').trim() || undefined,
    categoryBreadcrumb:
      (part.categoryBreadcrumb || part.category_breadcrumb || part.breadcrumb || '').trim() || undefined,
    diagramTitle: (part.diagramTitle || part.diagram_title || '').trim() || undefined,
    serialNumberRange:
      (part.serialNumberRange || part.serial_number_range || metadata.serialNumberRange || '').trim() || undefined,
    technicalDomain:
      (part.technicalDomain || part.technical_domain || metadata.technicalDomain || '').trim() || undefined,
    quantity: (part.quantity || part.part_quantity || '').toString().trim() || undefined,
    remarks: (part.remarks || part.part_remarks || '').trim() || undefined,
    sourceUrl: (part.sourceUrl || part.source_url || metadata.sourceUrl || '').trim() || undefined,
    price: part.price != null ? Number(part.price) : undefined,
    cost: part.cost != null ? Number(part.cost) : undefined,
    relatedParts: Array.isArray(part.relatedParts) ? part.relatedParts : undefined,
    requiredParts: Array.isArray(part.requiredParts) ? part.requiredParts : undefined,
  };
}

/**
 * Normalize a raw CSV row (object with string keys) into a PartIngestionRecord.
 * Same logic as parsers.ts parseCsvIngestionFile, per-row so it can be called
 * from a streaming csv-parse Transform.
 */
export function normalizeCsvRow(
  row: Record<string, string>,
  defaults: IngestionFileMetadata,
): PartIngestionRecord {
  return {
    partKey: row.part_key ? Number(row.part_key) : undefined,
    partNumber: (row.part_number || '').trim(),
    partTitle: (row.part_title || '').trim(),
    manufacturer: (defaults.manufacturer || '').trim(),
    machineModel: (defaults.machineModel || '').trim(),
    namespace: defaults.namespace || undefined,
    categoryBreadcrumb: (row.breadcrumb || row.category_breadcrumb || '').trim() || undefined,
    diagramTitle: (row.diagram_title || '').trim() || undefined,
    serialNumberRange: defaults.serialNumberRange || undefined,
    technicalDomain: defaults.technicalDomain || undefined,
    quantity: (row.part_quantity || '').trim() || undefined,
    remarks: (row.part_remarks || '').trim() || undefined,
    sourceUrl: (row.source_url || defaults.sourceUrl || '').trim() || undefined,
    price: row.price ? Number(row.price) : undefined,
    cost: row.cost ? Number(row.cost) : undefined,
    relatedParts: row.related_parts
      ? row.related_parts.split(';').map((s: string) => s.trim()).filter(Boolean)
      : undefined,
    requiredParts: row.required_parts
      ? row.required_parts.split(';').map((s: string) => s.trim()).filter(Boolean)
      : undefined,
  };
}

/**
 * Dedup key used across chunks to drop cross-chunk duplicates. Matches the
 * in-chunk dedup logic in validators.ts (partNumber + categoryBreadcrumb).
 * Kept short because the prepare worker holds one Set<string> of these keys
 * in memory for the lifetime of the stream.
 */
export function dedupKey(r: PartIngestionRecord): string {
  return `${r.partNumber}|${r.categoryBreadcrumb || ''}`;
}
