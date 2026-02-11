import neo4j, { Driver } from 'neo4j-driver';
import { credentialsManager } from '../credentials/credentials-manager';
import { prisma } from '@/lib/prisma';
import type { VehicleContext, PartResult } from './postgres-search';

export class Neo4jSearchAgent {
  private driver: Driver;
  private database: string;

  private constructor(uri: string, username: string, password: string, database?: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    this.database = database || 'neo4j';
  }

  static async fromOrganization(organizationId: string): Promise<Neo4jSearchAgent> {
    const credentials = await credentialsManager.getCredentialsWithFallback<{
      uri: string;
      username: string;
      password: string;
      database?: string;
    }>(organizationId, 'NEO4J');

    if (!credentials) {
      throw new Error('Neo4j credentials not configured for this organization');
    }

    return new Neo4jSearchAgent(
      credentials.uri,
      credentials.username,
      credentials.password,
      credentials.database
    );
  }

  // Stop words to filter from natural language queries
  private static STOP_WORDS = new Set([
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'they', 'them',
    'a', 'an', 'the', 'this', 'that', 'these', 'those',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'can', 'may', 'might', 'shall', 'must',
    'and', 'or', 'but', 'if', 'of', 'at', 'by', 'for', 'with', 'to', 'from',
    'in', 'on', 'up', 'out', 'off', 'about', 'into', 'over', 'after',
    'not', 'no', 'nor', 'so', 'too', 'very', 'just',
    'need', 'looking', 'find', 'want', 'search', 'get', 'show', 'give',
    'please', 'help', 'think', 'know', 'sure', 'like', 'also',
    'what', 'where', 'which', 'who', 'how', 'when',
  ]);

  async graphSearch(
    query: string,
    _organizationId: string,
    vehicleContext?: VehicleContext
  ): Promise<PartResult[]> {
    const session = this.driver.session({ database: this.database });

    try {
      // Get search mapping if vehicle context provided
      let mapping = null;
      if (vehicleContext?.vehicleId) {
        mapping = await prisma.vehicleSearchMapping.findUnique({
          where: { vehicleId: vehicleContext.vehicleId },
        });

        if (mapping) {
          console.log('[Neo4jSearchAgent] Using search mapping for vehicle:', vehicleContext.vehicleId);
        } else {
          console.warn('[Neo4jSearchAgent] No search mapping found, using basic query');
        }
      }

      // Extract search terms - filter stop words and short tokens
      const searchTerms = query.toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 1 && !Neo4jSearchAgent.STOP_WORDS.has(term));

      console.log('[Neo4jSearchAgent] Search terms:', searchTerms);

      // Build a cleaned query from keywords (for phrase-level matching in Cypher)
      const cleanedQuery = searchTerms.join(' ');

      // Build Cypher query
      let cypher = '';
      const params: any = {
        query: cleanedQuery,
        searchTerms: searchTerms,
      };

      if (mapping && mapping.neo4jManufacturer && mapping.neo4jModelName) {
        // Use admin-configured Neo4j nomenclature for filtered search
        // Try both relationship directions since graph data may vary:
        //   Part -[:CONTAINS_PART]-> TechnicalDomain  OR  TechnicalDomain -[:CONTAINS_PART]-> Part
        //   TechnicalDomain -[:HAS_DOMAIN]-> Model

        cypher = `
          // Find parts compatible with the specified manufacturer/model
          // Use direction-agnostic match for CONTAINS_PART to handle both directions
          MATCH (p:Part)-[:CONTAINS_PART]-(domain:TechnicalDomain)-[:HAS_DOMAIN]->(model:Model)
          MATCH (model)<-[:MANUFACTURES]-(mfg:Manufacturer)
          WHERE (toLower(mfg.name) CONTAINS toLower($manufacturer) OR toLower(mfg.name) = toLower($manufacturer))
            AND (toLower(model.name) CONTAINS toLower($modelName) OR toLower(model.name) = toLower($modelName))
            ${mapping.neo4jNamespace ? `AND p.namespace = $namespace` : ''}
            AND (
              toLower(p.part_number) CONTAINS $query
              OR toLower(p.part_title) CONTAINS $query
              OR ANY(term IN $searchTerms WHERE
                toLower(p.part_title) CONTAINS term
              )
            )

          // Find related entities
          OPTIONAL MATCH (p)-[:SHOWN_IN_DIAGRAM]->(diag:Diagram)
          OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(cat:Category)
          OPTIONAL MATCH (p)-[:VALID_FOR_RANGE]->(snr:SerialNumberRange)

          // Find related parts
          OPTIONAL MATCH (p)-[rel:REQUIRES_PART|CONTAINS_PART]-(related:Part)

          // Aggregate results
          WITH p, mfg, model, domain,
            collect(DISTINCT diag.diagram_title) AS diagrams,
            collect(DISTINCT cat.name) AS categories,
            collect(DISTINCT snr.range) AS serialRanges,
            collect(DISTINCT {
              type: type(rel),
              partNumber: related.part_number,
              partTitle: related.part_title
            }) AS relationships

          // Return parts with metadata
          RETURN DISTINCT
            p.part_number AS partNumber,
            p.part_title AS partTitle,
            p.diagram_title AS diagramTitle,
            p.category_breadcrumb AS categoryBreadcrumb,
            p.namespace AS namespace,
            p.quantity AS quantity,
            p.remarks AS remarks,
            p.source_url AS sourceUrl,
            diagrams,
            categories,
            collect(DISTINCT domain.name) AS domains,
            collect(DISTINCT model.name) AS compatibleModels,
            collect(DISTINCT mfg.name) AS manufacturers,
            serialRanges,
            relationships,
            // Score based on match quality
            (
              CASE
                WHEN toLower(p.part_number) = $query THEN 100
                WHEN toLower(p.part_number) CONTAINS $query THEN 85
                WHEN toLower(p.part_title) CONTAINS $query THEN 70
                WHEN ANY(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term) THEN 60
                ELSE 40
              END
              + size([r IN relationships WHERE r.partNumber IS NOT NULL]) * 5
            ) AS score

          ORDER BY score DESC
          LIMIT 20
        `;

        params.manufacturer = mapping.neo4jManufacturer;
        params.modelName = mapping.neo4jModelName;

        if (mapping.neo4jNamespace) {
          params.namespace = mapping.neo4jNamespace.trim();
        }
      } else {
        // Basic query without vehicle filters
        cypher = `
          // Search for parts matching the query
          MATCH (p:Part)
          WHERE (
            toLower(p.part_number) CONTAINS $query
            OR toLower(p.part_title) CONTAINS $query
            OR ANY(term IN $searchTerms WHERE
              toLower(p.part_title) CONTAINS term
            )
          )

          // Find related entities (direction-agnostic for CONTAINS_PART)
          OPTIONAL MATCH (p)-[:SHOWN_IN_DIAGRAM]->(diag:Diagram)
          OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(cat:Category)
          OPTIONAL MATCH (p)-[:CONTAINS_PART]-(domain:TechnicalDomain)
          OPTIONAL MATCH (domain)-[:HAS_DOMAIN]->(model:Model)
          OPTIONAL MATCH (model)<-[:MANUFACTURES]-(mfg:Manufacturer)
          OPTIONAL MATCH (p)-[:VALID_FOR_RANGE]->(snr:SerialNumberRange)

          // Find related parts
          OPTIONAL MATCH (p)-[rel:REQUIRES_PART|CONTAINS_PART]-(related:Part)

          // Aggregate results
          WITH p,
            collect(DISTINCT diag.diagram_title) AS diagrams,
            collect(DISTINCT cat.name) AS categories,
            collect(DISTINCT domain.name) AS domains,
            collect(DISTINCT model.name) AS compatibleModels,
            collect(DISTINCT mfg.name) AS manufacturers,
            collect(DISTINCT snr.range) AS serialRanges,
            collect(DISTINCT {
              type: type(rel),
              partNumber: related.part_number,
              partTitle: related.part_title
            }) AS relationships

          // Return parts with metadata
          RETURN
            p.part_number AS partNumber,
            p.part_title AS partTitle,
            p.diagram_title AS diagramTitle,
            p.category_breadcrumb AS categoryBreadcrumb,
            p.namespace AS namespace,
            p.quantity AS quantity,
            p.remarks AS remarks,
            p.source_url AS sourceUrl,
            diagrams,
            categories,
            domains,
            compatibleModels,
            manufacturers,
            serialRanges,
            relationships,
            // Score based on match quality
            (
              CASE
                WHEN toLower(p.part_number) = $query THEN 100
                WHEN toLower(p.part_number) CONTAINS $query THEN 85
                WHEN toLower(p.part_title) CONTAINS $query THEN 70
                WHEN ANY(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term) THEN 60
                ELSE 40
              END
              + size([r IN relationships WHERE r.partNumber IS NOT NULL]) * 5
              + size(compatibleModels) * 3
            ) AS score

          ORDER BY score DESC
          LIMIT 20
        `;
      }

      console.log('[Neo4jSearchAgent] Executing Cypher query with params:', JSON.stringify(params, null, 2));

      const result = await session.run(cypher, params);

      console.log('[Neo4jSearchAgent] Query returned', result.records.length, 'results');
      
      // If no results with the main query, try fallback strategies
      if (result.records.length === 0 && mapping) {
        console.log('[Neo4jSearchAgent] No results found. Trying fallback strategies...');

        // Fallback 1: Try reverse relationship direction (TechnicalDomain may CONTAIN_PART, not Part CONTAINS_PART)
        console.log('[Neo4jSearchAgent] Fallback 1: Trying reverse relationship directions...');
        try {
          const reverseCypher = `
            MATCH (domain:TechnicalDomain)-[:CONTAINS_PART]->(p:Part)
            MATCH (domain)-[:HAS_DOMAIN]->(model:Model)
            MATCH (model)<-[:MANUFACTURES]-(mfg:Manufacturer)
            WHERE (toLower(mfg.name) CONTAINS toLower($manufacturer) OR toLower(mfg.name) = toLower($manufacturer))
              AND (toLower(model.name) CONTAINS toLower($modelName) OR toLower(model.name) = toLower($modelName))
              ${mapping.neo4jNamespace ? `AND p.namespace = $namespace` : ''}
              AND ANY(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term)

            OPTIONAL MATCH (p)-[:SHOWN_IN_DIAGRAM]->(diag:Diagram)
            OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(cat:Category)
            OPTIONAL MATCH (p)-[:VALID_FOR_RANGE]->(snr:SerialNumberRange)
            OPTIONAL MATCH (p)-[rel:REQUIRES_PART|CONTAINS_PART]-(related:Part)

            WITH p, mfg, model, domain,
              collect(DISTINCT diag.diagram_title) AS diagrams,
              collect(DISTINCT cat.name) AS categories,
              collect(DISTINCT snr.range) AS serialRanges,
              collect(DISTINCT {
                type: type(rel),
                partNumber: related.part_number,
                partTitle: related.part_title
              }) AS relationships

            RETURN DISTINCT
              p.part_number AS partNumber,
              p.part_title AS partTitle,
              p.diagram_title AS diagramTitle,
              p.category_breadcrumb AS categoryBreadcrumb,
              p.namespace AS namespace,
              p.quantity AS quantity,
              p.remarks AS remarks,
              p.source_url AS sourceUrl,
              diagrams, categories,
              collect(DISTINCT domain.name) AS domains,
              collect(DISTINCT model.name) AS compatibleModels,
              collect(DISTINCT mfg.name) AS manufacturers,
              serialRanges, relationships,
              70 AS score
            ORDER BY score DESC
            LIMIT 20
          `;

          const reverseResult = await session.run(reverseCypher, params);
          console.log('[Neo4jSearchAgent] Reverse relationship search returned', reverseResult.records.length, 'results');

          if (reverseResult.records.length > 0) {
            return this.parseNeo4jResults(reverseResult);
          }
        } catch (e) {
          console.log('[Neo4jSearchAgent] Reverse relationship search failed:', e);
        }

        // Fallback 2: Search by namespace + keywords (still scoped to the vehicle's catalog)
        if (mapping.neo4jNamespace) {
          console.log('[Neo4jSearchAgent] Fallback 2: Namespace + keyword search...');
          try {
            const namespaceCypher = `
              MATCH (p:Part)
              WHERE p.namespace = $namespace
                AND ALL(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term)

              OPTIONAL MATCH (p)-[:CONTAINS_PART]->(domain:TechnicalDomain)
              OPTIONAL MATCH (domain)-[:HAS_DOMAIN]->(model:Model)
              OPTIONAL MATCH (model)<-[:MANUFACTURES]-(mfg:Manufacturer)
              OPTIONAL MATCH (p)-[:SHOWN_IN_DIAGRAM]->(diag:Diagram)
              OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(cat:Category)
              OPTIONAL MATCH (p)-[:VALID_FOR_RANGE]->(snr:SerialNumberRange)
              OPTIONAL MATCH (p)-[rel:REQUIRES_PART|CONTAINS_PART]-(related:Part)

              WITH p,
                collect(DISTINCT diag.diagram_title) AS diagrams,
                collect(DISTINCT cat.name) AS categories,
                collect(DISTINCT domain.name) AS domains,
                collect(DISTINCT model.name) AS compatibleModels,
                collect(DISTINCT mfg.name) AS manufacturers,
                collect(DISTINCT snr.range) AS serialRanges,
                collect(DISTINCT {
                  type: type(rel),
                  partNumber: related.part_number,
                  partTitle: related.part_title
                }) AS relationships

              RETURN
                p.part_number AS partNumber,
                p.part_title AS partTitle,
                p.diagram_title AS diagramTitle,
                p.category_breadcrumb AS categoryBreadcrumb,
                p.namespace AS namespace,
                p.quantity AS quantity,
                p.remarks AS remarks,
                p.source_url AS sourceUrl,
                diagrams, categories, domains, compatibleModels, manufacturers, serialRanges, relationships,
                (CASE
                  WHEN ALL(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term) THEN 65
                  ELSE 50
                END) AS score
              ORDER BY score DESC
              LIMIT 20
            `;

            const namespaceResult = await session.run(namespaceCypher, params);
            console.log('[Neo4jSearchAgent] Namespace search returned', namespaceResult.records.length, 'results');

            if (namespaceResult.records.length > 0) {
              return this.parseNeo4jResults(namespaceResult);
            }

            // Fallback 2b: Namespace + ANY keyword (less strict)
            const namespaceAnyCypher = `
              MATCH (p:Part)
              WHERE p.namespace = $namespace
                AND ANY(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term)

              OPTIONAL MATCH (p)-[:CONTAINS_PART]->(domain:TechnicalDomain)
              OPTIONAL MATCH (domain)-[:HAS_DOMAIN]->(model:Model)
              OPTIONAL MATCH (model)<-[:MANUFACTURES]-(mfg:Manufacturer)
              OPTIONAL MATCH (p)-[:SHOWN_IN_DIAGRAM]->(diag:Diagram)
              OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(cat:Category)
              OPTIONAL MATCH (p)-[:VALID_FOR_RANGE]->(snr:SerialNumberRange)

              WITH p,
                collect(DISTINCT diag.diagram_title) AS diagrams,
                collect(DISTINCT cat.name) AS categories,
                collect(DISTINCT domain.name) AS domains,
                collect(DISTINCT model.name) AS compatibleModels,
                collect(DISTINCT mfg.name) AS manufacturers,
                collect(DISTINCT snr.range) AS serialRanges,
                // Score based on how many search terms match
                size([term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term]) AS matchCount

              RETURN
                p.part_number AS partNumber,
                p.part_title AS partTitle,
                p.diagram_title AS diagramTitle,
                p.category_breadcrumb AS categoryBreadcrumb,
                p.namespace AS namespace,
                p.quantity AS quantity,
                p.remarks AS remarks,
                p.source_url AS sourceUrl,
                diagrams, categories, domains, compatibleModels, manufacturers, serialRanges,
                [] AS relationships,
                (40 + matchCount * 10) AS score
              ORDER BY score DESC, matchCount DESC
              LIMIT 20
            `;

            const namespaceAnyResult = await session.run(namespaceAnyCypher, params);
            console.log('[Neo4jSearchAgent] Namespace ANY keyword search returned', namespaceAnyResult.records.length, 'results');

            if (namespaceAnyResult.records.length > 0) {
              return this.parseNeo4jResults(namespaceAnyResult);
            }
          } catch (e) {
            console.log('[Neo4jSearchAgent] Namespace search failed:', e);
          }
        }

        // Fallback 3: Broad search by keywords only (last resort, no vehicle scoping)
        console.log('[Neo4jSearchAgent] Fallback 3: Broad keyword search (last resort)...');
        try {
          const broadCypher = `
            MATCH (p:Part)
            WHERE ALL(term IN $searchTerms WHERE toLower(p.part_title) CONTAINS term)

            OPTIONAL MATCH (p)-[:CONTAINS_PART]->(domain:TechnicalDomain)-[:HAS_DOMAIN]->(model:Model)
            OPTIONAL MATCH (model)<-[:MANUFACTURES]-(mfg:Manufacturer)
            OPTIONAL MATCH (p)-[:SHOWN_IN_DIAGRAM]->(diag:Diagram)
            OPTIONAL MATCH (p)-[:BELONGS_TO_CATEGORY]->(cat:Category)
            OPTIONAL MATCH (p)-[:VALID_FOR_RANGE]->(snr:SerialNumberRange)

            WITH p,
              collect(DISTINCT diag.diagram_title) AS diagrams,
              collect(DISTINCT cat.name) AS categories,
              collect(DISTINCT domain.name) AS domains,
              collect(DISTINCT model.name) AS compatibleModels,
              collect(DISTINCT mfg.name) AS manufacturers,
              collect(DISTINCT snr.range) AS serialRanges

            RETURN
              p.part_number AS partNumber,
              p.part_title AS partTitle,
              p.diagram_title AS diagramTitle,
              p.category_breadcrumb AS categoryBreadcrumb,
              p.namespace AS namespace,
              p.quantity AS quantity,
              p.remarks AS remarks,
              p.source_url AS sourceUrl,
              diagrams, categories, domains, compatibleModels, manufacturers, serialRanges,
              [] AS relationships,
              40 AS score
            ORDER BY score DESC
            LIMIT 10
          `;

          const broadResult = await session.run(broadCypher, params);
          console.log('[Neo4jSearchAgent] Broad keyword search returned', broadResult.records.length, 'results');

          if (broadResult.records.length > 0) {
            return this.parseNeo4jResults(broadResult);
          }
        } catch (e) {
          console.log('[Neo4jSearchAgent] Broad keyword search failed:', e);
        }
      }

      return this.parseNeo4jResults(result);
    } catch (error: any) {
      console.error('[Neo4jSearchAgent] Search error:', error);

      // If Neo4j is not set up yet, return empty results instead of failing
      if (
        error.message?.includes('not found') ||
        error.message?.includes('Connection refused') ||
        error.message?.includes('ECONNREFUSED')
      ) {
        console.warn('[Neo4jSearchAgent] Neo4j not configured or unavailable, returning empty results');
        return [];
      }

      throw new Error(`Neo4j search failed: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  private parseNeo4jResults(result: any): PartResult[] {
    return result.records.map((record: any) => {
        const relationships = (record.get('relationships') || []).filter((r: any) => r && r.partNumber);
        const categories = (record.get('categories') || []).filter((c: any) => c);
        const manufacturers = (record.get('manufacturers') || []).filter((m: any) => m);
        const compatibleModels = (record.get('compatibleModels') || []).filter((m: any) => m);
        const serialRanges = (record.get('serialRanges') || []).filter((s: any) => s);
        const diagrams = (record.get('diagrams') || []).filter((d: any) => d);
        const domains = (record.get('domains') || []).filter((d: any) => d);

        // Get score - handle neo4j integer type
        const scoreValue = record.get('score');
        const score = typeof scoreValue === 'object' && scoreValue.toNumber
          ? scoreValue.toNumber()
          : Number(scoreValue) || 50;

        // Get quantity - handle neo4j integer type
        const quantityValue = record.get('quantity');
        const quantity = typeof quantityValue === 'object' && quantityValue.toNumber
          ? quantityValue.toNumber().toString()
          : quantityValue?.toString();

        return {
          partNumber: record.get('partNumber') || '',
          description: record.get('partTitle') || record.get('diagramTitle') || '',
          category: categories.length > 0 ? categories[0] : (record.get('categoryBreadcrumb')?.split(' - ').pop()),
          score,
          source: 'neo4j' as const,
          compatibility: {
            models: compatibleModels,
            manufacturers: manufacturers,
            serialRanges: serialRanges,
            categories: categories,
            domains: domains,
            relationships: relationships.map((r: any) => ({
              type: r.type,
              partNumber: r.partNumber,
              description: r.partTitle,
            })),
          },
          metadata: {
            diagramTitle: record.get('diagramTitle'),
            categoryBreadcrumb: record.get('categoryBreadcrumb'),
            sourceUrl: record.get('sourceUrl'),
            quantity: quantity,
            remarks: record.get('remarks'),
          },
        };
      });
  }

  async close() {
    await this.driver.close();
  }
}
