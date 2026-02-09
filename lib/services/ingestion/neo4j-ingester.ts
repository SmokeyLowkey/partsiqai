import neo4j, { Driver } from 'neo4j-driver';
import { credentialsManager } from '../credentials/credentials-manager';
import type { PartIngestionRecord, PhaseResult, ValidationError } from './types';
import type { Logger } from 'pino';

const BATCH_SIZE = 1000;

/**
 * Parse serial number range string that may contain multiple (PIN: ...) entries.
 * Examples:
 *   "(PIN: 1T0803MX_ _F293917- ) (PIN: 1T0803MX_ _L343918- )"
 *   → ["1T0803MX_ _F293917-", "1T0803MX_ _L343918-"]
 *
 *   "1FF160GXCMG000001-1FF160GXCMG999999"
 *   → ["1FF160GXCMG000001-1FF160GXCMG999999"]
 */
export function parseSerialRanges(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  // Match all (PIN: ...) groups
  const pinMatches = raw.match(/\(PIN:\s*([^)]+)\)/gi);
  if (pinMatches && pinMatches.length > 0) {
    return pinMatches
      .map((m) => {
        const inner = m.match(/\(PIN:\s*([^)]+)\)/i);
        return inner ? inner[1].trim() : '';
      })
      .filter(Boolean);
  }

  // No (PIN: ...) format — treat the whole string as a single range
  return [raw.trim()];
}

/**
 * MERGE nodes and relationships into Neo4j graph database.
 * Creates the exact graph structure that neo4j-client.ts queries expect.
 *
 * Expected node labels: :Part, :Manufacturer, :Model, :TechnicalDomain,
 *   :Diagram, :Category, :SerialNumberRange
 * Expected relationships: MANUFACTURES, CONTAINS_PART, HAS_DOMAIN,
 *   SHOWN_IN_DIAGRAM, BELONGS_TO_CATEGORY, REQUIRES_PART, VALID_FOR_RANGE
 */
export async function ingestToNeo4j(
  records: PartIngestionRecord[],
  organizationId: string,
  onProgress: (processed: number) => void,
  logger: Logger
): Promise<PhaseResult> {
  const credentials = await credentialsManager.getCredentials<{
    uri: string;
    username: string;
    password: string;
    database?: string;
  }>(organizationId, 'NEO4J');

  if (!credentials) {
    throw new Error('Neo4j credentials not configured for this organization');
  }

  const driver: Driver = neo4j.driver(
    credentials.uri,
    neo4j.auth.basic(credentials.username, credentials.password)
  );
  const database = credentials.database || 'neo4j';

  let success = 0;
  let failed = 0;
  const errors: ValidationError[] = [];

  try {
    // Phase 1: Create reference nodes (deduplicated)
    await createReferenceNodes(driver, database, records, logger);

    // Phase 2: Create Part nodes and relationships in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const session = driver.session({ database });

      try {
        const batchParams = batch.map((record) => ({
          partNumber: record.partNumber,
          partTitle: record.partTitle,
          manufacturer: record.manufacturer,
          machineModel: record.machineModel,
          namespace: record.namespace || null,
          categoryBreadcrumb: record.categoryBreadcrumb || null,
          diagramTitle: record.diagramTitle || null,
          serialNumberRange: record.serialNumberRange || null,
          technicalDomain: record.technicalDomain || null,
          quantity: record.quantity || null,
          remarks: record.remarks || null,
          sourceUrl: record.sourceUrl || null,
        }));

        // MERGE Part nodes with composite key (part_number + category_breadcrumb)
        // so the same part in different categories is preserved as separate nodes
        await session.run(
          `
          UNWIND $parts AS part
          MERGE (p:Part {part_number: part.partNumber, category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')})
          SET p.part_title = part.partTitle,
              p.machine_model = part.machineModel,
              p.manufacturer = part.manufacturer,
              p.namespace = part.namespace,
              p.diagram_title = part.diagramTitle,
              p.serial_number_range = part.serialNumberRange,
              p.technical_domain = part.technicalDomain,
              p.quantity = part.quantity,
              p.remarks = part.remarks,
              p.source_url = part.sourceUrl
          `,
          { parts: batchParams }
        );

        // Link Parts to TechnicalDomains via CONTAINS_PART
        await session.run(
          `
          UNWIND $parts AS part
          WITH part WHERE part.technicalDomain IS NOT NULL
          MATCH (p:Part {part_number: part.partNumber, category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')})
          MATCH (d:TechnicalDomain {name: part.technicalDomain})
          MERGE (p)-[:CONTAINS_PART]-(d)
          `,
          { parts: batchParams }
        );

        // Link Parts to Diagrams via SHOWN_IN_DIAGRAM
        await session.run(
          `
          UNWIND $parts AS part
          WITH part WHERE part.diagramTitle IS NOT NULL
          MATCH (p:Part {part_number: part.partNumber, category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')})
          MATCH (diag:Diagram {diagram_title: part.diagramTitle})
          MERGE (p)-[:SHOWN_IN_DIAGRAM]->(diag)
          `,
          { parts: batchParams }
        );

        // Link Parts to Categories via BELONGS_TO_CATEGORY
        await session.run(
          `
          UNWIND $parts AS part
          WITH part WHERE part.categoryBreadcrumb IS NOT NULL
          MATCH (p:Part {part_number: part.partNumber, category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')})
          MATCH (c:Category {name: part.categoryBreadcrumb})
          MERGE (p)-[:BELONGS_TO_CATEGORY]->(c)
          `,
          { parts: batchParams }
        );

        // Link Parts to SerialNumberRanges via VALID_FOR_RANGE (supports multiple ranges per part)
        const partRanges = batch
          .filter((r) => r.serialNumberRange)
          .flatMap((r) =>
            parseSerialRanges(r.serialNumberRange!).map((range) => ({
              partNumber: r.partNumber,
              categoryBreadcrumb: r.categoryBreadcrumb || '',
              range,
            }))
          );

        if (partRanges.length > 0) {
          await session.run(
            `
            UNWIND $partRanges AS pr
            MATCH (p:Part {part_number: pr.partNumber, category_breadcrumb: pr.categoryBreadcrumb})
            MATCH (s:SerialNumberRange {range: pr.range})
            MERGE (p)-[:VALID_FOR_RANGE]->(s)
            `,
            { partRanges }
          );
        }

        success += batch.length;
      } catch (error: any) {
        for (let j = 0; j < batch.length; j++) {
          errors.push({
            row: i + j + 1,
            field: 'neo4j',
            message: error.message,
            value: batch[j].partNumber,
          });
        }
        failed += batch.length;
        logger.error({ err: error, batchStart: i }, 'Neo4j batch ingestion failed');
      } finally {
        await session.close();
      }

      onProgress(i + batch.length);
    }

    // Phase 3: Create inter-part relationships (REQUIRES_PART)
    await createPartRelationships(driver, database, records, logger);

  } finally {
    await driver.close();
  }

  logger.info({ success, failed }, 'Neo4j ingestion complete');
  return { success, failed, errors };
}

/**
 * Create deduplicated reference nodes: Manufacturer, Model, TechnicalDomain,
 * Diagram, Category, SerialNumberRange, and their relationships.
 */
async function createReferenceNodes(
  driver: Driver,
  database: string,
  records: PartIngestionRecord[],
  logger: Logger
): Promise<void> {
  const session = driver.session({ database });

  try {
    // Collect unique values
    const manufacturers = [...new Set(records.map((r) => r.manufacturer).filter(Boolean))];
    const models = [...new Map(
      records.map((r) => [`${r.manufacturer}::${r.machineModel}`, { name: r.machineModel, manufacturer: r.manufacturer }])
    ).values()];
    const domains = [...new Map(
      records
        .filter((r) => r.technicalDomain)
        .map((r) => [`${r.technicalDomain}::${r.machineModel}`, { name: r.technicalDomain!, model: r.machineModel }])
    ).values()];
    const categories = [...new Set(records.map((r) => r.categoryBreadcrumb).filter(Boolean))] as string[];
    const diagrams = [...new Set(records.map((r) => r.diagramTitle).filter(Boolean))] as string[];
    const serialRanges = [...new Set(
      records
        .filter((r) => r.serialNumberRange)
        .flatMap((r) => parseSerialRanges(r.serialNumberRange!))
    )];

    // MERGE Manufacturers
    if (manufacturers.length > 0) {
      await session.run(
        'UNWIND $names AS name MERGE (:Manufacturer {name: name})',
        { names: manufacturers }
      );
    }

    // MERGE Models with MANUFACTURES relationship
    if (models.length > 0) {
      await session.run(
        `
        UNWIND $models AS model
        MERGE (mfg:Manufacturer {name: model.manufacturer})
        MERGE (m:Model {name: model.name})
        MERGE (mfg)-[:MANUFACTURES]->(m)
        `,
        { models }
      );
    }

    // MERGE TechnicalDomains with HAS_DOMAIN relationship to Models
    if (domains.length > 0) {
      await session.run(
        `
        UNWIND $domains AS domain
        MERGE (d:TechnicalDomain {name: domain.name})
        MERGE (m:Model {name: domain.model})
        MERGE (d)-[:HAS_DOMAIN]->(m)
        `,
        { domains }
      );
    }

    // MERGE Categories
    if (categories.length > 0) {
      await session.run(
        'UNWIND $names AS name MERGE (:Category {name: name})',
        { names: categories }
      );
    }

    // MERGE Diagrams
    if (diagrams.length > 0) {
      await session.run(
        'UNWIND $titles AS title MERGE (:Diagram {diagram_title: title})',
        { titles: diagrams }
      );
    }

    // MERGE SerialNumberRanges
    if (serialRanges.length > 0) {
      await session.run(
        'UNWIND $ranges AS range MERGE (:SerialNumberRange {range: range})',
        { ranges: serialRanges }
      );
    }

    logger.info(
      { manufacturers: manufacturers.length, models: models.length, domains: domains.length, categories: categories.length, diagrams: diagrams.length },
      'Neo4j reference nodes created'
    );
  } finally {
    await session.close();
  }
}

/**
 * Create REQUIRES_PART relationships between parts.
 */
async function createPartRelationships(
  driver: Driver,
  database: string,
  records: PartIngestionRecord[],
  logger: Logger
): Promise<void> {
  const relations: { from: string; fromCategory: string; to: string }[] = [];

  for (const record of records) {
    if (record.requiredParts) {
      for (const required of record.requiredParts) {
        relations.push({
          from: record.partNumber,
          fromCategory: record.categoryBreadcrumb || '',
          to: required,
        });
      }
    }
  }

  if (relations.length === 0) return;

  const session = driver.session({ database });
  try {
    await session.run(
      `
      UNWIND $relations AS rel
      MATCH (p1:Part {part_number: rel.from, category_breadcrumb: rel.fromCategory})
      MATCH (p2:Part {part_number: rel.to})
      MERGE (p1)-[:REQUIRES_PART]->(p2)
      `,
      { relations }
    );

    logger.info({ count: relations.length }, 'Neo4j REQUIRES_PART relationships created');
  } finally {
    await session.close();
  }
}
