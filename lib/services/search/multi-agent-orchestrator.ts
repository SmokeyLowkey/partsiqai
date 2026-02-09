import { PostgresSearchAgent, type VehicleContext, type PartResult } from './postgres-search';
import { PineconeSearchAgent } from './pinecone-client';
import { Neo4jSearchAgent } from './neo4j-client';
import { OpenRouterClient } from '../llm/openrouter-client';
import { PROMPTS } from '../llm/prompt-templates';
import { ResponseFormatter, type FormattedSearchResponse } from './response-formatter';
import { prisma } from '@/lib/prisma';

export interface SearchResult {
  results: EnrichedPartResult[];
  suggestedFilters: string[];
  relatedQueries: string[];
  searchMetadata: {
    totalResults: number;
    searchTime: number;
    sourcesUsed: string[];
  };
}

export interface EnrichedPartResult extends PartResult {
  confidence: number;
  foundBy: Array<'postgres' | 'pinecone' | 'neo4j'>;
  reason: string;
}

export class MultiAgentOrchestrator {
  private postgresAgent: PostgresSearchAgent;
  private pineconeAgent: PineconeSearchAgent | null = null;
  private neo4jAgent: Neo4jSearchAgent | null = null;
  private llmClient: OpenRouterClient | null = null;
  private formatter: ResponseFormatter;

  constructor() {
    this.postgresAgent = new PostgresSearchAgent();
    this.formatter = new ResponseFormatter();
  }

  /**
   * Search with formatted response (optimized for UI display)
   */
  async searchWithFormatting(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext
  ): Promise<FormattedSearchResponse> {
    const rawResults = await this.search(query, organizationId, vehicleContext);
    return this.formatter.formatSearchResults(rawResults, query, vehicleContext);
  }

  async search(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const sourcesUsed: string[] = ['postgres']; // Postgres is always available

    console.log('[MultiAgentOrchestrator] Starting search:', { query, organizationId, vehicleContext });

    try {
      // Check if vehicle is SEARCH_READY before allowing search
      if (vehicleContext?.vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: vehicleContext.vehicleId },
          select: { searchConfigStatus: true, make: true, model: true, year: true },
        });

        if (vehicle?.searchConfigStatus !== 'SEARCH_READY') {
          console.warn('[MultiAgentOrchestrator] Vehicle not ready for search:', {
            vehicleId: vehicleContext.vehicleId,
            status: vehicle?.searchConfigStatus,
          });

          // Return empty results with warning
          return {
            results: [],
            suggestedFilters: [],
            relatedQueries: [],
            searchMetadata: {
              totalResults: 0,
              searchTime: Date.now() - startTime,
              sourcesUsed: [],
            },
          };
        }

        console.log('[MultiAgentOrchestrator] Vehicle is SEARCH_READY:', vehicleContext.vehicleId);
      }
      // Initialize optional agents (they may not be configured)
      console.log('[MultiAgentOrchestrator] Initializing agents...');
      await this.initializeAgents(organizationId);
      console.log('[MultiAgentOrchestrator] Agents initialized:', {
        hasPinecone: !!this.pineconeAgent,
        hasNeo4j: !!this.neo4jAgent,
        hasLLM: !!this.llmClient,
      });

      // Run all available agents in parallel
      const searchPromises: Promise<PartResult[]>[] = [
        this.postgresAgent.search(query, organizationId, vehicleContext),
      ];

      if (this.pineconeAgent) {
        sourcesUsed.push('pinecone');
        searchPromises.push(
          this.pineconeAgent.hybridSearch(query, organizationId, vehicleContext)
        );
      }

      if (this.neo4jAgent) {
        sourcesUsed.push('neo4j');
        searchPromises.push(
          this.neo4jAgent.graphSearch(query, organizationId, vehicleContext)
        );
      }

      console.log('[MultiAgentOrchestrator] Running', searchPromises.length, 'agents in parallel...');

      // Wait for all searches to complete
      const settledResults = await Promise.allSettled(searchPromises);

      console.log('[MultiAgentOrchestrator] Search results:', settledResults.map((r, i) => ({
        agent: i === 0 ? 'postgres' : i === 1 ? 'pinecone' : 'neo4j',
        status: r.status,
        count: r.status === 'fulfilled' ? r.value.length : 0,
        error: r.status === 'rejected' ? r.reason.message : null,
      })));

      // Extract successful results
      const [postgresResults, pineconeResults, neo4jResults] = settledResults;

      const results = {
        postgres:
          postgresResults.status === 'fulfilled' ? postgresResults.value : [],
        pinecone:
          pineconeResults?.status === 'fulfilled' ? pineconeResults.value : [],
        neo4j: neo4jResults?.status === 'fulfilled' ? neo4jResults.value : [],
      };

      // Log actual data from each agent
      console.log('[MultiAgentOrchestrator] PostgreSQL Results:',
        results.postgres.map(p => ({
          partNumber: p.partNumber,
          description: p.description,
          score: p.score,
          category: p.category,
          price: p.price
        }))
      );
      console.log('[MultiAgentOrchestrator] Pinecone Results:',
        results.pinecone.map(p => ({
          partNumber: p.partNumber,
          description: p.description,
          score: p.score
        }))
      );
      console.log('[MultiAgentOrchestrator] Neo4j Results:',
        results.neo4j.map(p => ({
          partNumber: p.partNumber,
          description: p.description,
          score: p.score,
          relationships: p.compatibility?.relationships?.length || 0
        }))
      );

      // Merge and deduplicate results
      const mergedResults = this.mergeResults(results);

      // Calculate confidence scores
      const rankedResults = this.calculateConfidence(mergedResults);

      // LLM synthesis (optional - only if LLM is configured)
      let finalResults = rankedResults;
      let suggestedFilters: string[] = [];
      let relatedQueries: string[] = [];

      if (this.llmClient && rankedResults.length > 0) {
        try {
          const synthesis = await this.llmSynthesis(query, results, rankedResults);
          finalResults = synthesis.rankedResults;
          suggestedFilters = synthesis.suggestedFilters;
          relatedQueries = synthesis.relatedQueries;
        } catch (error) {
          console.warn('LLM synthesis failed, using ranked results:', error);
          // Fall back to ranked results without LLM synthesis
        }
      }

      const searchTime = Date.now() - startTime;

      console.log('[MultiAgentOrchestrator] Search complete:', {
        totalResults: finalResults.length,
        searchTime: `${searchTime}ms`,
        sourcesUsed,
      });

      return {
        results: finalResults.slice(0, 20), // Top 20 results
        suggestedFilters,
        relatedQueries,
        searchMetadata: {
          totalResults: finalResults.length,
          searchTime,
          sourcesUsed,
        },
      };
    } catch (error: any) {
      console.error('[MultiAgentOrchestrator] Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    } finally {
      // Clean up Neo4j connection
      if (this.neo4jAgent) {
        await this.neo4jAgent.close();
      }
    }
  }

  private async initializeAgents(organizationId: string) {
    try {
      this.pineconeAgent = await PineconeSearchAgent.fromOrganization(organizationId);
    } catch (error) {
      console.warn('Pinecone not configured for this organization');
      this.pineconeAgent = null;
    }

    try {
      this.neo4jAgent = await Neo4jSearchAgent.fromOrganization(organizationId);
    } catch (error) {
      console.warn('Neo4j not configured for this organization');
      this.neo4jAgent = null;
    }

    try {
      this.llmClient = await OpenRouterClient.fromOrganization(organizationId);
    } catch (error) {
      console.warn('OpenRouter not configured for this organization');
      this.llmClient = null;
    }
  }

  private mergeResults(results: {
    postgres: PartResult[];
    pinecone: PartResult[];
    neo4j: PartResult[];
  }): Map<string, PartResult & { sources: Array<'postgres' | 'pinecone' | 'neo4j'> }> {
    const merged = new Map<
      string,
      PartResult & { sources: Array<'postgres' | 'pinecone' | 'neo4j'> }
    >();

    // Helper to add result to map
    const addResult = (
      result: PartResult,
      source: 'postgres' | 'pinecone' | 'neo4j'
    ) => {
      const key = result.partNumber;

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.sources.push(source);
        // Use highest score
        existing.score = Math.max(existing.score, result.score);
        
        // Merge compatibility data - combine all fields
        if (result.compatibility) {
          existing.compatibility = {
            ...existing.compatibility,
            ...result.compatibility,
            // Merge arrays intelligently
            models: [
              ...(existing.compatibility?.models || []),
              ...(result.compatibility.models || [])
            ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
            manufacturers: [
              ...(existing.compatibility?.manufacturers || []),
              ...(result.compatibility.manufacturers || [])
            ].filter((v, i, a) => a.indexOf(v) === i),
            serialRanges: [
              ...(existing.compatibility?.serialRanges || []),
              ...(result.compatibility.serialRanges || [])
            ].filter((v, i, a) => a.indexOf(v) === i),
            categories: [
              ...(existing.compatibility?.categories || []),
              ...(result.compatibility.categories || [])
            ].filter((v, i, a) => a.indexOf(v) === i),
            domains: [
              ...(existing.compatibility?.domains || []),
              ...(result.compatibility.domains || [])
            ].filter((v, i, a) => a.indexOf(v) === i),
            relationships: [
              ...(existing.compatibility?.relationships || []),
              ...(result.compatibility.relationships || [])
            ],
          };
        }
        
        // Merge metadata - prefer non-empty values
        if (result.metadata) {
          existing.metadata = {
            ...(existing.metadata || {}),
            ...result.metadata,
            // Prefer non-empty strings
            diagramTitle: result.metadata.diagramTitle || existing.metadata?.diagramTitle,
            categoryBreadcrumb: result.metadata.categoryBreadcrumb || existing.metadata?.categoryBreadcrumb,
            text: result.metadata.text || existing.metadata?.text,
            sourceUrl: result.metadata.sourceUrl || existing.metadata?.sourceUrl,
            quantity: result.metadata.quantity || existing.metadata?.quantity,
            remarks: result.metadata.remarks || existing.metadata?.remarks,
            // Preserve merged entries from Pinecone aggregation
            mergedEntries: result.metadata.mergedEntries || existing.metadata?.mergedEntries,
          };
        }
      } else {
        merged.set(key, { ...result, sources: [source] });
      }
    };

    // Add all results
    results.postgres.forEach((r) => addResult(r, 'postgres'));
    results.pinecone.forEach((r) => addResult(r, 'pinecone'));
    results.neo4j.forEach((r) => addResult(r, 'neo4j'));

    return merged;
  }

  private calculateConfidence(
    mergedResults: Map<string, PartResult & { sources: Array<'postgres' | 'pinecone' | 'neo4j'> }>
  ): EnrichedPartResult[] {
    const results: EnrichedPartResult[] = [];

    for (const [_, result] of mergedResults) {
      // Base confidence from search score
      let confidence = result.score;

      // Multi-source bonus (found by multiple agents = more confident)
      const sourceCount = result.sources.length;
      if (sourceCount > 1) {
        confidence += sourceCount * 10;
      }

      // Cap at 100
      confidence = Math.min(confidence, 100);

      // Generate reason
      let reason = '';
      if (sourceCount === 3) {
        reason = 'High confidence: Found by all search methods';
      } else if (sourceCount === 2) {
        reason = `Good match: Found by ${result.sources.join(' and ')}`;
      } else if (result.score >= 80) {
        reason = 'Exact or close part number match';
      } else if (result.score >= 60) {
        reason = 'Description match';
      } else {
        reason = 'Partial match';
      }

      results.push({
        ...result,
        confidence,
        foundBy: result.sources,
        reason,
      });
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async llmSynthesis(
    query: string,
    results: {
      postgres: PartResult[];
      pinecone: PartResult[];
      neo4j: PartResult[];
    },
    mergedRankedResults: EnrichedPartResult[]
  ): Promise<{
    rankedResults: EnrichedPartResult[];
    suggestedFilters: string[];
    relatedQueries: string[];
  }> {
    if (!this.llmClient) {
      throw new Error('LLM client not available');
    }

    console.log('[MultiAgentOrchestrator] Starting LLM synthesis...');

    // Build comprehensive prompt with agent responses
    const agentResponses = {
      database: {
        answer: results.postgres.length > 0
          ? `Found ${results.postgres.length} parts from database`
          : 'No parts found in database',
        results: results.postgres.map(p => ({
          partNumber: p.partNumber,
          description: p.description,
          price: p.price,
          category: p.category,
          score: p.score
        })),
        metadata: {
          confidence: results.postgres.length > 0 ? 0.8 : 0.3,
          result_count: results.postgres.length
        }
      },
      graph_rag: {
        answer: results.neo4j.length > 0
          ? `Found ${results.neo4j.length} parts with relationship data`
          : 'No relationship data found',
        related_parts: results.neo4j.map(p => ({
          partNumber: p.partNumber,
          description: p.description,
          relationships: p.compatibility?.relationships || []
        })),
        metadata: {
          confidence: results.neo4j.length > 0 ? 0.7 : 0.3,
          has_relationships: results.neo4j.some(p => p.compatibility?.relationships?.length)
        }
      },
      hybrid_rag: {
        answer: results.pinecone.length > 0
          ? `Found ${results.pinecone.length} semantically similar parts`
          : 'No semantic matches found',
        similar_parts: results.pinecone.map(p => ({
          partNumber: p.partNumber,
          description: p.description,
          score: p.score
        })),
        metadata: {
          confidence: results.pinecone.length > 0 ? 0.75 : 0.3,
          result_count: results.pinecone.length
        }
      }
    };

    // Build chat input matching n8n workflow structure
    const chatInput = {
      originalQuery: query,
      agentResponses: agentResponses,
      totalPartsFound: results.postgres.length + results.pinecone.length + results.neo4j.length
    };

    const prompt = PROMPTS.SYNTHESIZE_SEARCH_RESULTS(chatInput);

    const synthesis = await this.llmClient.generateStructuredOutput<{
      results: Array<{
        partNumber: string;
        description: string;
        matchConfidence: number;
        price?: number;
        availability?: string;
        compatibility?: string[];
      }>;
      suggestedFilters: Array<{
        type: string;
        value: string;
        count: number;
      }>;
      relatedQueries: string[];
      conversationNextSteps: string[];
    }>(prompt, {
      results: [
        {
          partNumber: 'string',
          description: 'string',
          matchConfidence: 0,
          price: 0,
          availability: 'string',
          compatibility: ['string']
        }
      ],
      suggestedFilters: [
        {
          type: 'string',
          value: 'string',
          count: 0
        }
      ],
      relatedQueries: ['string'],
      conversationNextSteps: ['string']
    });

    console.log('[MultiAgentOrchestrator] LLM synthesis complete:', {
      resultsCount: synthesis.results.length,
      avgConfidence: synthesis.results.reduce((sum, r) => sum + r.matchConfidence, 0) / synthesis.results.length
    });

    // Map LLM results back to EnrichedPartResult format
    // Use mergedRankedResults (which have properly combined metadata from all sources)
    // instead of raw per-source results to avoid losing metadata
    const enrichedResults: EnrichedPartResult[] = synthesis.results.map((r) => {
      // Find from the already-merged results which have combined metadata/compatibility
      const merged = mergedRankedResults.find((m) => m.partNumber === r.partNumber);

      return {
        partNumber: r.partNumber,
        description: r.description,
        price: r.price || merged?.price,
        stockQuantity: merged?.stockQuantity,
        category: merged?.category,
        compatibility: merged?.compatibility,
        score: merged?.score || 50,
        source: merged?.source || 'postgres',
        confidence: r.matchConfidence,
        foundBy: merged?.foundBy || ['postgres'],
        reason: `LLM evaluated match confidence: ${r.matchConfidence}%`,
        metadata: merged?.metadata,
      };
    });

    return {
      rankedResults: enrichedResults,
      suggestedFilters: synthesis.suggestedFilters.map(f => f.value),
      relatedQueries: synthesis.relatedQueries,
    };
  }
}
