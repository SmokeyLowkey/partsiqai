/**
 * READ-ONLY audit script: check whether the platform-credentials integration
 * tests ran against and damaged production data.
 *
 * Run with: npx tsx scripts/audit-test-pollution.ts
 */
import { prisma } from '../lib/prisma';

const SYSTEM_ORG_ID = 'system-platform-credentials';

// All test IDs across the three integration test files that hit a real DB.
// platform-credentials.test.ts + ingestion-credentials.test.ts + mistral-ocr-credentials.test.ts.
const TEST_IDS = {
  orgs: [
    // platform-credentials.test.ts
    'test-org-platform-keys',
    'test-org-byok',
    // ingestion-credentials.test.ts
    'test-org-ingestion-platform',
    'test-org-ingestion-byok',
    'test-org-ingestion-custom-host',
    // mistral-ocr-credentials.test.ts
    'test-org-mistral-platform',
    'test-org-mistral-byok',
    'test-org-mistral-no-credentials',
    'test-org-mistral-parser-no-creds',
  ],
  users: [
    // platform-credentials.test.ts
    'test-master-admin-123',
    'test-user-123',
    // ingestion-credentials.test.ts
    'test-ingestion-master-admin',
    'test-ingestion-user',
    // mistral-ocr-credentials.test.ts
    'test-mistral-master-admin',
    'test-mistral-user',
  ],
};

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':****@');
  console.log(`\nConnected to: ${dbUrl}\n`);
  console.log('='.repeat(80));

  // 1. SYSTEM organization state
  console.log('\n[1] SYSTEM organization (id=system-platform-credentials):');
  const systemOrg = await prisma.organization.findUnique({
    where: { id: SYSTEM_ORG_ID },
    select: {
      id: true,
      slug: true,
      name: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      usePlatformKeys: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log(systemOrg ?? 'NOT FOUND');

  // 2. Platform credentials under SYSTEM org
  console.log('\n[2] IntegrationCredential rows under SYSTEM org:');
  const systemCreds = await prisma.integrationCredential.findMany({
    where: { organizationId: SYSTEM_ORG_ID },
    select: {
      id: true,
      integrationType: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      // credentials column excluded (encrypted, large, not needed for audit)
    },
    orderBy: { integrationType: 'asc' },
  });
  if (systemCreds.length === 0) {
    console.log('NONE. Platform credentials were likely DELETED by the test cleanup.');
  } else {
    console.table(systemCreds);
  }

  // 3. Test organizations that should have been cleaned up
  console.log('\n[3] Test organizations (should be absent):');
  const testOrgs = await prisma.organization.findMany({
    where: { id: { in: TEST_IDS.orgs } },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  if (testOrgs.length === 0) {
    console.log('None present (expected — test afterAll cleaned up).');
  } else {
    console.log('PRESENT (test afterAll may have failed):');
    console.table(testOrgs);
  }

  // 4. Test users
  console.log('\n[4] Test users (should be absent):');
  const testUsers = await prisma.user.findMany({
    where: { id: { in: TEST_IDS.users } },
    select: { id: true, email: true, role: true, organizationId: true, createdAt: true },
  });
  if (testUsers.length === 0) {
    console.log('None present (expected).');
  } else {
    console.log('PRESENT:');
    console.table(testUsers);
  }

  // 5. Overall sanity counts
  console.log('\n[5] Overall DB sanity counts:');
  const [orgCount, userCount, credCount, vehicleCount, quoteCount, orderCount] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.integrationCredential.count(),
    prisma.vehicle.count(),
    prisma.quoteRequest.count(),
    prisma.order.count(),
  ]);
  console.table({ organizations: orgCount, users: userCount, integrationCredentials: credCount, vehicles: vehicleCount, quoteRequests: quoteCount, orders: orderCount });

  // 6. List all orgs present to confirm no test-prefixed orgs slipped through
  console.log('\n[6] All organizations present:');
  const allOrgs = await prisma.organization.findMany({
    select: { id: true, slug: true, name: true, subscriptionStatus: true, usePlatformKeys: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.table(allOrgs);

  // 7. Recently updated IntegrationCredential rows (any org) — did the test touch others?
  console.log('\n[7] Recently touched IntegrationCredential rows (last 2 hours, any org):');
  const recent = await prisma.integrationCredential.findMany({
    where: { updatedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: {
      id: true,
      organizationId: true,
      integrationType: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });
  if (recent.length === 0) {
    console.log('None.');
  } else {
    console.table(recent);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Audit complete. This script performed SELECTs only — no writes.');
}

main()
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
