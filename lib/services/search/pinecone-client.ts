import { credentialsManager } from '../credentials/credentials-manager';
import { prisma } from '@/lib/prisma';
import type { VehicleContext, PartResult } from './postgres-search';

interface PineconeMetadata {
  // Primary fields from John Deere catalog
  part_number?: string;
  part_title?: string;
  text?: string;
  machine_model?: string;
  manufacturer?: string;
  namespace?: string;
  category_breadcrumb?: string;
  diagram_title?: string;
  serial_number_range?: string;
  technical_domain?: string;
  quantity?: string;
  remarks?: string;
  source_url?: string;
  part_key?: number;
  // Fallback fields (other data sources may use these)
  partNumber?: string;
  description?: string;
  name?: string;
  price?: number;
  category?: string;
  make?: string;
  model?: string;
  year?: number;
  [key: string]: any;
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata?: PineconeMetadata;
}

interface PineconeQueryResponse {
  matches: PineconeMatch[];
  namespace: string;
}

interface PineconeEmbedResponse {
  data: Array<{
    values?: number[];
    sparse_indices?: number[];
    sparse_values?: number[];
  }>;
}

export class PineconeSearchAgent {
  private apiKey: string;
  private host: string;

  private constructor(apiKey: string, host: string) {
    this.apiKey = apiKey;
    // Ensure host has https:// prefix
    this.host = host.startsWith('https://') ? host : `https://${host}`;
  }

  static async fromOrganization(organizationId: string): Promise<PineconeSearchAgent> {
    const credentials = await credentialsManager.getCredentials<{
      apiKey: string;
      host: string;
    }>(organizationId, 'PINECONE');

    if (!credentials) {
      throw new Error('Pinecone credentials not configured for this organization');
    }

    if (!credentials.host) {
      throw new Error('Pinecone host URL not configured');
    }

    return new PineconeSearchAgent(credentials.apiKey, credentials.host);
  }

  async hybridSearch(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext
  ): Promise<PartResult[]> {
    try {
      console.log('[PineconeSearchAgent] Search query:', query);
      console.log('[PineconeSearchAgent] Vehicle context:', vehicleContext);
      console.log('[PineconeSearchAgent] Host:', this.host);

      if (!this.host || this.host.trim() === '' || this.host === 'https://') {
        console.error('[PineconeSearchAgent] Host URL is empty!');
        return [];
      }

      // Build metadata filter and get namespace from VehicleSearchMapping
      let metadataFilter: any = {};
      let namespace: string = '';

      if (vehicleContext?.vehicleId) {
        // Get search mapping for this vehicle
        const mapping = await prisma.vehicleSearchMapping.findUnique({
          where: { vehicleId: vehicleContext.vehicleId },
        });

        if (mapping) {
          console.log('[PineconeSearchAgent] Using search mapping for vehicle:', vehicleContext.vehicleId);
          const filterConditions: any[] = [];

          // Use admin-configured nomenclature (skip year - it's optional and causes false negatives)
          if (mapping.pineconeManufacturer) {
            filterConditions.push({
              manufacturer: { $eq: mapping.pineconeManufacturer.trim() }
            });
          }

          if (mapping.pineconeMachineModel) {
            filterConditions.push({
              machine_model: { $eq: mapping.pineconeMachineModel.trim() }
            });
          }

          // Use namespace if configured (trim to avoid leading/trailing spaces)
          if (mapping.pineconeNamespace) {
            namespace = mapping.pineconeNamespace.trim();
            console.log('[PineconeSearchAgent] Using namespace:', namespace);
          }

          if (filterConditions.length > 1) {
            metadataFilter = { $and: filterConditions };
          } else if (filterConditions.length === 1) {
            metadataFilter = filterConditions[0];
          }

          console.log('[PineconeSearchAgent] Using mapping-based filter:', JSON.stringify(metadataFilter, null, 2));
        } else {
          console.warn('[PineconeSearchAgent] No search mapping found for vehicle, skipping filters');
        }
      } else {
        console.log('[PineconeSearchAgent] No vehicle context provided, searching without filters');
      }

      // Generate embeddings using Pinecone's embed API (like n8n workflow)
      const [denseEmbedding, sparseEmbedding] = await Promise.all([
        this.generateDenseEmbedding(query),
        this.generateSparseEmbedding(query),
      ]);

      // If no embedding generated, return empty results
      if (denseEmbedding.length === 0) {
        console.warn('[PineconeSearchAgent] Dense embedding failed, skipping vector search');
        return [];
      }

      // Execute query with manufacturer + model filter (no year)
      let results = await this.executePineconeQuery(
        denseEmbedding, sparseEmbedding, namespace, metadataFilter
      );

      // Fallback: if no results with model filter and we have a namespace, try with namespace only
      if (results.length === 0 && namespace && Object.keys(metadataFilter).length > 0) {
        console.log('[PineconeSearchAgent] No results with model filter, retrying with namespace only...');
        results = await this.executePineconeQuery(
          denseEmbedding, sparseEmbedding, namespace, {}
        );
      }

      console.log('[PineconeSearchAgent] Final results:', results.length);

      return results;
    } catch (error: any) {
      console.error('Pinecone search error:', error);

      // If Pinecone is not set up yet, return empty results instead of failing
      if (error.message?.includes('not found') || error.message?.includes('not configured')) {
        console.warn('Pinecone index not found or not configured, returning empty results');
        return [];
      }

      throw new Error(`Pinecone search failed: ${error.message}`);
    }
  }

  /**
   * Execute a Pinecone query with given embeddings and filter.
   * Returns parsed PartResult array.
   */
  private async executePineconeQuery(
    denseEmbedding: number[],
    sparseEmbedding: { indices: number[]; values: number[] },
    namespace: string,
    metadataFilter: any
  ): Promise<PartResult[]> {
    const queryBody: any = {
      namespace: namespace,
      vector: denseEmbedding,
      topK: 20,
      scoreThreshold: 0.5,
      includeValues: false,
      includeMetadata: true,
    };

    // Add sparse vector if available (hybrid search)
    if (sparseEmbedding.indices.length > 0) {
      queryBody.sparseVector = {
        indices: sparseEmbedding.indices,
        values: sparseEmbedding.values,
      };
    }

    // Add metadata filter if we have conditions
    if (Object.keys(metadataFilter).length > 0) {
      queryBody.filter = metadataFilter;
    }

    console.log('[PineconeSearchAgent] Query body:', JSON.stringify({
      ...queryBody,
      vector: `[${denseEmbedding.length} dimensions]`,
      sparseVector: sparseEmbedding.indices.length > 0 ? `[${sparseEmbedding.indices.length} sparse values]` : undefined,
    }, null, 2));

    const queryResponse = await fetch(`${this.host}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.apiKey,
        'X-Pinecone-API-Version': '2025-04',
      },
      body: JSON.stringify(queryBody),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('[PineconeSearchAgent] Query failed:', queryResponse.status, errorText);
      throw new Error(`Pinecone query failed: ${queryResponse.status} ${errorText}`);
    }

    const queryResults: PineconeQueryResponse = await queryResponse.json();

    console.log('[PineconeSearchAgent] Query returned:', {
      matchCount: queryResults.matches?.length || 0,
      topScores: queryResults.matches?.slice(0, 3).map(m => m.score) || [],
      filter: Object.keys(metadataFilter).length > 0 ? 'applied' : 'none',
    });

    // Parse results
    const rawResults = (queryResults.matches || []).map((match) => {
      const metadata = match.metadata || {};

      // Handle John Deere catalog field names (primary) with fallbacks
      const partNumber = metadata.part_number || metadata.partNumber || match.id;

      // Build description from available fields
      let description = metadata.part_title || metadata.description || metadata.name || '';
      if (!description && metadata.diagram_title) {
        description = metadata.diagram_title;
      }

      // Extract category from breadcrumb or use direct category field
      let category = metadata.category;
      if (!category && metadata.category_breadcrumb) {
        const breadcrumbParts = metadata.category_breadcrumb.split(' - ');
        category = breadcrumbParts[breadcrumbParts.length - 1] || metadata.technical_domain;
      }

      const make = metadata.manufacturer || metadata.make || '';
      const model = metadata.machine_model || metadata.model || '';

      return {
        partNumber,
        description,
        price: metadata.price,
        category,
        score: (match.score || 0) * 100, // Normalize to 0-100
        source: 'pinecone' as const,
        compatibility: {
          make,
          model,
          year: metadata.year,
          serialRange: metadata.serial_number_range,
          technicalDomain: metadata.technical_domain,
        },
        // Include additional metadata for rich display
        metadata: {
          diagramTitle: metadata.diagram_title,
          categoryBreadcrumb: metadata.category_breadcrumb,
          text: metadata.text,
          sourceUrl: metadata.source_url,
          quantity: metadata.quantity,
          remarks: metadata.remarks,
          partKey: metadata.part_key,
        },
      };
    });

    // Aggregate results by part_number — multiple vectors may exist for the same part
    // (indexed IDs: partNumber_breadcrumb_0, _1, _2, etc.)
    return this.aggregateByPartNumber(rawResults);
  }

  /**
   * Aggregate multiple Pinecone hits for the same part_number into a single result.
   * Collects diagram-level detail (diagramTitle, quantity, remarks, sourceUrl, partKey)
   * from all hits into a mergedEntries array on the highest-scoring result.
   */
  private aggregateByPartNumber(results: PartResult[]): PartResult[] {
    const groups = new Map<string, PartResult[]>();

    for (const result of results) {
      const group = groups.get(result.partNumber);
      if (group) {
        group.push(result);
      } else {
        groups.set(result.partNumber, [result]);
      }
    }

    const aggregated: PartResult[] = [];

    for (const group of groups.values()) {
      // Sort by score descending — highest-scoring result is the primary
      group.sort((a, b) => b.score - a.score);
      const primary = { ...group[0] };

      if (group.length > 1) {
        // Collect metadata entries from all hits
        const mergedEntries = group.map((r) => ({
          diagramTitle: r.metadata?.diagramTitle,
          quantity: r.metadata?.quantity,
          remarks: r.metadata?.remarks,
          sourceUrl: r.metadata?.sourceUrl,
          partKey: r.metadata?.partKey,
        }));

        primary.metadata = {
          ...primary.metadata,
          mergedEntries,
        };
      }

      aggregated.push(primary);
    }

    return aggregated;
  }

  /**
   * Generate dense embedding for semantic search using Pinecone Inference API
   * Uses llama-text-embed-v2 model as per n8n workflow
   */
  private async generateDenseEmbedding(text: string): Promise<number[]> {
    try {
      console.log('[PineconeSearchAgent] Generating dense embedding for:', text);

      const response = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.apiKey,
          'X-Pinecone-API-Version': '2025-04',
        },
        body: JSON.stringify({
          model: 'llama-text-embed-v2',
          parameters: {
            input_type: 'query',
            truncate: 'END',
          },
          inputs: [{ text }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PineconeSearchAgent] Dense embed failed:', response.status, errorText);
        return [];
      }

      const data: PineconeEmbedResponse = await response.json();

      if (!data.data || data.data.length === 0 || !data.data[0].values) {
        console.warn('[PineconeSearchAgent] No dense embedding data returned');
        return [];
      }

      console.log('[PineconeSearchAgent] Dense embedding generated:', {
        length: data.data[0].values.length,
      });

      return data.data[0].values;
    } catch (error: any) {
      console.error('[PineconeSearchAgent] Failed to generate dense embedding:', error.message);
      return [];
    }
  }

  /**
   * Generate sparse embedding for keyword search using Pinecone Inference API
   * Uses pinecone-sparse-english-v0 model as per n8n workflow
   */
  private async generateSparseEmbedding(text: string): Promise<{
    indices: number[];
    values: number[];
  }> {
    try {
      console.log('[PineconeSearchAgent] Generating sparse embedding for:', text);

      const response = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.apiKey,
          'X-Pinecone-API-Version': '2025-04',
        },
        body: JSON.stringify({
          model: 'pinecone-sparse-english-v0',
          parameters: {
            input_type: 'query',
            truncate: 'END',
          },
          inputs: [{ text }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PineconeSearchAgent] Sparse embed failed:', response.status, errorText);
        return { indices: [], values: [] };
      }

      const data: PineconeEmbedResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        console.warn('[PineconeSearchAgent] No sparse embedding data returned');
        return { indices: [], values: [] };
      }

      const sparseData = data.data[0];
      if (!sparseData.sparse_indices || !sparseData.sparse_values) {
        console.warn('[PineconeSearchAgent] Sparse embedding missing indices or values');
        return { indices: [], values: [] };
      }

      console.log('[PineconeSearchAgent] Sparse embedding generated:', {
        indexCount: sparseData.sparse_indices.length,
      });

      return {
        indices: sparseData.sparse_indices,
        values: sparseData.sparse_values,
      };
    } catch (error: any) {
      console.error('[PineconeSearchAgent] Failed to generate sparse embedding:', error.message);
      return { indices: [], values: [] };
    }
  }
}
