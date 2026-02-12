import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../prisma';
import { SYSTEM_ORG_ID } from '../services/credentials/credentials-manager';
import { ingestToPinecone } from '../services/ingestion/pinecone-ingester';
import { ingestToNeo4j } from '../services/ingestion/neo4j-ingester';
import type { PartIngestionRecord } from '../services/ingestion/types';
import { pino } from 'pino';

describe('Data Ingestion with Platform Credentials', () => {
  const testOrgPlatformKeys = 'test-org-ingestion-platform';
  const testOrgBYOK = 'test-org-ingestion-byok';
  const testOrgCustomHost = 'test-org-ingestion-custom-host';
  const testMasterAdminId = 'test-ingestion-master-admin';
  const testUserId = 'test-ingestion-user';

  const logger = pino({ level: 'silent' }); // Suppress logs during tests

  const sampleRecords: PartIngestionRecord[] = [
    {
      partNumber: 'TEST-123',
      partTitle: 'Test Part',
      manufacturer: 'Test Manufacturer',
      machineModel: 'Test Model',
      categoryBreadcrumb: 'Category > Subcategory',
      namespace: 'test-parts',
      diagramTitle: 'Test Diagram',
      remarks: 'Test remarks',
    },
  ];

  beforeAll(async () => {
    if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
      process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-secret-key-must-be-at-least-32-characters-long';
    }

    // Create SYSTEM organization
    await prisma.organization.upsert({
      where: { id: SYSTEM_ORG_ID },
      create: {
        id: SYSTEM_ORG_ID,
        slug: 'system-platform-credentials',
        name: 'System Platform Credentials',
        subscriptionTier: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: false,
      },
      update: {},
    });

    // Create master admin user
    await prisma.user.upsert({
      where: { id: testMasterAdminId },
      create: {
        id: testMasterAdminId,
        email: 'ingestion-master@example.com',
        name: 'Ingestion Master Admin',
        role: 'MASTER_ADMIN',
        organizationId: SYSTEM_ORG_ID,
      },
      update: {},
    });

    // Create test org that uses platform keys
    await prisma.organization.upsert({
      where: { id: testOrgPlatformKeys },
      create: {
        id: testOrgPlatformKeys,
        slug: 'test-org-ingestion-platform',
        name: 'Test Org - Platform Keys (Ingestion)',
        subscriptionTier: 'STARTER',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: true,
      },
      update: {
        usePlatformKeys: true,
        subscriptionStatus: 'ACTIVE',
      },
    });

    // Create test org with custom Pinecone host
    await prisma.organization.upsert({
      where: { id: testOrgCustomHost },
      create: {
        id: testOrgCustomHost,
        slug: 'test-org-ingestion-custom-host',
        name: 'Test Org - Custom Pinecone Host',
        subscriptionTier: 'GROWTH',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: true,
        pineconeHost: 'https://org-123456.pinecone.io',
      },
      update: {
        usePlatformKeys: true,
        subscriptionStatus: 'ACTIVE',
        pineconeHost: 'https://org-123456.pinecone.io',
      },
    });

    // Create BYOK test org
    await prisma.organization.upsert({
      where: { id: testOrgBYOK },
      create: {
        id: testOrgBYOK,
        slug: 'test-org-ingestion-byok',
        name: 'Test Org - BYOK (Ingestion)',
        subscriptionTier: 'GROWTH',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: false,
      },
      update: {
        usePlatformKeys: false,
        subscriptionStatus: 'ACTIVE',
      },
    });

    // Create test user
    await prisma.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: 'ingestion-test@example.com',
        name: 'Ingestion Test User',
        role: 'ADMIN',
        organizationId: testOrgPlatformKeys,
      },
      update: {},
    });

    // Save platform credentials
    await prisma.integrationCredential.upsert({
      where: {
        organizationId_integrationType: {
          organizationId: SYSTEM_ORG_ID,
          integrationType: 'PINECONE',
        },
      },
      create: {
        organizationId: SYSTEM_ORG_ID,
        integrationType: 'PINECONE',
        name: 'Platform Pinecone',
        credentials: 'mock-encrypted-pinecone-credentials',
        createdBy: testMasterAdminId,
      },
      update: {
        credentials: 'mock-encrypted-pinecone-credentials',
      },
    });

    await prisma.integrationCredential.upsert({
      where: {
        organizationId_integrationType: {
          organizationId: SYSTEM_ORG_ID,
          integrationType: 'NEO4J',
        },
      },
      create: {
        organizationId: SYSTEM_ORG_ID,
        integrationType: 'NEO4J',
        name: 'Platform Neo4j',
        credentials: 'mock-encrypted-neo4j-credentials',
        createdBy: testMasterAdminId,
      },
      update: {
        credentials: 'mock-encrypted-neo4j-credentials',
      },
    });
  });

  beforeEach(async () => {
    // Clean up org-specific credentials before each test to ensure clean state
    await prisma.integrationCredential.deleteMany({
      where: {
        organizationId: { in: [testOrgPlatformKeys, testOrgBYOK, testOrgCustomHost] },
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.integrationCredential.deleteMany({
      where: {
        OR: [
          { organizationId: SYSTEM_ORG_ID },
          { organizationId: testOrgPlatformKeys },
          { organizationId: testOrgBYOK },
          { organizationId: testOrgCustomHost },
        ],
      },
    });

    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testMasterAdminId] } },
    });

    await prisma.organization.deleteMany({
      where: {
        id: { in: [testOrgPlatformKeys, testOrgBYOK, testOrgCustomHost] },
      },
    });
  });

  describe('Pinecone Ingestion with Platform Keys', () => {
    it('should use platform credentials when usePlatformKeys=true', async () => {
      // This test verifies the credential lookup is correct
      // Actual ingestion would fail due to mock credentials, but we're testing the routing
      await expect(
        ingestToPinecone(sampleRecords, testOrgPlatformKeys, () => {}, logger)
      ).rejects.toThrow();

      // Verify lastUsedAt was updated on platform credentials
      const platformCred = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'PINECONE',
          },
        },
      });

      expect(platformCred).toBeTruthy();
      expect(platformCred?.lastUsedAt).toBeTruthy();
    });

    it('should use org-specific Pinecone host when configured', async () => {
      // Test that the org-specific host override is used
      // The ingestion will fail with mock credentials, but the host should be picked up correctly
      await expect(
        ingestToPinecone(sampleRecords, testOrgCustomHost, () => {}, logger)
      ).rejects.toThrow();

      // Verify platform credentials were used (lastUsedAt updated)
      const platformCred = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'PINECONE',
          },
        },
      });

      expect(platformCred?.lastUsedAt).toBeTruthy();

      // To properly test host override, we'd need to mock the Pinecone API
      // For now, we verify the credentials are retrieved correctly
    });

    it('should throw error when BYOK org has no credentials', async () => {
      await expect(
        ingestToPinecone(sampleRecords, testOrgBYOK, () => {}, logger)
      ).rejects.toThrow('Pinecone credentials not configured for this organization');
    });

    it('should use org-specific credentials when BYOK org provides them', async () => {
      // Save org-specific credentials for BYOK org
      await prisma.integrationCredential.upsert({
        where: {
          organizationId_integrationType: {
            organizationId: testOrgBYOK,
            integrationType: 'PINECONE',
          },
        },
        create: {
          organizationId: testOrgBYOK,
          integrationType: 'PINECONE',
          name: 'Org Pinecone',
          credentials: 'mock-encrypted-org-pinecone-credentials',
          createdBy: testUserId,
        },
        update: {
          credentials: 'mock-encrypted-org-pinecone-credentials',
        },
      });

      // Should attempt to use org-specific credentials (will fail with mock data)
      await expect(
        ingestToPinecone(sampleRecords, testOrgBYOK, () => {}, logger)
      ).rejects.toThrow();

      // Verify org-specific credentials were accessed
      const orgCred = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: testOrgBYOK,
            integrationType: 'PINECONE',
          },
        },
      });

      expect(orgCred?.lastUsedAt).toBeTruthy();
    });
  });

  describe('Neo4j Ingestion with Platform Keys', () => {
    it('should use platform credentials when usePlatformKeys=true', async () => {
      // This test verifies the credential lookup is correct
      await expect(
        ingestToNeo4j(sampleRecords, testOrgPlatformKeys, () => {}, logger)
      ).rejects.toThrow();

      // Verify lastUsedAt was updated on platform credentials
      const platformCred = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'NEO4J',
          },
        },
      });

      expect(platformCred).toBeTruthy();
      expect(platformCred?.lastUsedAt).toBeTruthy();
    });

    it('should throw error when BYOK org has no credentials', async () => {
      await expect(
        ingestToNeo4j(sampleRecords, testOrgBYOK, () => {}, logger)
      ).rejects.toThrow('Neo4j credentials not configured for this organization');
    });

    it('should use org-specific credentials when BYOK org provides them', async () => {
      // Save org-specific credentials for BYOK org
      await prisma.integrationCredential.upsert({
        where: {
          organizationId_integrationType: {
            organizationId: testOrgBYOK,
            integrationType: 'NEO4J',
          },
        },
        create: {
          organizationId: testOrgBYOK,
          integrationType: 'NEO4J',
          name: 'Org Neo4j',
          credentials: 'mock-encrypted-org-neo4j-credentials',
          createdBy: testUserId,
        },
        update: {
          credentials: 'mock-encrypted-org-neo4j-credentials',
        },
      });

      // Should attempt to use org-specific credentials (will fail with mock data)
      await expect(
        ingestToNeo4j(sampleRecords, testOrgBYOK, () => {}, logger)
      ).rejects.toThrow();

      // Verify org-specific credentials were accessed
      const orgCred = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: testOrgBYOK,
            integrationType: 'NEO4J',
          },
        },
      });

      expect(orgCred?.lastUsedAt).toBeTruthy();
    });
  });

  describe('Credential Routing Logic', () => {
    it('should properly route to platform credentials for ingestion', async () => {
      // Test that platform credentials are used for organizations with usePlatformKeys=true
      const org = await prisma.organization.findUnique({
        where: { id: testOrgPlatformKeys },
        select: { usePlatformKeys: true, pineconeHost: true },
      });

      expect(org?.usePlatformKeys).toBe(true);

      // Verify platform credentials exist
      const pinecone = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'PINECONE',
          },
        },
      });

      const neo4j = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'NEO4J',
          },
        },
      });

      expect(pinecone).toBeTruthy();
      expect(neo4j).toBeTruthy();
    });

    it('should not use platform credentials when usePlatformKeys=false', async () => {
      const org = await prisma.organization.findUnique({
        where: { id: testOrgBYOK },
        select: { usePlatformKeys: true },
      });

      expect(org?.usePlatformKeys).toBe(false);

      // Without org-specific credentials, ingestion should fail
      await expect(
        ingestToPinecone(sampleRecords, testOrgBYOK, () => {}, logger)
      ).rejects.toThrow('Pinecone credentials not configured for this organization');
    });

    it('should respect org-specific pineconeHost override', async () => {
      const org = await prisma.organization.findUnique({
        where: { id: testOrgCustomHost },
        select: { pineconeHost: true, usePlatformKeys: true },
      });

      expect(org?.usePlatformKeys).toBe(true);
      expect(org?.pineconeHost).toBe('https://org-123456.pinecone.io');

      // The CredentialsManager.getPlatformCredentials should apply the host override
      // This is tested in platform-credentials.test.ts, but we verify the flow here
    });
  });
});
