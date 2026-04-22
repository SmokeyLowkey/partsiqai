import neo4j, { Driver, Session } from 'neo4j-driver';
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
 * MERGE nodes + relationships into Neo4j under the tenant's Organization hub.
 *
 * Tenant isolation model: every data node (Part, Manufacturer, Model, etc.)
 * is attached to an `:Organization {id: $orgId}` hub via an `[:OWNS]` edge.
 * All queries MUST start from the hub (see lib/services/search/neo4j-client.ts).
 * Two tenants uploading the same `part_number` get distinct Part nodes under
 * their respective subgraphs — no cross-tenant collision or leak.
 *
 * MERGE semantics with path: `MERGE (org)-[:OWNS]->(p:Part {part_number: X})`
 * matches only the whole path. If Org A has Part X and Org B writes Part X,
 * Cypher doesn't find a path from Org B and creates a new Part X node under
 * Org B's subgraph — which is exactly what we want.
 *
 * Node labels: :Organization (hub), :Part, :Manufacturer, :Model,
 *   :TechnicalDomain, :Diagram, :Category, :SerialNumberRange
 * Relationships: OWNS (hub → each node), plus the data-plane relationships:
 *   MANUFACTURES, CONTAINS_PART, HAS_DOMAIN, SHOWN_IN_DIAGRAM,
 *   BELONGS_TO_CATEGORY, REQUIRES_PART, VALID_FOR_RANGE
 */
export async function ingestToNeo4j(
  records: PartIngestionRecord[],
  organizationId: string,
  onProgress: (processed: number) => void,
  logger: Logger
): Promise<PhaseResult> {
  const credentials = await credentialsManager.getCredentialsWithFallback<{
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
    // Phase 0: upsert the tenant hub node exactly once per ingestion run.
    // Every subsequent MERGE attaches to this hub.
    await ensureOrgHub(driver, database, organizationId);

    // Phase 1: Create reference nodes (deduplicated) under the hub.
    await createReferenceNodes(driver, database, organizationId, records, logger);

    // Phase 2: Create Part nodes and relationships in batches, all under the hub.
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
          mergedEntries: record.mergedEntries ? JSON.stringify(record.mergedEntries) : null,
        }));

        // MERGE Part nodes under the org hub. Path-based MERGE ensures we
        // only match / create Parts that belong to THIS org.
        await session.run(
          `
          MATCH (org:Organization {id: $orgId})
          UNWIND $parts AS part
          MERGE (org)-[:OWNS]->(p:Part {
            part_number: part.partNumber,
            category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')
          })
          SET p.part_title = part.partTitle,
              p.machine_model = part.machineModel,
              p.manufacturer = part.manufacturer,
              p.namespace = part.namespace,
              p.diagram_title = part.diagramTitle,
              p.serial_number_range = part.serialNumberRange,
              p.technical_domain = part.technicalDomain,
              p.quantity = part.quantity,
              p.remarks = part.remarks,
              p.source_url = part.sourceUrl,
              p.merged_entries = part.mergedEntries
          `,
          { orgId: organizationId, parts: batchParams }
        );

        // Link Parts to TechnicalDomains via CONTAINS_PART — all under this org.
        await session.run(
          `
          MATCH (org:Organization {id: $orgId})
          UNWIND $parts AS part
          WITH org, part WHERE part.technicalDomain IS NOT NULL
          MATCH (org)-[:OWNS]->(p:Part {
            part_number: part.partNumber,
            category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')
          })
          MATCH (org)-[:OWNS]->(d:TechnicalDomain {name: part.technicalDomain})
          MERGE (p)-[:CONTAINS_PART]-(d)
          `,
          { orgId: organizationId, parts: batchParams }
        );

        // Link Parts to Diagrams via SHOWN_IN_DIAGRAM.
        await session.run(
          `
          MATCH (org:Organization {id: $orgId})
          UNWIND $parts AS part
          WITH org, part WHERE part.diagramTitle IS NOT NULL
          MATCH (org)-[:OWNS]->(p:Part {
            part_number: part.partNumber,
            category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')
          })
          MATCH (org)-[:OWNS]->(diag:Diagram {diagram_title: part.diagramTitle})
          MERGE (p)-[:SHOWN_IN_DIAGRAM]->(diag)
          `,
          { orgId: organizationId, parts: batchParams }
        );

        // Link Parts to Categories via BELONGS_TO_CATEGORY.
        await session.run(
          `
          MATCH (org:Organization {id: $orgId})
          UNWIND $parts AS part
          WITH org, part WHERE part.categoryBreadcrumb IS NOT NULL
          MATCH (org)-[:OWNS]->(p:Part {
            part_number: part.partNumber,
            category_breadcrumb: COALESCE(part.categoryBreadcrumb, '')
          })
          MATCH (org)-[:OWNS]->(c:Category {name: part.categoryBreadcrumb})
          MERGE (p)-[:BELONGS_TO_CATEGORY]->(c)
          `,
          { orgId: organizationId, parts: batchParams }
        );

        // Link Parts to SerialNumberRanges via VALID_FOR_RANGE (supports multiple ranges per part).
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
            MATCH (org:Organization {id: $orgId})
            UNWIND $partRanges AS pr
            MATCH (org)-[:OWNS]->(p:Part {
              part_number: pr.partNumber,
              category_breadcrumb: pr.categoryBreadcrumb
            })
            MATCH (org)-[:OWNS]->(s:SerialNumberRange {range: pr.range})
            MERGE (p)-[:VALID_FOR_RANGE]->(s)
            `,
            { orgId: organizationId, partRanges }
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

    // Phase 3: Create inter-part relationships (REQUIRES_PART), scoped to org.
    await createPartRelationships(driver, database, organizationId, records, logger);

  } finally {
    await driver.close();
  }

  logger.info({ success, failed, organizationId }, 'Neo4j ingestion complete');
  return { success, failed, errors };
}

/**
 * MERGE the tenant hub node. Called once per ingestion run. Must exist
 * before any data node so the downstream MERGEs can attach via OWNS.
 */
async function ensureOrgHub(driver: Driver, database: string, organizationId: string): Promise<void> {
  const session: Session = driver.session({ database });
  try {
    await session.run(
      'MERGE (org:Organization {id: $orgId}) SET org.updatedAt = datetime()',
      { orgId: organizationId }
    );
  } finally {
    await session.close();
  }
}

/**
 * Create deduplicated reference nodes: Manufacturer, Model, TechnicalDomain,
 * Diagram, Category, SerialNumberRange, and their relationships — all
 * attached to the tenant hub via [:OWNS].
 */
async function createReferenceNodes(
  driver: Driver,
  database: string,
  organizationId: string,
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

    // Manufacturers — owned by org.
    if (manufacturers.length > 0) {
      await session.run(
        `
        MATCH (org:Organization {id: $orgId})
        UNWIND $names AS name
        MERGE (org)-[:OWNS]->(:Manufacturer {name: name})
        `,
        { orgId: organizationId, names: manufacturers }
      );
    }

    // Models — owned by org, with MANUFACTURES edge from this org's Manufacturer.
    if (models.length > 0) {
      await session.run(
        `
        MATCH (org:Organization {id: $orgId})
        UNWIND $models AS model
        MERGE (org)-[:OWNS]->(mfg:Manufacturer {name: model.manufacturer})
        MERGE (org)-[:OWNS]->(m:Model {name: model.name})
        MERGE (mfg)-[:MANUFACTURES]->(m)
        `,
        { orgId: organizationId, models }
      );
    }

    // TechnicalDomains — owned by org, with HAS_DOMAIN edge to this org's Model.
    if (domains.length > 0) {
      await session.run(
        `
        MATCH (org:Organization {id: $orgId})
        UNWIND $domains AS domain
        MERGE (org)-[:OWNS]->(d:TechnicalDomain {name: domain.name})
        MERGE (org)-[:OWNS]->(m:Model {name: domain.model})
        MERGE (d)-[:HAS_DOMAIN]->(m)
        `,
        { orgId: organizationId, domains }
      );
    }

    // Categories — owned by org.
    if (categories.length > 0) {
      await session.run(
        `
        MATCH (org:Organization {id: $orgId})
        UNWIND $names AS name
        MERGE (org)-[:OWNS]->(:Category {name: name})
        `,
        { orgId: organizationId, names: categories }
      );
    }

    // Diagrams — owned by org.
    if (diagrams.length > 0) {
      await session.run(
        `
        MATCH (org:Organization {id: $orgId})
        UNWIND $titles AS title
        MERGE (org)-[:OWNS]->(:Diagram {diagram_title: title})
        `,
        { orgId: organizationId, titles: diagrams }
      );
    }

    // SerialNumberRanges — owned by org.
    if (serialRanges.length > 0) {
      await session.run(
        `
        MATCH (org:Organization {id: $orgId})
        UNWIND $ranges AS range
        MERGE (org)-[:OWNS]->(:SerialNumberRange {range: range})
        `,
        { orgId: organizationId, ranges: serialRanges }
      );
    }

    logger.info(
      { organizationId, manufacturers: manufacturers.length, models: models.length, domains: domains.length, categories: categories.length, diagrams: diagrams.length },
      'Neo4j reference nodes created'
    );
  } finally {
    await session.close();
  }
}

/**
 * Create REQUIRES_PART relationships between parts within the same org.
 * Both sides of the relationship must belong to this org (we intentionally
 * do NOT cross-link parts across tenants).
 */
async function createPartRelationships(
  driver: Driver,
  database: string,
  organizationId: string,
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
    // Both endpoints of REQUIRES_PART must be owned by the same org. If a
    // required-part pointer references a part number this org hasn't
    // ingested, the MATCH simply doesn't find it and the MERGE is skipped
    // — no cross-tenant leakage.
    await session.run(
      `
      MATCH (org:Organization {id: $orgId})
      UNWIND $relations AS rel
      MATCH (org)-[:OWNS]->(p1:Part {part_number: rel.from, category_breadcrumb: rel.fromCategory})
      MATCH (org)-[:OWNS]->(p2:Part {part_number: rel.to})
      MERGE (p1)-[:REQUIRES_PART]->(p2)
      `,
      { orgId: organizationId, relations }
    );

    logger.info({ count: relations.length, organizationId }, 'Neo4j REQUIRES_PART relationships created');
  } finally {
    await session.close();
  }
}
