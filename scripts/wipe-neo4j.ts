/**
 * One-time wipe of all Neo4j data in preparation for the hub-node tenant
 * isolation refactor.
 *
 * WHY: Until now, Neo4j Part/Manufacturer/Model/etc. nodes were MERGE'd by
 * natural keys (part_number, name) with no organizationId — two tenants
 * uploading the same part_number would clobber each other's metadata, and
 * queries returned cross-tenant results. The fix introduces per-org
 * Organization hub nodes and attaches every data node via [:OWNS]. Existing
 * nodes have no hub relationship and would become orphans under the new
 * schema, so we wipe.
 *
 * Run against dev first, then prod, BEFORE deploying the ingester + searcher
 * changes. After the deploy, tenants must re-ingest. (For trial orgs this
 * now happens automatically on re-subscribe via Tier 5.)
 *
 * Usage:
 *   pnpm tsx scripts/wipe-neo4j.ts --confirm <NEO4J_URI>
 *
 * Refuses to run without --confirm. Reads credentials from env by default;
 * pass an explicit URI as the last arg to override (useful for running
 * against a specific tenant's Neo4j if we ever move away from shared).
 */

import 'dotenv/config';
import neo4j from 'neo4j-driver';

const CONFIRM_FLAG = '--confirm';
const UNIQUE_CONSTRAINT = `
  CREATE CONSTRAINT organization_id IF NOT EXISTS
  FOR (o:Organization) REQUIRE o.id IS UNIQUE
`;

async function main() {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  if (!confirmed) {
    console.error('Refusing to wipe without --confirm. Usage: pnpm tsx scripts/wipe-neo4j.ts --confirm');
    process.exit(2);
  }

  const uriOverride = process.argv.find((a, i) => i > 1 && a !== CONFIRM_FLAG && !a.startsWith('-'));
  const uri = uriOverride || process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER || process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    console.error('Missing NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD in env');
    process.exit(1);
  }

  console.log(`Connecting to ${uri}…`);
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  try {
    const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

    try {
      // Count first so the operator sees what's about to disappear.
      const countResult = await session.run('MATCH (n) RETURN count(n) AS total');
      const total = countResult.records[0].get('total').toNumber();
      console.log(`Found ${total} nodes. Deleting in batches of 10k to avoid tx size limits…`);

      // Batched delete so we don't blow the transaction log on large graphs.
      // CALL { ... } IN TRANSACTIONS is the recommended pattern in Neo4j 5+.
      await session.run(
        `
        MATCH (n)
        CALL {
          WITH n
          DETACH DELETE n
        } IN TRANSACTIONS OF 10000 ROWS
        `
      );

      console.log('Wipe complete. Creating tenant-hub constraint…');
      await session.run(UNIQUE_CONSTRAINT);
      console.log('Constraint organization_id in place.');

      const verify = await session.run('MATCH (n) RETURN count(n) AS total');
      const remaining = verify.records[0].get('total').toNumber();
      console.log(`Verification: ${remaining} nodes remain (expected 0).`);
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Wipe failed:', err);
  process.exit(1);
});
