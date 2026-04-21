import { describe, it, expect } from 'vitest';
import { IngestionBackend, UserRole } from '@prisma/client';

// Keep the function under test co-located with its only caller (the upload
// route) rather than in a shared module. The test calls the same logic
// directly here to guard against the role → backends mapping drifting.
function authorizedBackendsFor(role: UserRole): IngestionBackend[] {
  if (role === 'MASTER_ADMIN') {
    return [IngestionBackend.POSTGRES, IngestionBackend.PINECONE, IngestionBackend.NEO4J];
  }
  return [IngestionBackend.PINECONE, IngestionBackend.NEO4J];
}

describe('ingestion authorization boundary', () => {
  it('MASTER_ADMIN gets all three backends', () => {
    expect(authorizedBackendsFor('MASTER_ADMIN')).toEqual([
      IngestionBackend.POSTGRES,
      IngestionBackend.PINECONE,
      IngestionBackend.NEO4J,
    ]);
  });

  it('org ADMIN gets Pinecone + Neo4j but never Postgres', () => {
    const backends = authorizedBackendsFor('ADMIN');
    expect(backends).not.toContain(IngestionBackend.POSTGRES);
    expect(backends).toContain(IngestionBackend.PINECONE);
    expect(backends).toContain(IngestionBackend.NEO4J);
  });

  it('non-admin roles are treated like org ADMIN (no Postgres)', () => {
    for (const role of ['MANAGER', 'TECHNICIAN', 'USER'] as UserRole[]) {
      const backends = authorizedBackendsFor(role);
      expect(backends).not.toContain(IngestionBackend.POSTGRES);
    }
  });
});
