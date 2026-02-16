import { CredentialsManager } from '../credentials/credentials-manager';
import { OpenRouterClient } from '../llm/openrouter-client';
import { PROMPTS } from '../llm/prompt-templates';
import type { PartResult, VehicleContext } from './postgres-search';
import type { ProcessedQuery } from './query-understanding';

interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperResponse {
  organic: SerperSearchResult[];
  searchParameters?: { q: string };
}

interface ExtractedWebPart {
  partNumber: string | null;
  description: string;
  price: number | null;
  sourceName: string;
  sourceUrl: string;
  snippet: string;
  relevanceScore: number;
}

// Known parts supplier domains for boosting
const KNOWN_SUPPLIER_DOMAINS = [
  'deere.com', 'jdparts.deere.com',
  'cat.com', 'parts.cat.com',
  'komatsu.com',
  'volvoce.com',
  'kubota.com',
  'case.com', 'casece.com',
  'bobcat.com',
  'hitachicm.com',
  'amazon.com',
  'ebay.com',
  'aliexpress.com',
  'tractorhouseparts.com',
  'tractorjoe.com',
  'jacks-small-engines.com',
  'messicks.com',
  'agkits.com',
  'yesterdaystractors.com',
  'partstore.com',
];

const credentialsManager = new CredentialsManager();

export class WebSearchAgent {
  private apiKey: string;

  private constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Initialize from organization credentials (Serper API key)
   */
  static async fromOrganization(organizationId: string): Promise<WebSearchAgent | null> {
    try {
      const creds = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
        organizationId,
        'SERPER'
      );

      if (!creds?.apiKey) {
        console.log('[WebSearchAgent] No Serper credentials found');
        return null;
      }

      return new WebSearchAgent(creds.apiKey);
    } catch (error: any) {
      console.warn('[WebSearchAgent] Failed to initialize:', error.message);
      return null;
    }
  }

  /**
   * Search the web for parts information.
   * Returns PartResult[] with source: 'web' and lower base scores (40-60).
   */
  async search(
    query: string | ProcessedQuery,
    vehicleContext?: VehicleContext,
    llmClient?: OpenRouterClient | null
  ): Promise<PartResult[]> {
    const processedQuery = typeof query === 'string' ? null : query;
    const searchText = typeof query === 'string' ? query : query.processedQuery;

    console.log('[WebSearchAgent] Starting web search for:', searchText);

    try {
      // Build search query optimized for parts
      const searchQuery = this.buildSearchQuery(searchText, processedQuery, vehicleContext);

      // Call Serper API
      const serperResults = await this.callSerper(searchQuery);

      if (!serperResults.organic || serperResults.organic.length === 0) {
        console.log('[WebSearchAgent] No organic results from Serper');
        return [];
      }

      console.log('[WebSearchAgent] Serper returned', serperResults.organic.length, 'results');

      // Filter to top relevant results
      const topResults = serperResults.organic.slice(0, 8);

      // Extract structured parts info using LLM or fallback
      let extractedParts: ExtractedWebPart[];
      if (llmClient) {
        extractedParts = await this.llmExtract(searchText, topResults, llmClient);
      } else {
        extractedParts = this.basicExtract(topResults, processedQuery);
      }

      // Convert to PartResult format
      return this.toPartResults(extractedParts, processedQuery);
    } catch (error: any) {
      console.error('[WebSearchAgent] Search failed:', error.message);
      return [];
    }
  }

  /**
   * Build an optimized search query for parts
   */
  private buildSearchQuery(
    searchText: string,
    processedQuery: ProcessedQuery | null,
    vehicleContext?: VehicleContext
  ): string {
    const parts: string[] = [];

    // Use part numbers if detected
    if (processedQuery?.partNumbers?.length) {
      parts.push(processedQuery.partNumbers.join(' OR '));
    }

    // Add the processed or raw query
    parts.push(searchText);

    // Add vehicle context
    if (vehicleContext) {
      parts.push(`${vehicleContext.make} ${vehicleContext.model}`);
    }

    // Add parts-specific terms
    parts.push('parts');

    return parts.join(' ');
  }

  /**
   * Call Serper API for organic search results
   */
  private async callSerper(query: string): Promise<SerperResponse> {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Use LLM to extract structured parts info from search snippets
   */
  private async llmExtract(
    query: string,
    results: SerperSearchResult[],
    llmClient: OpenRouterClient
  ): Promise<ExtractedWebPart[]> {
    try {
      const prompt = PROMPTS.EXTRACT_WEB_PARTS_INFO(
        query,
        results.map(r => ({ title: r.title, link: r.link, snippet: r.snippet }))
      );

      const extracted = await llmClient.generateStructuredOutput<{
        extractedParts: ExtractedWebPart[];
      }>(prompt, {
        extractedParts: [{
          partNumber: 'string',
          description: 'string',
          price: 0,
          sourceName: 'string',
          sourceUrl: 'string',
          snippet: 'string',
          relevanceScore: 0,
        }],
      }, {
        temperature: 0.1,
        maxTokens: 2000,
      });

      return extracted.extractedParts || [];
    } catch (error: any) {
      console.warn('[WebSearchAgent] LLM extraction failed, using basic extraction:', error.message);
      return this.basicExtract(results, null);
    }
  }

  /**
   * Basic extraction without LLM — parse snippets for part numbers and prices
   */
  private basicExtract(
    results: SerperSearchResult[],
    processedQuery: ProcessedQuery | null
  ): ExtractedWebPart[] {
    return results.map(result => {
      // Try to extract a part number from the snippet or title
      const partNumberMatch = (result.title + ' ' + result.snippet).match(
        /\b[A-Z]{1,3}[-]?\d{4,7}\b|\b\d{3,4}[-]\d{4,6}\b/i
      );

      // Try to extract a price
      const priceMatch = result.snippet.match(/\$[\d,]+\.?\d{0,2}/);
      const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;

      // Extract source name from URL
      let sourceName = 'Unknown';
      try {
        sourceName = new URL(result.link).hostname.replace('www.', '');
      } catch { /* ignore */ }

      return {
        partNumber: partNumberMatch ? partNumberMatch[0] : null,
        description: result.title,
        price,
        sourceName,
        sourceUrl: result.link,
        snippet: result.snippet,
        relevanceScore: 50,
      };
    });
  }

  /**
   * Convert extracted web parts to PartResult format
   */
  private toPartResults(
    extractedParts: ExtractedWebPart[],
    processedQuery: ProcessedQuery | null
  ): PartResult[] {
    return extractedParts
      .filter(p => p.relevanceScore >= 20) // Filter out irrelevant results
      .map(part => {
        // Calculate score based on relevance and domain trust
        let score = Math.min(Math.max(part.relevanceScore * 0.6, 40), 60); // Base: 40-60

        // Boost if part number matches a query-detected part number
        if (part.partNumber && processedQuery?.partNumbers?.length) {
          const normalizedPartNum = part.partNumber.replace(/[-\s]/g, '').toUpperCase();
          const queryPartNums = processedQuery.partNumbers.map(p => p.replace(/[-\s]/g, '').toUpperCase());
          if (queryPartNums.includes(normalizedPartNum)) {
            score += 20;
          }
        }

        // Boost if from known manufacturer/supplier website
        const isKnownDomain = KNOWN_SUPPLIER_DOMAINS.some(domain =>
          part.sourceUrl.toLowerCase().includes(domain)
        );
        if (isKnownDomain) {
          score += 10;
        }

        // Cap at 70 (never higher than verified internal results)
        score = Math.min(score, 70);

        return {
          partNumber: part.partNumber || `WEB-${part.sourceName.substring(0, 10)}`,
          description: part.description,
          price: part.price || undefined,
          score,
          source: 'web' as const,
          metadata: {
            sourceUrl: part.sourceUrl,
            text: part.snippet,
          },
          // Extended web-specific metadata stored in compatibility for now
          compatibility: {
            webSource: {
              sourceName: part.sourceName,
              sourceUrl: part.sourceUrl,
              snippet: part.snippet,
              isVerified: false,
            },
          },
        };
      });
  }
}
