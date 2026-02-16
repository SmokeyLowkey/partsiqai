import { OpenRouterClient } from '../llm/openrouter-client';
import { PROMPTS } from '../llm/prompt-templates';
import type { EnrichedPartResult } from './multi-agent-orchestrator';
import type { ProcessedQuery } from './query-understanding';
import type { VehicleContext } from './postgres-search';

export interface RerankResult {
  results: EnrichedPartResult[];
  suggestedFilters: string[];
  relatedQueries: string[];
  webEnrichment?: string;
}

export class SmartReranker {
  /**
   * Re-rank merged search results using LLM for semantic relevance evaluation.
   * Falls back to the original order if LLM fails.
   */
  async rerank(
    originalQuery: string,
    processedQuery: ProcessedQuery,
    results: EnrichedPartResult[],
    llmClient: OpenRouterClient,
    vehicleContext?: VehicleContext
  ): Promise<RerankResult> {
    if (results.length === 0) {
      return {
        results: [],
        suggestedFilters: [],
        relatedQueries: [],
      };
    }

    // Only send top 30 results to LLM (to limit token usage)
    const topResults = results.slice(0, 30);

    try {
      const prompt = PROMPTS.RERANK_RESULTS(
        originalQuery,
        processedQuery.intent,
        vehicleContext,
        topResults.map(r => ({
          partNumber: r.partNumber,
          description: r.description,
          score: r.score,
          source: r.source,
          foundBy: r.foundBy,
          isWebResult: r.source === 'web',
        }))
      );

      const llmResult = await llmClient.generateStructuredOutput<{
        rankedResults: Array<{
          partNumber: string;
          matchConfidence: number;
          explanation: string;
        }>;
        suggestedFilters: string[];
        relatedQueries: string[];
      }>(prompt, {
        rankedResults: [{
          partNumber: 'string',
          matchConfidence: 0,
          explanation: 'string',
        }],
        suggestedFilters: ['string'],
        relatedQueries: ['string'],
      }, {
        temperature: 0.1,
        maxTokens: 4000,
      });

      console.log('[SmartReranker] LLM re-ranking complete:', {
        inputCount: topResults.length,
        outputCount: llmResult.rankedResults.length,
      });

      // Map LLM results back to EnrichedPartResult
      const rerankedResults: EnrichedPartResult[] = [];
      const remainingResults = [...results]; // Keep all original results

      for (const ranked of llmResult.rankedResults) {
        const idx = remainingResults.findIndex(r => r.partNumber === ranked.partNumber);
        if (idx === -1) continue;

        const original = remainingResults.splice(idx, 1)[0];

        // Filter out results with very low confidence (noise removal)
        if (ranked.matchConfidence < 20) continue;

        rerankedResults.push({
          ...original,
          confidence: ranked.matchConfidence,
          reason: ranked.explanation,
          explanation: ranked.explanation,
          isWebResult: original.source === 'web',
        } as EnrichedPartResult & { explanation?: string; isWebResult?: boolean });
      }

      // Append any results the LLM didn't mention (beyond top 30)
      for (const remaining of remainingResults) {
        // If it wasn't in the LLM's input, keep its original confidence
        if (!topResults.find(r => r.partNumber === remaining.partNumber)) {
          rerankedResults.push(remaining);
        }
        // If it was in the LLM's input but not in output, it was likely filtered as irrelevant
      }

      // Build web enrichment summary if web results exist
      const webResults = rerankedResults.filter(r => r.source === 'web');
      let webEnrichment: string | undefined;
      if (webResults.length > 0) {
        webEnrichment = `Found ${webResults.length} result${webResults.length === 1 ? '' : 's'} from web search. Web results are unverified and shown separately for reference.`;
      }

      return {
        results: rerankedResults,
        suggestedFilters: llmResult.suggestedFilters || [],
        relatedQueries: llmResult.relatedQueries || [],
        webEnrichment,
      };
    } catch (error: any) {
      console.warn('[SmartReranker] LLM re-ranking failed, returning original order:', error.message);
      return {
        results,
        suggestedFilters: [],
        relatedQueries: [],
      };
    }
  }
}
