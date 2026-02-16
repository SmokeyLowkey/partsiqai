import { PostgresSearchAgent, type VehicleContext, type PartResult } from './postgres-search';
import { PineconeSearchAgent } from './pinecone-client';
import { Neo4jSearchAgent } from './neo4j-client';
import { WebSearchAgent } from './web-search-agent';
import { QueryUnderstandingAgent, type ProcessedQuery } from './query-understanding';
import { SmartReranker } from './smart-reranker';
import { OpenRouterClient } from '../llm/openrouter-client';
import { PROMPTS } from '../llm/prompt-templates';
import { ResponseFormatter, type FormattedSearchResponse } from './response-formatter';
import { prisma } from '@/lib/prisma';

export interface SearchResult {
  results: EnrichedPartResult[];
  webResults?: EnrichedPartResult[];
  suggestedFilters: string[];
  relatedQueries: string[];
  searchMetadata: {
    totalResults: number;
    searchTime: number;
    sourcesUsed: string[];
    queryIntent?: string;
  };
}

export interface EnrichedPartResult extends PartResult {
  confidence: number;
  foundBy: Array<'postgres' | 'pinecone' | 'neo4j' | 'web'>;
  reason: string;
  explanation?: string;
  isWebResult?: boolean;
}

export class MultiAgentOrchestrator {
  private postgresAgent: PostgresSearchAgent;
  private pineconeAgent: PineconeSearchAgent | null = null;
  private neo4jAgent: Neo4jSearchAgent | null = null;
  private webSearchAgent: WebSearchAgent | null = null;
  private llmClient: OpenRouterClient | null = null;
  private formatter: ResponseFormatter;
  private reranker: SmartReranker;

  constructor() {
    this.postgresAgent = new PostgresSearchAgent();
    this.formatter = new ResponseFormatter();
    this.reranker = new SmartReranker();
  }

  /**
   * Search with formatted response (optimized for UI display)
   */
  async searchWithFormatting(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext,
    options?: { webSearchOnly?: boolean }
  ): Promise<FormattedSearchResponse> {
    const rawResults = await this.search(query, organizationId, vehicleContext, options);
    const formatted = this.formatter.formatSearchResults(rawResults, query, vehicleContext);
    if (options?.webSearchOnly) {
      formatted.webSearchOnly = true;
      formatted.messageText = `🔍 **Web Search Results** — This vehicle is still being configured by your administrator. Showing web search results only.\n\n${formatted.messageText}`;
    }
    return formatted;
  }

  async search(
    query: string,
    organizationId: string,
    vehicleContext?: VehicleContext,
    options?: { webSearchOnly?: boolean }
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const sourcesUsed: string[] = [];

    console.log('[MultiAgentOrchestrator] Starting search:', { query, organizationId, vehicleContext, webSearchOnly: options?.webSearchOnly });

    try {
      // If webSearchOnly, skip vehicle check and internal searches — go straight to web
      if (options?.webSearchOnly) {
        console.log('[MultiAgentOrchestrator] Web search only mode (vehicle not configured)');
        await this.initializeAgents(organizationId);

        if (!this.webSearchAgent) {
          console.warn('[MultiAgentOrchestrator] No web search agent available for web-only search');
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

        sourcesUsed.push('web');
        const processedQuery = await QueryUnderstandingAgent.analyze(query, vehicleContext, this.llmClient, 2000);

        try {
          const rawWebResults = await this.webSearchAgent.search(processedQuery, vehicleContext, this.llmClient);
          const webResults: EnrichedPartResult[] = rawWebResults.map(r => ({
            ...r,
            confidence: r.score,
            foundBy: ['web'] as Array<'postgres' | 'pinecone' | 'neo4j' | 'web'>,
            reason: 'Found via web search — vehicle configuration pending',
            isWebResult: true,
          }));

          return {
            results: [],
            webResults: webResults.slice(0, 10),
            suggestedFilters: [],
            relatedQueries: [],
            searchMetadata: {
              totalResults: webResults.length,
              searchTime: Date.now() - startTime,
              sourcesUsed,
              queryIntent: processedQuery.intent,
            },
          };
        } catch (error: any) {
          console.warn('[MultiAgentOrchestrator] Web-only search failed:', error.message);
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
      }

      // Check if vehicle is SEARCH_READY before allowing internal search
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

      sourcesUsed.push('postgres'); // Postgres is always used for full search
      // Initialize optional agents (they may not be configured)
      console.log('[MultiAgentOrchestrator] Initializing agents...');
      await this.initializeAgents(organizationId);
      console.log('[MultiAgentOrchestrator] Agents initialized:', {
        hasPinecone: !!this.pineconeAgent,
        hasNeo4j: !!this.neo4jAgent,
        hasLLM: !!this.llmClient,
        hasWebSearch: !!this.webSearchAgent,
      });

      // ============================================================
      // Step 1: Query Understanding (NEW - pre-search LLM call)
      // ============================================================
      const processedQuery = await QueryUnderstandingAgent.analyze(
        query,
        vehicleContext,
        this.llmClient,
        2000 // 2s timeout
      );

      console.log('[MultiAgentOrchestrator] Query understanding:', {
        intent: processedQuery.intent,
        partNumbers: processedQuery.partNumbers,
        partTypes: processedQuery.partTypes,
        expandedTerms: processedQuery.expandedTerms.slice(0, 5),
        shouldSearchWeb: processedQuery.shouldSearchWeb,
      });

      // ============================================================
      // Step 2: Parallel internal search
      // Use processedQuery for Postgres (expanded terms for keyword search)
      // Pass raw query to Pinecone/Neo4j (as per plan: don't change their query generation)
      // ============================================================

      // Build the Postgres search query: include expanded terms for broader keyword matching
      const postgresSearchQuery = processedQuery.expandedTerms.length > 0
        ? `${processedQuery.processedQuery} ${processedQuery.expandedTerms.join(' ')}`
        : processedQuery.processedQuery;

      const searchPromises: Promise<PartResult[]>[] = [
        this.postgresAgent.search(postgresSearchQuery, organizationId, vehicleContext),
      ];

      if (this.pineconeAgent) {
        sourcesUsed.push('pinecone');
        // Pinecone: use original query unchanged (per plan requirement)
        searchPromises.push(
          this.pineconeAgent.hybridSearch(query, organizationId, vehicleContext)
        );
      }

      if (this.neo4jAgent) {
        sourcesUsed.push('neo4j');
        // Neo4j: use original query unchanged (per plan requirement)
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

      // ============================================================
      // Step 3: Merge & deduplicate internal results
      // ============================================================
      const mergedResults = this.mergeResults(results);
      const rankedResults = this.calculateConfidence(mergedResults);

      // ============================================================
      // Step 4: Conditional web search (second pass — NOT every search)
      // ============================================================
      const internalResultCount = rankedResults.length;
      let webResults: EnrichedPartResult[] = [];

      const shouldRunWebSearch = this.webSearchAgent && (
        internalResultCount < 3 || processedQuery.shouldSearchWeb
      );

      if (shouldRunWebSearch && this.webSearchAgent) {
        sourcesUsed.push('web');
        console.log('[MultiAgentOrchestrator] Triggering web search (internal results:', internalResultCount, ')');

        try {
          const rawWebResults = await this.webSearchAgent.search(
            processedQuery,
            vehicleContext,
            this.llmClient
          );

          // Convert web results to EnrichedPartResult
          webResults = rawWebResults.map(r => ({
            ...r,
            confidence: r.score,
            foundBy: ['web'] as Array<'postgres' | 'pinecone' | 'neo4j' | 'web'>,
            reason: 'Found via web search — unverified',
            isWebResult: true,
          }));

          console.log('[MultiAgentOrchestrator] Web search returned', webResults.length, 'results');
        } catch (error: any) {
          console.warn('[MultiAgentOrchestrator] Web search failed:', error.message);
        }
      }

      // ============================================================
      // Step 5: Smart re-ranking (replaces llmSynthesis)
      // ============================================================
      let finalResults = rankedResults;
      let finalWebResults = webResults;
      let suggestedFilters: string[] = [];
      let relatedQueries: string[] = [];

      if (this.llmClient && (rankedResults.length > 0 || webResults.length > 0)) {
        try {
          // Combine internal + web results for re-ranking
          const allResults = [...rankedResults, ...webResults];

          const rerankResult = await this.reranker.rerank(
            query,
            processedQuery,
            allResults,
            this.llmClient,
            vehicleContext
          );

          // Separate internal and web results after re-ranking
          finalResults = rerankResult.results.filter(r => !r.isWebResult);
          finalWebResults = rerankResult.results.filter(r => r.isWebResult);
          suggestedFilters = rerankResult.suggestedFilters;
          relatedQueries = rerankResult.relatedQueries;
        } catch (error) {
          console.warn('[MultiAgentOrchestrator] Smart re-ranking failed, using ranked results:', error);
          // Fall back to ranked results without re-ranking
        }
      }

      const searchTime = Date.now() - startTime;

      console.log('[MultiAgentOrchestrator] Search complete:', {
        totalResults: finalResults.length,
        webResults: finalWebResults.length,
        searchTime: `${searchTime}ms`,
        sourcesUsed,
        queryIntent: processedQuery.intent,
      });

      return {
        results: finalResults.slice(0, 20), // Top 20 internal results
        webResults: finalWebResults.length > 0 ? finalWebResults.slice(0, 10) : undefined,
        suggestedFilters,
        relatedQueries,
        searchMetadata: {
          totalResults: finalResults.length + finalWebResults.length,
          searchTime,
          sourcesUsed,
          queryIntent: processedQuery.intent,
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

    try {
      this.webSearchAgent = await WebSearchAgent.fromOrganization(organizationId);
    } catch (error) {
      console.warn('Serper not configured for this organization');
      this.webSearchAgent = null;
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
}
