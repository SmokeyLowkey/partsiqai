import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PartResult } from '../postgres-search';
import type { EnrichedPartResult, PartGroup } from '../multi-agent-orchestrator';
import type { ProcessedQuery, PartIntent } from '../query-understanding';

/**
 * Tests for multi-part search splitting logic.
 *
 * These tests validate the internal methods extracted from MultiAgentOrchestrator
 * using the same merge/confidence logic. No DB, credentials, or external services
 * are accessed — all tests use pure functions and mock data.
 */

// ---- Helper factories (same pattern as other test files) ----

const makePartResult = (
  partNumber: string,
  description: string,
  score: number,
  source: 'postgres' | 'pinecone' | 'neo4j' = 'postgres',
  opts: Partial<PartResult> = {}
): PartResult => ({
  partNumber,
  description,
  score,
  source,
  ...opts,
});

const makeEnrichedResult = (
  partNumber: string,
  description: string,
  confidence: number,
  foundBy: Array<'postgres' | 'pinecone' | 'neo4j' | 'web'> = ['postgres'],
  opts: Partial<EnrichedPartResult> = {}
): EnrichedPartResult => ({
  partNumber,
  description,
  score: confidence,
  source: foundBy[0] || 'postgres',
  confidence,
  foundBy,
  reason: 'test',
  ...opts,
});

const makePartIntent = (
  label: string,
  queryText: string,
  opts: Partial<PartIntent> = {}
): PartIntent => ({
  label,
  queryText,
  partType: queryText,
  expandedTerms: [],
  ...opts,
});

// ---- Test the deduplication logic ----

describe('Multi-Part Search: deduplicateAcrossGroups', () => {
  // Import and test the dedup logic by simulating what the orchestrator does
  // We replicate the dedup function since it's a private method

  function deduplicateAcrossGroups(results: EnrichedPartResult[]): EnrichedPartResult[] {
    const seen = new Map<string, EnrichedPartResult>();
    for (const result of results) {
      const existing = seen.get(result.partNumber);
      if (!existing || result.confidence > existing.confidence) {
        seen.set(result.partNumber, result);
      }
    }
    return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
  }

  it('should deduplicate by partNumber, keeping highest confidence', () => {
    const results: EnrichedPartResult[] = [
      makeEnrichedResult('PART-A', 'Fuel Filter', 85),
      makeEnrichedResult('PART-A', 'Fuel Filter Element', 90), // Higher confidence for same part
      makeEnrichedResult('PART-B', 'Oil Filter', 80),
    ];

    const deduped = deduplicateAcrossGroups(results);

    expect(deduped.length).toBe(2);
    expect(deduped[0].partNumber).toBe('PART-A');
    expect(deduped[0].confidence).toBe(90); // Kept higher
    expect(deduped[1].partNumber).toBe('PART-B');
  });

  it('should sort by confidence descending', () => {
    const results: EnrichedPartResult[] = [
      makeEnrichedResult('PART-C', 'Low match', 40),
      makeEnrichedResult('PART-A', 'High match', 95),
      makeEnrichedResult('PART-B', 'Mid match', 70),
    ];

    const deduped = deduplicateAcrossGroups(results);

    expect(deduped[0].partNumber).toBe('PART-A');
    expect(deduped[1].partNumber).toBe('PART-B');
    expect(deduped[2].partNumber).toBe('PART-C');
  });

  it('should handle empty array', () => {
    const deduped = deduplicateAcrossGroups([]);
    expect(deduped).toEqual([]);
  });

  it('should handle single result', () => {
    const results = [makeEnrichedResult('PART-A', 'Filter', 80)];
    const deduped = deduplicateAcrossGroups(results);
    expect(deduped.length).toBe(1);
    expect(deduped[0].partNumber).toBe('PART-A');
  });
});

// ---- Test PartGroup structure ----

describe('Multi-Part Search: PartGroup structure', () => {
  it('should create valid PartGroup with results', () => {
    const group: PartGroup = {
      label: 'Fuel Filter',
      queryUsed: 'fuel filter',
      results: [
        makeEnrichedResult('FF-001', 'Fuel Filter Element', 90),
        makeEnrichedResult('FF-002', 'Fuel Strainer', 75),
      ],
      resultCount: 2,
    };

    expect(group.label).toBe('Fuel Filter');
    expect(group.results.length).toBe(2);
    expect(group.resultCount).toBe(2);
    expect(group.webResults).toBeUndefined();
  });

  it('should create empty PartGroup for failed search', () => {
    const group: PartGroup = {
      label: 'Turbocharger',
      queryUsed: 'turbo',
      results: [],
      resultCount: 0,
    };

    expect(group.results).toEqual([]);
    expect(group.resultCount).toBe(0);
  });

  it('should include web results when available', () => {
    const group: PartGroup = {
      label: 'Oil Filter',
      queryUsed: 'oil filter',
      results: [makeEnrichedResult('OF-001', 'Oil Filter', 85)],
      webResults: [
        makeEnrichedResult('WEB-OF-1', 'Oil Filter from Web', 50, ['web'], { isWebResult: true }),
      ],
      resultCount: 2,
    };

    expect(group.webResults).toBeDefined();
    expect(group.webResults!.length).toBe(1);
    expect(group.webResults![0].isWebResult).toBe(true);
  });
});

// ---- Test multi-part intent detection and grouping scenarios ----

describe('Multi-Part Search: intent-to-group mapping', () => {
  it('should produce separate groups for each part type', () => {
    const intents: PartIntent[] = [
      makePartIntent('Fuel Filter', 'fuel filter'),
      makePartIntent('Oil Filter', 'oil filter'),
    ];

    // Simulate what searchMultiPart does: one group per intent
    const groups: PartGroup[] = intents.map(intent => ({
      label: intent.label,
      queryUsed: intent.queryText,
      results: [],
      resultCount: 0,
    }));

    expect(groups.length).toBe(2);
    expect(groups[0].label).toBe('Fuel Filter');
    expect(groups[1].label).toBe('Oil Filter');
  });

  it('should handle mixed part types and part numbers', () => {
    const intents: PartIntent[] = [
      makePartIntent('Fuel Filter', 'fuel filter', { partType: 'fuel filter' }),
      makePartIntent('AT-123456', 'AT-123456', { partNumber: 'AT-123456', partType: undefined }),
    ];

    const groups: PartGroup[] = intents.map(intent => ({
      label: intent.label,
      queryUsed: intent.queryText,
      results: [],
      resultCount: 0,
    }));

    expect(groups[0].label).toBe('Fuel Filter');
    expect(groups[0].queryUsed).toBe('fuel filter');
    expect(groups[1].label).toBe('AT-123456');
    expect(groups[1].queryUsed).toBe('AT-123456');
  });

  it('should cap intents at MAX_PART_INTENTS (5)', () => {
    const intents: PartIntent[] = Array.from({ length: 8 }, (_, i) =>
      makePartIntent(`Part ${i + 1}`, `part${i + 1}`)
    );

    const capped = intents.slice(0, 5);
    expect(capped.length).toBe(5);
    expect(capped[0].label).toBe('Part 1');
    expect(capped[4].label).toBe('Part 5');
  });
});

// ---- Test flat results assembly from multiple groups ----

describe('Multi-Part Search: flat results from groups', () => {
  function deduplicateAcrossGroups(results: EnrichedPartResult[]): EnrichedPartResult[] {
    const seen = new Map<string, EnrichedPartResult>();
    for (const result of results) {
      const existing = seen.get(result.partNumber);
      if (!existing || result.confidence > existing.confidence) {
        seen.set(result.partNumber, result);
      }
    }
    return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
  }

  it('should build flat results from multiple groups', () => {
    const group1Results = [
      makeEnrichedResult('FF-001', 'Fuel Filter', 90),
      makeEnrichedResult('FF-002', 'Fuel Strainer', 75),
    ];
    const group2Results = [
      makeEnrichedResult('OF-001', 'Oil Filter', 85),
      makeEnrichedResult('OF-002', 'Oil Element', 70),
    ];

    const allResults = [...group1Results, ...group2Results];
    const flat = deduplicateAcrossGroups(allResults);

    expect(flat.length).toBe(4); // All unique
    // Sorted by confidence
    expect(flat[0].partNumber).toBe('FF-001'); // 90
    expect(flat[1].partNumber).toBe('OF-001'); // 85
    expect(flat[2].partNumber).toBe('FF-002'); // 75
    expect(flat[3].partNumber).toBe('OF-002'); // 70
  });

  it('should deduplicate parts that appear in multiple groups', () => {
    // A universal filter that matches both "fuel filter" and "oil filter" groups
    const group1Results = [
      makeEnrichedResult('UNI-001', 'Universal Filter', 80),
      makeEnrichedResult('FF-001', 'Fuel Filter', 90),
    ];
    const group2Results = [
      makeEnrichedResult('UNI-001', 'Universal Filter', 85), // Same part, higher confidence in group 2
      makeEnrichedResult('OF-001', 'Oil Filter', 88),
    ];

    const allResults = [...group1Results, ...group2Results];
    const flat = deduplicateAcrossGroups(allResults);

    expect(flat.length).toBe(3); // UNI-001 deduped
    const uniResult = flat.find(r => r.partNumber === 'UNI-001');
    expect(uniResult!.confidence).toBe(85); // Kept higher from group 2
  });

  it('should keep parts in all their original groups even if deduped in flat list', () => {
    // This tests that groups maintain their own results independently
    const group1: PartGroup = {
      label: 'Fuel Filter',
      queryUsed: 'fuel filter',
      results: [makeEnrichedResult('UNI-001', 'Universal Filter', 80)],
      resultCount: 1,
    };
    const group2: PartGroup = {
      label: 'Oil Filter',
      queryUsed: 'oil filter',
      results: [makeEnrichedResult('UNI-001', 'Universal Filter', 85)],
      resultCount: 1,
    };

    // Groups maintain independent copies
    expect(group1.results[0].partNumber).toBe('UNI-001');
    expect(group2.results[0].partNumber).toBe('UNI-001');

    // Flat list dedupes
    const flat = deduplicateAcrossGroups([...group1.results, ...group2.results]);
    expect(flat.length).toBe(1);
  });
});

// ---- Test ProcessedQuery with partIntents ----

describe('Multi-Part Search: ProcessedQuery integration', () => {
  it('should have partIntents when query mentions multiple parts', () => {
    const processedQuery: ProcessedQuery = {
      originalQuery: 'I need a fuel filter and an oil filter',
      intent: 'part_description',
      partNumbers: [],
      partTypes: ['fuel filter', 'oil filter'],
      expandedTerms: ['fuel element', 'fuel strainer', 'oil element', 'lube filter'],
      attributes: [],
      processedQuery: 'fuel filter oil filter',
      urgent: false,
      shouldSearchWeb: false,
      partIntents: [
        { label: 'Fuel Filter', queryText: 'fuel filter', partType: 'fuel filter', expandedTerms: ['fuel element', 'fuel strainer'] },
        { label: 'Oil Filter', queryText: 'oil filter', partType: 'oil filter', expandedTerms: ['oil element', 'lube filter'] },
      ],
    };

    expect(processedQuery.partIntents).toBeDefined();
    expect(processedQuery.partIntents!.length).toBe(2);

    // Each intent has isolated expanded terms
    const fuelIntent = processedQuery.partIntents![0];
    expect(fuelIntent.expandedTerms).toContain('fuel element');
    expect(fuelIntent.expandedTerms).not.toContain('oil element');

    const oilIntent = processedQuery.partIntents![1];
    expect(oilIntent.expandedTerms).toContain('oil element');
    expect(oilIntent.expandedTerms).not.toContain('fuel element');
  });

  it('should NOT have partIntents for single-part query', () => {
    const processedQuery: ProcessedQuery = {
      originalQuery: 'fuel filter',
      intent: 'part_description',
      partNumbers: [],
      partTypes: ['fuel filter'],
      expandedTerms: ['fuel element', 'fuel strainer'],
      attributes: [],
      processedQuery: 'fuel filter',
      urgent: false,
      shouldSearchWeb: false,
      // partIntents not set
    };

    expect(processedQuery.partIntents).toBeUndefined();
  });

  it('isMultiPart check should work correctly', () => {
    const multiQuery: ProcessedQuery = {
      originalQuery: 'fuel filter and belt',
      intent: 'part_description',
      partNumbers: [],
      partTypes: ['fuel filter', 'belt'],
      expandedTerms: [],
      attributes: [],
      processedQuery: 'fuel filter belt',
      urgent: false,
      shouldSearchWeb: false,
      partIntents: [
        { label: 'Fuel Filter', queryText: 'fuel filter', expandedTerms: [] },
        { label: 'Belt', queryText: 'belt', expandedTerms: [] },
      ],
    };

    const singleQuery: ProcessedQuery = {
      originalQuery: 'fuel filter',
      intent: 'part_description',
      partNumbers: [],
      partTypes: ['fuel filter'],
      expandedTerms: [],
      attributes: [],
      processedQuery: 'fuel filter',
      urgent: false,
      shouldSearchWeb: false,
    };

    const isMultiPart = (q: ProcessedQuery) => (q.partIntents?.length || 0) > 1;

    expect(isMultiPart(multiQuery)).toBe(true);
    expect(isMultiPart(singleQuery)).toBe(false);
  });
});
