import { describe, it, expect, vi } from 'vitest';
import { QueryUnderstandingAgent } from '../query-understanding';
import type { ProcessedQuery } from '../query-understanding';

describe('QueryUnderstandingAgent', () => {
  describe('regexFallback', () => {
    it('should detect exact part numbers in various formats', () => {
      // Format: XX-NNNNNNN
      const result1 = QueryUnderstandingAgent.regexFallback('I need part AT-123456');
      expect(result1.partNumbers).toContain('AT-123456');
      expect(result1.intent).toBe('exact_part_number');

      // Format: NNN-NNNNNN
      const result2 = QueryUnderstandingAgent.regexFallback('Looking for 123-45678');
      expect(result2.partNumbers).toContain('123-45678');
      expect(result2.intent).toBe('exact_part_number');

      // Format: XXNNNNNNN (no dash)
      const result3 = QueryUnderstandingAgent.regexFallback('Find RE54321 please');
      expect(result3.partNumbers).toContain('RE54321');
      expect(result3.intent).toBe('exact_part_number');
    });

    it('should detect multiple part numbers in a single query', () => {
      const result = QueryUnderstandingAgent.regexFallback('Compare AT-123456 and RE54321');
      expect(result.partNumbers).toContain('AT-123456');
      expect(result.partNumbers).toContain('RE54321');
      expect(result.intent).toBe('exact_part_number');
    });

    it('should detect part types and generate expanded terms', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel filter for my excavator');
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
      expect(result.expandedTerms.length).toBeGreaterThan(0);
      expect(result.expandedTerms).toContain('fuel element');
      expect(result.expandedTerms).toContain('fuel strainer');
    });

    it('should detect filter as a general part type', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a filter');
      expect(result.partTypes).toContain('filter');
      expect(result.expandedTerms).toContain('filter element');
    });

    it('should detect hydraulic filter specifically', () => {
      const result = QueryUnderstandingAgent.regexFallback('hydraulic filter replacement');
      expect(result.partTypes).toContain('hydraulic filter');
      expect(result.expandedTerms).toContain('hydraulic element');
      expect(result.expandedTerms).toContain('hyd filter');
    });

    it('should detect part type from synonyms in query', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need a fuel strainer');
      expect(result.partTypes).toContain('fuel filter');
      // Expanded terms should include other synonyms but not the one already in the query
      expect(result.expandedTerms).toContain('fuel element');
    });

    it('should detect attributes', () => {
      const result = QueryUnderstandingAgent.regexFallback('OEM front hydraulic pump');
      expect(result.attributes).toContain('oem');
      expect(result.attributes).toContain('front');
    });

    it('should detect urgency', () => {
      const urgentResult = QueryUnderstandingAgent.regexFallback('I need a belt URGENT machine down');
      expect(urgentResult.urgent).toBe(true);

      const normalResult = QueryUnderstandingAgent.regexFallback('I need a belt');
      expect(normalResult.urgent).toBe(false);
    });

    it('should detect compatibility_check intent', () => {
      const result = QueryUnderstandingAgent.regexFallback('Will this fit my 310G loader?');
      expect(result.intent).toBe('compatibility_check');
    });

    it('should detect alternatives intent', () => {
      // Use a query without a recognized part type, so alternatives keywords take precedence
      const result = QueryUnderstandingAgent.regexFallback('What is an alternative to this component?');
      expect(result.intent).toBe('alternatives');
    });

    it('should detect general_question intent for vague queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('How do I maintain my excavator?');
      expect(result.intent).toBe('general_question');
    });

    it('should set shouldSearchWeb for price-related queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('What is the price of AT-123456?');
      expect(result.shouldSearchWeb).toBe(true);
    });

    it('should set shouldSearchWeb for supplier queries', () => {
      const result = QueryUnderstandingAgent.regexFallback('Where to find a dealer for this part?');
      expect(result.shouldSearchWeb).toBe(true);
    });

    it('should set shouldSearchWeb when only part number detected (might not be in DB)', () => {
      const result = QueryUnderstandingAgent.regexFallback('RE54321');
      expect(result.shouldSearchWeb).toBe(true);
      expect(result.partNumbers).toContain('RE54321');
    });

    it('should preserve the original query', () => {
      const query = 'I need a fuel filter for my 310G';
      const result = QueryUnderstandingAgent.regexFallback(query);
      expect(result.originalQuery).toBe(query);
    });

    it('should handle empty query gracefully', () => {
      const result = QueryUnderstandingAgent.regexFallback('');
      expect(result.intent).toBe('general_question');
      expect(result.partNumbers).toEqual([]);
      expect(result.partTypes).toEqual([]);
      expect(result.expandedTerms).toEqual([]);
    });

    it('should build processedQuery from detected part numbers', () => {
      const result = QueryUnderstandingAgent.regexFallback('I need AT-123456 fuel filter');
      expect(result.processedQuery).toContain('AT-123456');
      expect(result.processedQuery).toContain('fuel filter');
    });

    it('should deduplicate part numbers', () => {
      const result = QueryUnderstandingAgent.regexFallback('AT-123456 vs AT-123456');
      const uniquePartNumbers = [...new Set(result.partNumbers)];
      expect(result.partNumbers.length).toBe(uniquePartNumbers.length);
    });

    it('should deduplicate expanded terms', () => {
      // "oil filter" and "filter" both expand; should not have duplicates
      const result = QueryUnderstandingAgent.regexFallback('oil filter');
      const uniqueTerms = [...new Set(result.expandedTerms)];
      expect(result.expandedTerms.length).toBe(uniqueTerms.length);
    });
  });

  describe('analyze (with LLM timeout/fallback)', () => {
    it('should fall back to regex when no LLM client provided', async () => {
      const result = await QueryUnderstandingAgent.analyze('fuel filter', undefined, null);
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
    });

    it('should fall back to regex when LLM times out', async () => {
      // Create a mock LLM client that takes too long
      const slowLlmClient = {
        generateStructuredOutput: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 5000))
        ),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'fuel filter',
        undefined,
        slowLlmClient,
        100 // 100ms timeout — LLM will not respond in time
      );

      // Should still get regex fallback results
      expect(result.partTypes).toContain('fuel filter');
      expect(result.intent).toBe('part_description');
    });

    it('should fall back to regex when LLM throws', async () => {
      const failingLlmClient = {
        generateStructuredOutput: vi.fn().mockRejectedValue(new Error('LLM error')),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'fuel filter',
        undefined,
        failingLlmClient
      );

      expect(result.partTypes).toContain('fuel filter');
    });

    it('should use LLM results when available', async () => {
      const mockLlmClient = {
        generateStructuredOutput: vi.fn().mockResolvedValue({
          partTypes: ['hydraulic pump'],
          partNumbers: [],
          attributes: ['high pressure'],
          urgent: false,
          intent: 'part_description',
          processedQuery: 'hydraulic pump high pressure',
          expandedTerms: ['hyd pump', 'hydraulic motor'],
          shouldSearchWeb: false,
        }),
      } as any;

      const result = await QueryUnderstandingAgent.analyze(
        'I need a high pressure hydraulic pump',
        undefined,
        mockLlmClient
      );

      expect(result.partTypes).toContain('hydraulic pump');
      expect(result.expandedTerms).toContain('hyd pump');
      expect(result.intent).toBe('part_description');
    });
  });
});
