import { describe, it, expect } from 'vitest';
import { ResponseFormatter } from '../response-formatter';
import type { SearchResult, EnrichedPartResult } from '../multi-agent-orchestrator';

describe('ResponseFormatter', () => {
  const formatter = new ResponseFormatter();

  const makeResult = (
    partNumber: string,
    description: string,
    confidence: number,
    opts: Partial<EnrichedPartResult> = {}
  ): EnrichedPartResult => ({
    partNumber,
    description,
    score: confidence,
    source: 'postgres',
    confidence,
    foundBy: ['postgres'],
    reason: 'test',
    ...opts,
  });

  const makeWebResult = (
    partNumber: string,
    description: string,
    confidence: number,
    sourceUrl?: string
  ): EnrichedPartResult => ({
    partNumber,
    description,
    score: confidence,
    source: 'web',
    confidence,
    foundBy: ['web'],
    reason: 'From web search',
    isWebResult: true,
    metadata: sourceUrl ? { sourceUrl } : undefined,
  });

  describe('formatSearchResults with internal results only', () => {
    it('should format basic search results', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('AT-123456', 'Fuel Filter', 90, {
            price: 24.99,
            stockQuantity: 10,
            category: 'Filters',
            foundBy: ['postgres', 'pinecone'],
          }),
        ],
        suggestedFilters: ['fuel system'],
        relatedQueries: ['oil filter 310G'],
        searchMetadata: {
          totalResults: 1,
          searchTime: 150,
          sourcesUsed: ['postgres', 'pinecone'],
          queryIntent: 'part_description',
        },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'fuel filter');

      expect(formatted.parts.length).toBe(1);
      expect(formatted.parts[0].partNumber).toBe('AT-123456');
      expect(formatted.parts[0].priceFormatted).toBe('$24.99');
      expect(formatted.parts[0].stockStatus).toBe('in-stock');
      expect(formatted.parts[0].confidenceLabel).toBe('high');
      expect(formatted.parts[0].callToAction).toBe('Add to Quote Request');
      expect(formatted.webParts).toBeUndefined();
      expect(formatted.metadata.queryIntent).toBe('part_description');
    });

    it('should handle empty results', () => {
      const searchResult: SearchResult = {
        results: [],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: {
          totalResults: 0,
          searchTime: 50,
          sourcesUsed: ['postgres'],
        },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'nonexistent');

      expect(formatted.parts.length).toBe(0);
      expect(formatted.messageText).toContain("couldn't find any parts");
      expect(formatted.messageHtml).toContain("couldn't find any parts");
    });
  });

  describe('formatSearchResults with web results', () => {
    it('should format web results separately', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('AT-123456', 'Fuel Filter', 90),
        ],
        webResults: [
          makeWebResult('WEB-PART-1', 'Fuel Filter from Amazon', 55, 'https://amazon.com/fuel-filter'),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: {
          totalResults: 2,
          searchTime: 300,
          sourcesUsed: ['postgres', 'web'],
        },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'fuel filter');

      // Internal results
      expect(formatted.parts.length).toBe(1);
      expect(formatted.parts[0].isWebResult).toBeFalsy();

      // Web results
      expect(formatted.webParts).toBeDefined();
      expect(formatted.webParts!.length).toBe(1);
      expect(formatted.webParts![0].isWebResult).toBe(true);
      expect(formatted.webParts![0].callToAction).toBe('View Source');

      // Summary should include web count
      expect(formatted.summary.webResultCount).toBe(1);
    });

    it('should include web results in text message', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('PART-A', 'Internal Result', 80),
        ],
        webResults: [
          makeWebResult('WEB-1', 'Web Result', 50, 'https://example.com'),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: {
          totalResults: 2,
          searchTime: 200,
          sourcesUsed: ['postgres', 'web'],
        },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'test');

      expect(formatted.messageText).toContain('From the Web');
      expect(formatted.messageText).toContain('unverified');
      expect(formatted.messageText).toContain('WEB-1');
    });

    it('should include web results in HTML message', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('PART-A', 'Internal Result', 80),
        ],
        webResults: [
          makeWebResult('WEB-1', 'Web Result', 50, 'https://example.com'),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: {
          totalResults: 2,
          searchTime: 200,
          sourcesUsed: ['postgres', 'web'],
        },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'test');

      expect(formatted.messageHtml).toContain('web-results');
      expect(formatted.messageHtml).toContain('Unverified');
      expect(formatted.messageHtml).toContain('View Source');
    });

    it('should show only web results when no internal results exist', () => {
      const searchResult: SearchResult = {
        results: [],
        webResults: [
          makeWebResult('WEB-1', 'Only Web Result', 50, 'https://example.com'),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: {
          totalResults: 1,
          searchTime: 200,
          sourcesUsed: ['web'],
        },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'test');

      // Should not show "couldn't find" since web results exist
      expect(formatted.messageText).toContain('0 parts');
      // Web parts should still be present
      expect(formatted.webParts).toBeDefined();
      expect(formatted.webParts!.length).toBe(1);
    });
  });

  describe('badges for web results', () => {
    it('should add "From Web" badge for web results', () => {
      const searchResult: SearchResult = {
        results: [],
        webResults: [
          makeWebResult('WEB-1', 'Web Part', 50),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: { totalResults: 1, searchTime: 100, sourcesUsed: ['web'] },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'test');

      const webBadges = formatted.webParts![0].badges;
      expect(webBadges.some(b => b.text === 'From Web')).toBe(true);
      expect(webBadges.some(b => b.variant === 'info')).toBe(true);
    });

    it('should NOT add stock or verification badges for web results', () => {
      const searchResult: SearchResult = {
        results: [],
        webResults: [
          makeWebResult('WEB-1', 'Web Part', 95), // High confidence but still web
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: { totalResults: 1, searchTime: 100, sourcesUsed: ['web'] },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'test');

      const webBadges = formatted.webParts![0].badges;
      expect(webBadges.some(b => b.text === 'Verified Match')).toBe(false);
      expect(webBadges.some(b => b.text === 'In Stock')).toBe(false);
      expect(webBadges.some(b => b.text === 'Exact Match')).toBe(false);
    });
  });

  describe('explanation field', () => {
    it('should pass through explanation to formatted parts', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('PART-A', 'Fuel Filter', 90, {
            explanation: 'Exact match for fuel filter category',
          }),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: { totalResults: 1, searchTime: 100, sourcesUsed: ['postgres'] },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'fuel filter');

      expect(formatted.parts[0].explanation).toBe('Exact match for fuel filter category');
    });

    it('should include explanation in text message', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('PART-A', 'Fuel Filter', 90, {
            explanation: 'Exact match for fuel filter category',
          }),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: { totalResults: 1, searchTime: 100, sourcesUsed: ['postgres'] },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'fuel filter');

      expect(formatted.messageText).toContain('Exact match for fuel filter category');
    });

    it('should include explanation in HTML message', () => {
      const searchResult: SearchResult = {
        results: [
          makeResult('PART-A', 'Fuel Filter', 90, {
            explanation: 'Exact match for fuel filter category',
          }),
        ],
        suggestedFilters: [],
        relatedQueries: [],
        searchMetadata: { totalResults: 1, searchTime: 100, sourcesUsed: ['postgres'] },
      };

      const formatted = formatter.formatSearchResults(searchResult, 'fuel filter');

      expect(formatted.messageHtml).toContain('part-explanation');
      expect(formatted.messageHtml).toContain('Exact match for fuel filter category');
    });
  });
});
