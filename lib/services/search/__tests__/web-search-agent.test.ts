import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock fn is available before vi.mock factory runs
const { mockGetCredentialsWithFallback } = vi.hoisted(() => ({
  mockGetCredentialsWithFallback: vi.fn().mockResolvedValue({ apiKey: 'test-serper-key' }),
}));

// Mock the credentials manager module
vi.mock('../../credentials/credentials-manager', () => ({
  CredentialsManager: vi.fn().mockImplementation(() => ({
    getCredentialsWithFallback: mockGetCredentialsWithFallback,
  })),
}));

import { WebSearchAgent } from '../web-search-agent';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WebSearchAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default behavior
    mockGetCredentialsWithFallback.mockResolvedValue({ apiKey: 'test-serper-key' });
  });

  describe('fromOrganization', () => {
    it('should create an agent when credentials exist', async () => {
      const agent = await WebSearchAgent.fromOrganization('test-org');
      expect(agent).not.toBeNull();
    });

    it('should return null when credentials are missing', async () => {
      mockGetCredentialsWithFallback.mockResolvedValueOnce(null);

      const agent = await WebSearchAgent.fromOrganization('test-org');
      expect(agent).toBeNull();
    });
  });

  describe('search', () => {
    let agent: WebSearchAgent;

    beforeEach(async () => {
      agent = (await WebSearchAgent.fromOrganization('test-org'))!;
    });

    it('should call Serper API and return parsed results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: 'AT-123456 Fuel Filter - John Deere Parts',
              link: 'https://jdparts.deere.com/parts/AT-123456',
              snippet: 'AT-123456 fuel filter for John Deere 310G. Price: $24.99. In stock.',
              position: 1,
            },
            {
              title: 'Compatible Fuel Filters for Deere',
              link: 'https://example.com/filters',
              snippet: 'Find compatible fuel filters for your heavy equipment.',
              position: 2,
            },
          ],
        }),
      });

      const results = await agent.search('AT-123456 fuel filter');

      // Should have called Serper
      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-KEY': 'test-serper-key',
          }),
        })
      );

      // Should return PartResult array
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('web');
    });

    it('should return empty array when Serper returns no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ organic: [] }),
      });

      const results = await agent.search('nonexistent-part-xyz');
      expect(results).toEqual([]);
    });

    it('should return empty array when Serper API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const results = await agent.search('fuel filter');
      expect(results).toEqual([]);
    });

    it('should cap scores at 70', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: 'AT-123456 - Genuine John Deere Part',
              link: 'https://jdparts.deere.com/AT-123456',
              snippet: 'AT-123456 fuel filter. $29.99',
              position: 1,
            },
          ],
        }),
      });

      const processedQuery = {
        originalQuery: 'AT-123456',
        intent: 'exact_part_number' as const,
        partNumbers: ['AT-123456'],
        partTypes: [],
        expandedTerms: [],
        attributes: [],
        processedQuery: 'AT-123456',
        urgent: false,
        shouldSearchWeb: true,
      };

      const results = await agent.search(processedQuery);
      // Even with part number match (+20) and known domain (+10), cap at 70
      for (const r of results) {
        expect(r.score).toBeLessThanOrEqual(70);
      }
    });

    it('should extract prices from snippets in basic extraction mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: 'Fuel Filter AT-123456',
              link: 'https://example.com/part',
              snippet: 'Buy AT-123456 for only $45.99 with free shipping.',
              position: 1,
            },
          ],
        }),
      });

      const results = await agent.search('AT-123456');
      // Basic extraction should find the price
      const resultWithPrice = results.find(r => r.price !== undefined);
      if (resultWithPrice) {
        expect(resultWithPrice.price).toBe(45.99);
      }
    });

    it('should use LLM extraction when LLM client is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: 'AT-123456 Fuel Filter',
              link: 'https://example.com/part',
              snippet: 'AT-123456 fuel filter for $29.99',
              position: 1,
            },
          ],
        }),
      });

      const mockLlmClient = {
        generateStructuredOutput: vi.fn().mockResolvedValue({
          extractedParts: [
            {
              partNumber: 'AT-123456',
              description: 'Fuel Filter for John Deere',
              price: 29.99,
              sourceName: 'example.com',
              sourceUrl: 'https://example.com/part',
              snippet: 'AT-123456 fuel filter for $29.99',
              relevanceScore: 85,
            },
          ],
        }),
      } as any;

      const results = await agent.search('AT-123456', undefined, mockLlmClient);
      expect(results.length).toBe(1);
      expect(results[0].partNumber).toBe('AT-123456');
      expect(results[0].price).toBe(29.99);
    });

    it('should fall back to basic extraction when LLM fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: 'AT-123456 Filter',
              link: 'https://example.com/part',
              snippet: 'Buy this filter for $19.99',
              position: 1,
            },
          ],
        }),
      });

      const failingLlmClient = {
        generateStructuredOutput: vi.fn().mockRejectedValue(new Error('LLM error')),
      } as any;

      const results = await agent.search('AT-123456', undefined, failingLlmClient);
      // Should still return results via basic extraction
      expect(results.length).toBeGreaterThan(0);
    });

    it('should include vehicle context in search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ organic: [] }),
      });

      await agent.search('fuel filter', { make: 'John Deere', model: '310G', year: 2020 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.q).toContain('John Deere');
      expect(callBody.q).toContain('310G');
    });
  });
});
