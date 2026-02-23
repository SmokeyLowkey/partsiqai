import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mock fns (must use vi.hoisted to avoid TDZ) ----

const {
  mockPineconeSearch,
  mockNeo4jSearch,
  mockWebSearch,
  mockLlmStructuredOutput,
} = vi.hoisted(() => ({
  mockPineconeSearch: vi.fn().mockResolvedValue([]),
  mockNeo4jSearch: vi.fn().mockResolvedValue([]),
  mockWebSearch: vi.fn().mockResolvedValue([]),
  mockLlmStructuredOutput: vi.fn().mockResolvedValue({
    rerankedResults: [],
    suggestedFilters: [],
    relatedQueries: [],
  }),
}));

// ---- Module mocks ----

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findUnique: vi.fn() },
    vehicleSearchMapping: { findUnique: vi.fn() },
    part: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/cache/search-cache', () => ({
  getCachedSearch: vi.fn().mockResolvedValue(null),
  setCachedSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../pinecone-client', () => ({
  PineconeSearchAgent: {
    fromOrganization: vi.fn().mockResolvedValue({
      hybridSearch: mockPineconeSearch,
    }),
  },
}));

vi.mock('../neo4j-client', () => ({
  Neo4jSearchAgent: {
    fromOrganization: vi.fn().mockResolvedValue({
      graphSearch: mockNeo4jSearch,
      close: vi.fn(),
    }),
  },
}));

vi.mock('../web-search-agent', () => ({
  WebSearchAgent: {
    fromOrganization: vi.fn().mockResolvedValue({
      search: mockWebSearch,
      searchDiagnostic: vi.fn().mockResolvedValue([]),
    }),
  },
}));

// Default: no LLM client — forces regex fallback in QueryUnderstanding
// and skips SmartReranker. Tests that need LLM can override per-test.
vi.mock('../../llm/openrouter-client', () => ({
  OpenRouterClient: {
    fromOrganization: vi.fn().mockResolvedValue(null),
  },
}));

// ---- Imports (after mocks) ----

import { MultiAgentOrchestrator } from '../multi-agent-orchestrator';
import type { PartResult, VehicleContext } from '../postgres-search';
import { prisma } from '@/lib/prisma';
import { getCachedSearch, setCachedSearch } from '@/lib/cache/search-cache';

// ---- Factories ----

const makePartResult = (
  partNumber: string,
  description: string,
  score: number,
  source: 'postgres' | 'pinecone' | 'neo4j' | 'web' = 'postgres',
  opts: Partial<PartResult> = {}
): PartResult => ({
  partNumber,
  description,
  score,
  source,
  ...opts,
});

const ORG_ID = 'org_test';
const VEHICLE_CTX: VehicleContext = { make: 'John Deere', model: '310SL', year: 2020, vehicleId: 'v_1' };

// ---- Tests ----

describe('Search Pipeline Integration', () => {
  beforeEach(() => {
    // Reset hoisted mock call counts and set defaults
    mockPineconeSearch.mockClear().mockResolvedValue([]);
    mockNeo4jSearch.mockClear().mockResolvedValue([]);
    mockWebSearch.mockClear().mockResolvedValue([]);
    mockLlmStructuredOutput.mockClear();

    // Reset prisma mocks (these are set in vi.mock factory, safe to mockClear + re-set)
    (prisma.vehicle.findUnique as any).mockClear();
    (prisma.vehicleSearchMapping as any).findUnique.mockClear();
    (prisma.$queryRaw as any).mockClear();
    (prisma.part.findMany as any).mockClear();
    (getCachedSearch as any).mockClear();
    (setCachedSearch as any).mockClear();

    // Default: vehicle is SEARCH_READY
    (prisma.vehicle.findUnique as any).mockResolvedValue({
      searchConfigStatus: 'SEARCH_READY',
      make: 'John Deere',
      model: '310SL',
      year: 2020,
    });

    // Default: Postgres returns empty (real PostgresSearchAgent calls prisma.$queryRaw + part.findMany)
    (prisma.$queryRaw as any).mockResolvedValue([]);
    (prisma.part.findMany as any).mockResolvedValue([]);
    (prisma.vehicleSearchMapping as any).findUnique.mockResolvedValue(null);

    // Default: no cache
    (getCachedSearch as any).mockResolvedValue(null);
  });

  // ============================================================
  // Single-part flow
  // ============================================================

  describe('Single-part query flow', () => {
    it('should return formatted results for a simple part type query', async () => {
      // Pinecone returns 2 results, Postgres returns 1 overlapping
      (prisma.part.findMany as any).mockResolvedValue([
        { id: 'p1', partNumber: 'AT-123456', description: 'Fuel Filter Element', score: 80, category: 'Filters', isActive: true, stockQuantity: 5, price: 29.99 },
      ]);
      mockPineconeSearch.mockResolvedValue([
        makePartResult('AT-123456', 'Fuel Filter Element', 85, 'pinecone'),
        makePartResult('RE-654321', 'Fuel Water Separator', 70, 'pinecone'),
      ]);
      mockNeo4jSearch.mockResolvedValue([
        makePartResult('AT-123456', 'Fuel Filter Element', 75, 'neo4j'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.searchWithFormatting('fuel filter', ORG_ID, VEHICLE_CTX);

      // Should have parts in formatted response
      expect(result.parts).toBeDefined();
      expect(result.messageText).toBeTruthy();
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.sourcesUsed).toContain('postgres');
    });

    it('should produce multi-source confidence bonus when found by multiple agents', async () => {
      const sharedPart = makePartResult('AT-123456', 'Fuel Filter', 70, 'postgres');
      (prisma.part.findMany as any).mockResolvedValue([
        { id: 'p1', partNumber: 'AT-123456', description: 'Fuel Filter', isActive: true, stockQuantity: 3, price: 25 },
      ]);
      mockPineconeSearch.mockResolvedValue([
        makePartResult('AT-123456', 'Fuel Filter', 75, 'pinecone'),
      ]);
      mockNeo4jSearch.mockResolvedValue([
        makePartResult('AT-123456', 'Fuel Filter', 65, 'neo4j'),
      ]);

      // LLM is null by default → no reranker, raw confidence scores used
      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX);

      // Found by 3 sources: base score 75 (max) + 30 (3 * 10) = 100 (capped)
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      const topResult = result.results.find(r => r.partNumber === 'AT-123456');
      expect(topResult).toBeDefined();
      expect(topResult!.foundBy).toContain('postgres');
      expect(topResult!.foundBy).toContain('pinecone');
      expect(topResult!.foundBy).toContain('neo4j');
      expect(topResult!.confidence).toBe(100); // 75 + 30 = 105, capped at 100
    });

    it('should trigger web search when internal results are fewer than 3', async () => {
      // Only 1 internal result
      mockPineconeSearch.mockResolvedValue([
        makePartResult('AT-111111', 'Hydraulic Pump', 80, 'pinecone'),
      ]);
      mockWebSearch.mockResolvedValue([
        makePartResult('WEB-001', 'Hydraulic Pump Assembly', 60, 'web'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('hydraulic pump', ORG_ID, VEHICLE_CTX);

      expect(mockWebSearch).toHaveBeenCalled();
      expect(result.searchMetadata.sourcesUsed).toContain('web');
    });

    it('should NOT trigger web search when internal results are >= 3', async () => {
      mockPineconeSearch.mockResolvedValue([
        makePartResult('P1', 'Part 1', 90, 'pinecone'),
        makePartResult('P2', 'Part 2', 85, 'pinecone'),
        makePartResult('P3', 'Part 3', 80, 'pinecone'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX);

      expect(mockWebSearch).not.toHaveBeenCalled();
      expect(result.searchMetadata.sourcesUsed).not.toContain('web');
    });

    it('should handle all agents failing gracefully', async () => {
      (prisma.$queryRaw as any).mockRejectedValue(new Error('DB down'));
      (prisma.part.findMany as any).mockRejectedValue(new Error('DB down'));
      mockPineconeSearch.mockRejectedValue(new Error('Pinecone timeout'));
      mockNeo4jSearch.mockRejectedValue(new Error('Neo4j connection refused'));

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX);

      // Should return empty results, not throw
      expect(result.results).toHaveLength(0);
      expect(result.searchMetadata.totalResults).toBe(0);
    });

    it('should return spelling correction metadata when misspelled query is used', async () => {
      // "fule filter" → "fuel filter" via regex fallback
      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fule filter', ORG_ID, VEHICLE_CTX);

      expect(result.searchMetadata.spellingCorrection).toBeDefined();
      expect(result.searchMetadata.spellingCorrection?.original).toBe('fule filter');
      expect(result.searchMetadata.spellingCorrection?.corrected).toBe('fuel filter');
    });
  });

  // ============================================================
  // Multi-part flow
  // ============================================================

  describe('Multi-part query flow', () => {
    it('should detect multiple part types and produce part groups', async () => {
      // "fuel filter and oil filter" detects fuel filter, oil filter, and filter (3 types)
      let callCount = 0;
      mockPineconeSearch.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) {
          return [makePartResult('FF-001', 'Fuel Filter', 80, 'pinecone')];
        }
        return [makePartResult('OF-001', 'Oil Filter', 75, 'pinecone')];
      });

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter and oil filter', ORG_ID, VEHICLE_CTX);

      expect(result.searchMetadata.isMultiPartQuery).toBe(true);
      expect(result.searchMetadata.partCount).toBeGreaterThanOrEqual(2);
      expect(result.partGroups).toBeDefined();
      expect(result.partGroups!.length).toBeGreaterThanOrEqual(2);
    });

    it('should deduplicate parts that appear in multiple groups', async () => {
      // Same part appears in both group searches
      mockPineconeSearch.mockResolvedValue([
        makePartResult('SHARED-001', 'Universal Filter', 80, 'pinecone'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter and oil filter', ORG_ID, VEHICLE_CTX);

      // Flat results should only have one SHARED-001
      const sharedParts = result.results.filter(r => r.partNumber === 'SHARED-001');
      expect(sharedParts.length).toBeLessThanOrEqual(1);
    });

    it('should handle one group failing while others succeed', async () => {
      let callCount = 0;
      mockPineconeSearch.mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) {
          return [makePartResult('FF-001', 'Fuel Filter', 80, 'pinecone')];
        }
        throw new Error('Search failed for second group');
      });

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter and oil filter', ORG_ID, VEHICLE_CTX);

      // Should still have groups (some successful, some empty/failed)
      expect(result.partGroups).toBeDefined();
      expect(result.partGroups!.length).toBeGreaterThanOrEqual(2);
      // At least one group has results
      const groupsWithResults = result.partGroups!.filter(g => g.results.length > 0);
      expect(groupsWithResults.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // Exact part number
  // ============================================================

  describe('Exact part number query flow', () => {
    it('should detect exact part numbers and pass them through the pipeline', async () => {
      mockPineconeSearch.mockResolvedValue([
        makePartResult('AT-1234567', 'Exact Part', 95, 'pinecone'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('AT-1234567', ORG_ID, VEHICLE_CTX);

      expect(result.searchMetadata.queryIntent).toBe('exact_part_number');
    });
  });

  // ============================================================
  // Cache behavior
  // ============================================================

  describe('Cache behavior', () => {
    it('should return cached results when getCachedSearch returns data', async () => {
      const cachedData = {
        messageText: 'Cached result',
        parts: [],
        summary: { totalFound: 0 },
        recommendations: [],
        filters: [],
        relatedSearches: [],
        metadata: { totalResults: 0, searchTime: 50, sourcesUsed: ['postgres'] },
      };
      (getCachedSearch as any).mockResolvedValue(cachedData);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.searchWithFormatting('fuel filter', ORG_ID, VEHICLE_CTX);

      expect(result.messageText).toBe('Cached result');
      expect(result.metadata.cacheHit).toBe(true);
      // Should not have called any search agents
      expect(mockPineconeSearch).not.toHaveBeenCalled();
    });

    it('should call setCachedSearch after a fresh search', async () => {
      const orchestrator = new MultiAgentOrchestrator();
      await orchestrator.searchWithFormatting('fuel filter', ORG_ID, VEHICLE_CTX);

      expect(setCachedSearch).toHaveBeenCalled();
    });

    it('should skip cache for webSearchOnly mode', async () => {
      mockWebSearch.mockResolvedValue([
        makePartResult('WEB-001', 'Web Part', 70, 'web'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      await orchestrator.searchWithFormatting('fuel filter', ORG_ID, VEHICLE_CTX, { webSearchOnly: true });

      expect(getCachedSearch).not.toHaveBeenCalled();
      expect(setCachedSearch).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Vehicle context
  // ============================================================

  describe('Vehicle context', () => {
    it('should return empty results when vehicle is not SEARCH_READY', async () => {
      (prisma.vehicle.findUnique as any).mockResolvedValue({
        searchConfigStatus: 'PENDING',
      });

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX);

      expect(result.results).toHaveLength(0);
      expect(result.searchMetadata.totalResults).toBe(0);
      // Search agents should not have been called
      expect(mockPineconeSearch).not.toHaveBeenCalled();
    });

    it('should proceed with search when vehicle is SEARCH_READY', async () => {
      (prisma.part.findMany as any).mockResolvedValue([
        { id: 'p1', partNumber: 'P1', description: 'Part 1', score: 80, isActive: true, stockQuantity: 3, price: 25 },
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX);

      // Should have searched (not returned empty for non-SEARCH_READY)
      expect(result.searchMetadata.sourcesUsed).toContain('postgres');
      expect(result.searchMetadata.searchTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Web-search-only mode
  // ============================================================

  describe('Web-search-only mode', () => {
    it('should skip internal searches and go straight to web', async () => {
      mockWebSearch.mockResolvedValue([
        makePartResult('WEB-001', 'Web Result', 70, 'web'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX, { webSearchOnly: true });

      // Vehicle check should NOT have been called
      expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
      // Web search was called
      expect(mockWebSearch).toHaveBeenCalled();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].isWebResult).toBe(true);
    });

    it('should return empty results when no web agent is available', async () => {
      const { WebSearchAgent } = await import('../web-search-agent');
      (WebSearchAgent.fromOrganization as any).mockResolvedValue(null);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.search('fuel filter', ORG_ID, VEHICLE_CTX, { webSearchOnly: true });

      expect(result.results).toHaveLength(0);
    });

    it('should add webSearchOnly note to formatted response', async () => {
      mockWebSearch.mockResolvedValue([
        makePartResult('WEB-001', 'Web Result', 70, 'web'),
      ]);

      const orchestrator = new MultiAgentOrchestrator();
      const result = await orchestrator.searchWithFormatting('fuel filter', ORG_ID, VEHICLE_CTX, { webSearchOnly: true });

      expect(result.webSearchOnly).toBe(true);
      expect(result.messageText).toContain('still being configured');
    });
  });
});
