import { parse } from 'csv-parse/sync';
import type { PartIngestionRecord, IngestionFileMetadata } from './types';

interface ParseResult {
  metadata: IngestionFileMetadata;
  records: PartIngestionRecord[];
}

/**
 * Parse a JSON ingestion file into normalized records.
 * JSON format supports a metadata block with defaults that apply to all parts.
 */
export function parseJsonIngestionFile(buffer: Buffer): ParseResult {
  const content = JSON.parse(buffer.toString('utf-8'));

  const metadata: IngestionFileMetadata = content.metadata || {};
  const rawParts: any[] = content.parts || [];

  if (!Array.isArray(rawParts) || rawParts.length === 0) {
    throw new Error('JSON file must contain a "parts" array with at least one entry');
  }

  const records: PartIngestionRecord[] = rawParts.map((part) => ({
    partKey: part.partKey ?? part.part_key,
    partNumber: (part.partNumber || part.part_number || '').trim(),
    partTitle: (part.partTitle || part.part_title || '').trim(),
    manufacturer: (part.manufacturer || metadata.manufacturer || '').trim(),
    machineModel: (part.machineModel || part.machine_model || metadata.machineModel || '').trim(),
    namespace: (part.namespace || metadata.namespace || '').trim() || undefined,
    categoryBreadcrumb: (part.categoryBreadcrumb || part.category_breadcrumb || part.breadcrumb || '').trim() || undefined,
    diagramTitle: (part.diagramTitle || part.diagram_title || '').trim() || undefined,
    serialNumberRange: (part.serialNumberRange || part.serial_number_range || metadata.serialNumberRange || '').trim() || undefined,
    technicalDomain: (part.technicalDomain || part.technical_domain || metadata.technicalDomain || '').trim() || undefined,
    quantity: (part.quantity || part.part_quantity || '').toString().trim() || undefined,
    remarks: (part.remarks || part.part_remarks || '').trim() || undefined,
    sourceUrl: (part.sourceUrl || part.source_url || metadata.sourceUrl || '').trim() || undefined,
    price: part.price != null ? Number(part.price) : undefined,
    cost: part.cost != null ? Number(part.cost) : undefined,
    relatedParts: Array.isArray(part.relatedParts) ? part.relatedParts : undefined,
    requiredParts: Array.isArray(part.requiredParts) ? part.requiredParts : undefined,
  }));

  return { metadata, records };
}

/**
 * Parse a CSV ingestion file into normalized records.
 * CSV columns: part_key, part_title, part_number, part_quantity, part_remarks,
 *              source_url, breadcrumb, diagram_title
 *
 * Manufacturer, machineModel, namespace, etc. come from upload form options
 * and are merged in by the pipeline.
 */
export function parseCsvIngestionFile(
  buffer: Buffer,
  defaults: IngestionFileMetadata = {}
): ParseResult {
  const csvContent = buffer.toString('utf-8');

  const rawRecords: Record<string, string>[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  if (rawRecords.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  const records: PartIngestionRecord[] = rawRecords.map((row) => ({
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
    relatedParts: row.related_parts ? row.related_parts.split(';').map((s: string) => s.trim()).filter(Boolean) : undefined,
    requiredParts: row.required_parts ? row.required_parts.split(';').map((s: string) => s.trim()).filter(Boolean) : undefined,
  }));

  return { metadata: defaults, records };
}
