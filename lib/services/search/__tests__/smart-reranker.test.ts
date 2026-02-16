import { describe, it, expect, vi } from 'vitest';
import { SmartReranker } from '../smart-reranker';
import type { EnrichedPartResult } from '../multi-agent-orchestrator';
import type { ProcessedQuery } from '../query-understanding';

describe('SmartReranker', () => {
  const reranker = new SmartReranker();

  const mockProcessedQuery: ProcessedQuery = {
    originalQuery: 'fuel filter',
    intent: 'part_description',
    partNumbers: [],
    partTypes: ['fuel filter'],
    expandedTerms: ['fuel element', 'fuel strainer'],
    attributes: [],
    processedQuery: 'fuel filter',
    urgent: false,
    shouldSearchWeb: false,
  };

  const makeResult = (
    partNumber: string,
    description: string,
    score: number,
    source: 'postgres' | 'pinecone' | 'neo4j' | 'web' = 'postgres',
    isWebResult = false
  ): EnrichedPartResult => ({
    partNumber,
    description,
    score,
    source,
    confidence: score,
    foundBy: [source],
    reason: 'test',
    isWebResult,
  });

  it('should return empty results for empty input', async () => {
    const mockLlm = {} as any;
    const result = await reranker.rerank('test', mockProcessedQuery, [], mockLlm);
    expect(result.results).toEqual([]);
    expect(result.suggestedFilters).toEqual([]);
    expect(result.relatedQueries).toEqual([]);
  });

  it('should re-rank results based on LLM matchConfidence', async () => {
    const results = [
      makeResult('PART-A', 'Fuel Filter for 310G', 80),
      makeResult('PART-B', 'Oil Filter', 90),
      makeResult('PART-C', 'Fuel Element Premium', 70),
    ];

    const mockLlm = {
      generateStructuredOutput: vi.fn().mockResolvedValue({
        rankedResults: [
          { partNumber: 'PART-C', matchConfidence: 95, explanation: 'Best match - exact fuel element' },
          { partNumber: 'PART-A', matchConfidence: 85, explanation: 'Good match - fuel filter' },
          { partNumber: 'PART-B', matchConfidence: 30, explanation: 'Wrong type - oil not fuel' },
        ],
        suggestedFilters: ['fuel system'],
        relatedQueries: ['fuel element 310G'],
      }),
    } as any;

    const result = await reranker.rerank('fuel filter', mockProcessedQuery, results, mockLlm);

    // PART-C should now be first (highest LLM confidence)
    expect(result.results[0].partNumber).toBe('PART-C');
    expect(result.results[0].confidence).toBe(95);
    expect(result.results[0].reason).toBe('Best match - exact fuel element');

    // PART-A should be second
    expect(result.results[1].partNumber).toBe('PART-A');
    expect(result.results[1].confidence).toBe(85);

    // PART-B should be third (above the 20 threshold)
    expect(result.results[2].partNumber).toBe('PART-B');

    expect(result.suggestedFilters).toContain('fuel system');
    expect(result.relatedQueries).toContain('fuel element 310G');
  });

  it('should filter out results below confidence threshold of 20', async () => {
    const results = [
      makeResult('PART-A', 'Fuel Filter', 80),
      makeResult('PART-B', 'Completely Unrelated Widget', 40),
    ];

    const mockLlm = {
      generateStructuredOutput: vi.fn().mockResolvedValue({
        rankedResults: [
          { partNumber: 'PART-A', matchConfidence: 90, explanation: 'Great match' },
          { partNumber: 'PART-B', matchConfidence: 10, explanation: 'Irrelevant' },
        ],
        suggestedFilters: [],
        relatedQueries: [],
      }),
    } as any;

    const result = await reranker.rerank('fuel filter', mockProcessedQuery, results, mockLlm);

    // PART-B should be filtered out (confidence 10 < threshold 20)
    expect(result.results.length).toBe(1);
    expect(result.results[0].partNumber).toBe('PART-A');
  });

  it('should separate web results and generate webEnrichment', async () => {
    const results = [
      makeResult('PART-A', 'Fuel Filter Internal', 80, 'postgres'),
      makeResult('WEB-1', 'Fuel Filter from Web', 50, 'web', true),
    ];

    const mockLlm = {
      generateStructuredOutput: vi.fn().mockResolvedValue({
        rankedResults: [
          { partNumber: 'PART-A', matchConfidence: 90, explanation: 'Internal match' },
          { partNumber: 'WEB-1', matchConfidence: 60, explanation: 'Web source match' },
        ],
        suggestedFilters: [],
        relatedQueries: [],
      }),
    } as any;

    const result = await reranker.rerank('fuel filter', mockProcessedQuery, results, mockLlm);

    const webResults = result.results.filter(r => r.isWebResult);
    expect(webResults.length).toBe(1);
    expect(result.webEnrichment).toContain('1 result');
    expect(result.webEnrichment).toContain('unverified');
  });

  it('should fall back to original order when LLM fails', async () => {
    const results = [
      makeResult('PART-A', 'First', 80),
      makeResult('PART-B', 'Second', 70),
    ];

    const failingLlm = {
      generateStructuredOutput: vi.fn().mockRejectedValue(new Error('LLM error')),
    } as any;

    const result = await reranker.rerank('test', mockProcessedQuery, results, failingLlm);

    // Should return original results unchanged
    expect(result.results.length).toBe(2);
    expect(result.results[0].partNumber).toBe('PART-A');
    expect(result.results[1].partNumber).toBe('PART-B');
    expect(result.suggestedFilters).toEqual([]);
    expect(result.relatedQueries).toEqual([]);
  });

  it('should preserve results beyond top 30 that were not sent to LLM', async () => {
    // Create 35 results
    const results: EnrichedPartResult[] = [];
    for (let i = 0; i < 35; i++) {
      results.push(makeResult(`PART-${i}`, `Part ${i}`, 80 - i));
    }

    const mockLlm = {
      generateStructuredOutput: vi.fn().mockResolvedValue({
        rankedResults: results.slice(0, 30).map((r, i) => ({
          partNumber: r.partNumber,
          matchConfidence: 90 - i,
          explanation: `Ranked ${i}`,
        })),
        suggestedFilters: [],
        relatedQueries: [],
      }),
    } as any;

    const result = await reranker.rerank('test', mockProcessedQuery, results, mockLlm);

    // Should include all 30 LLM-ranked results plus the 5 that weren't sent to LLM
    expect(result.results.length).toBe(35);

    // Results 30-34 should be appended at the end with original confidence
    const lastFive = result.results.slice(30);
    expect(lastFive.map(r => r.partNumber)).toEqual(['PART-30', 'PART-31', 'PART-32', 'PART-33', 'PART-34']);
  });
});
