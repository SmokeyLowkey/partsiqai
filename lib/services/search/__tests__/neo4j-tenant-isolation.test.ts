/**
 * Regression test for the multi-tenant Neo4j isolation fix.
 *
 * The bug we're guarding against: a Cypher query in neo4j-client.ts that
 * matches `:Part` (or any other data label) without first anchoring to
 * `(:Organization {id: $organizationId})` would return nodes from other
 * tenants' subgraphs. This test mocks the Neo4j driver and asserts that
 * every Cypher query run by graphSearch() includes the hub-node MATCH,
 * and that `organizationId` is passed as a query parameter.
 *
 * We're not verifying query correctness here — just the isolation
 * invariant. Full end-to-end correctness is covered by the search-pipeline
 * integration tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture every Cypher string and params object that session.run sees.
const runCalls: Array<{ cypher: string; params: Record<string, unknown> }> = [];

const mockSession = {
  run: vi.fn(async (cypher: string, params: Record<string, unknown>) => {
    runCalls.push({ cypher, params });
    return { records: [] }; // empty results force every fallback to execute
  }),
  close: vi.fn(async () => {}),
};

const mockDriver = {
  session: vi.fn(() => mockSession),
  close: vi.fn(async () => {}),
};

vi.mock('neo4j-driver', () => ({
  default: {
    driver: vi.fn(() => mockDriver),
    auth: { basic: vi.fn((u: string, p: string) => ({ u, p })) },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicleSearchMapping: {
      findUnique: vi.fn().mockResolvedValue({
        vehicleId: 'veh_a',
        neo4jManufacturer: 'Caterpillar',
        neo4jModelName: 'D6',
        neo4jNamespace: 'cat_d6',
      }),
    },
  },
}));

vi.mock('@/lib/services/credentials/credentials-manager', () => ({
  credentialsManager: {
    getCredentialsWithFallback: vi.fn().mockResolvedValue({
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test',
    }),
  },
}));

// Silence the logger to avoid noise.
vi.mock('@/lib/logger', () => ({
  apiLogger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { Neo4jSearchAgent } from '../neo4j-client';

// Matches the org-hub anchor — either as a standalone MATCH or as part of a
// chain. The key structural property: the query references the Organization
// node by $organizationId before touching any data label.
const ORG_HUB_PATTERN = /MATCH\s*\(\s*org\s*:\s*Organization\s*\{\s*id\s*:\s*\$organizationId\s*\}\s*\)/i;

// Any query that MATCHes a data label must be scoped via the org hub.
// A forgotten scope is a tenant leak.
const DATA_LABELS = /\((\w+)\s*:\s*(Part|Manufacturer|Model|TechnicalDomain|Diagram|Category|SerialNumberRange)\b/;

describe('Neo4j tenant isolation — every graphSearch query is scoped via the org hub', () => {
  beforeEach(() => {
    runCalls.length = 0;
    mockSession.run.mockClear();
  });

  it('non-mapping search: the single Cypher that runs is hub-scoped', async () => {
    // Force the "no mapping" branch by passing no vehicleContext.
    const agent = await Neo4jSearchAgent.fromOrganization('org_alpha');
    await agent.graphSearch('oil filter', 'org_alpha');

    expect(runCalls.length).toBeGreaterThan(0);
    for (const call of runCalls) {
      expect(call.cypher, 'every run must anchor to the org hub').toMatch(ORG_HUB_PATTERN);
      expect(call.params.organizationId, 'every run must pass organizationId as a param').toBe('org_alpha');
    }
  });

  it('vehicle-mapping search + all fallbacks: each Cypher stays hub-scoped', async () => {
    // Results are empty, so graphSearch walks through every fallback branch.
    const agent = await Neo4jSearchAgent.fromOrganization('org_beta');
    await agent.graphSearch('fuel pump', 'org_beta', {
      vehicleId: 'veh_a',
      make: 'Caterpillar',
      model: 'D6',
      year: 2020,
    });

    expect(runCalls.length).toBeGreaterThan(1); // main + at least one fallback
    for (const call of runCalls) {
      // If this query touches any data label, it MUST also anchor to the hub.
      if (DATA_LABELS.test(call.cypher)) {
        expect(call.cypher, 'unscoped data-label MATCH — tenant leak risk').toMatch(ORG_HUB_PATTERN);
        expect(call.params.organizationId).toBe('org_beta');
      }
    }
  });

  it('no query passes organizationId with the leaked _underscore shape', async () => {
    // Belt-and-suspenders: the old (buggy) code had a parameter named
    // `_organizationId` that was unused. If someone accidentally reintroduces
    // the underscore, the param would be dropped from the Cypher params and
    // this test catches it.
    const agent = await Neo4jSearchAgent.fromOrganization('org_gamma');
    await agent.graphSearch('bearing', 'org_gamma');

    for (const call of runCalls) {
      expect(
        Object.keys(call.params),
        'no legacy _organizationId-style key should appear',
      ).not.toContain('_organizationId');
    }
  });
});
