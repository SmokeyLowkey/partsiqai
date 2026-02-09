import type { PartIngestionRecord, MergedEntry } from './types';

/**
 * Merge records with the same (partNumber, categoryBreadcrumb) composite key.
 * Used for Neo4j ingestion to avoid duplicate Part nodes while preserving
 * diagram-level detail in a mergedEntries array.
 *
 * Pinecone gets unmerged records (each row is a separate vector with indexed ID).
 */
export function mergeRecords(records: PartIngestionRecord[]): PartIngestionRecord[] {
  const groups = new Map<string, PartIngestionRecord[]>();

  for (const record of records) {
    const key = `${record.partNumber}||${record.categoryBreadcrumb || ''}`;
    const group = groups.get(key);
    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  const merged: PartIngestionRecord[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    // Keep the first record as primary
    const primary = { ...group[0] };

    // Collect varying fields from ALL entries (including primary)
    const entries: MergedEntry[] = group.map((r) => ({
      diagramTitle: r.diagramTitle,
      quantity: r.quantity,
      remarks: r.remarks,
      sourceUrl: r.sourceUrl,
      partKey: r.partKey,
    }));

    primary.mergedEntries = entries;

    // Also merge requiredParts from all entries
    const allRequired = new Set<string>();
    for (const r of group) {
      if (r.requiredParts) {
        for (const rp of r.requiredParts) {
          allRequired.add(rp);
        }
      }
    }
    if (allRequired.size > 0) {
      primary.requiredParts = [...allRequired];
    }

    merged.push(primary);
  }

  return merged;
}
