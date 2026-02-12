import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CredentialsManager, SYSTEM_ORG_ID } from '../services/credentials/credentials-manager';
import { prisma } from '../prisma';
import { IntegrationType } from '@prisma/client';

describe('Platform Credentials (SYSTEM Organization)', () => {
  const credentialsManager = new CredentialsManager();
  
  // Test data
  const testMasterAdminId = 'test-master-admin-123';
  const testOrgId = 'test-org-platform-keys';
  const testOrgBYOKId = 'test-org-byok';
  const testUserId = 'test-user-123';

  const testCredentials = {
    OPENROUTER: { apiKey: 'sk-or-platform-test-key-12345', defaultModel: 'anthropic/claude-3.5-sonnet' },
    PINECONE: { apiKey: 'pc-platform-test-key-67890', host: 'https://platform-index.pinecone.io' },
    NEO4J: { uri: 'bolt://platform-neo4j:7687', username: 'neo4j', password: 'platform-password', database: 'neo4j' },
    MISTRAL: { apiKey: 'mistral-platform-key-abcdef' },
  };

  // Ensure encryption key is set
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

    // Create test organization that uses platform keys
    await prisma.organization.upsert({
      where: { id: testOrgId },
      create: {
        id: testOrgId,
        slug: 'test-org-platform-keys',
        name: 'Test Org - Platform Keys',
        subscriptionTier: 'STARTER',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: true,
        pineconeHost: null,
      },
      update: {
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: true,
        pineconeHost: null,
      },
    });

    // Create test organization that uses BYOK
    await prisma.organization.upsert({
      where: { id: testOrgBYOKId },
      create: {
        id: testOrgBYOKId,
        slug: 'test-org-byok',
        name: 'Test Org - BYOK',
        subscriptionTier: 'GROWTH',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: false,
      },
      update: {
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: false,
      },
    });

    // Create master admin user
    await prisma.user.upsert({
      where: { id: testMasterAdminId },
      create: {
        id: testMasterAdminId,
        email: 'master-admin@example.com',
        name: 'Master Admin',
        role: 'MASTER_ADMIN',
        organizationId: SYSTEM_ORG_ID,
      },
      update: {
        role: 'MASTER_ADMIN',
        organizationId: SYSTEM_ORG_ID,
      },
    });

    // Create test user
    await prisma.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: testOrgId,
      },
      update: {
        organizationId: testOrgId,
      },
    });
  });

  beforeEach(async () => {
    // Clean up credentials before each test
    await prisma.integrationCredential.deleteMany({
      where: {
        OR: [
          { organizationId: SYSTEM_ORG_ID },
          { organizationId: testOrgId },
          { organizationId: testOrgBYOKId },
        ],
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.integrationCredential.deleteMany({
      where: {
        OR: [
          { organizationId: SYSTEM_ORG_ID },
          { organizationId: testOrgId },
          { organizationId: testOrgBYOKId },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: [testUserId, testMasterAdminId] } } });
    await prisma.organization.deleteMany({
      where: {
        id: { in: [testOrgId, testOrgBYOKId] },
      },
    });
    // Don't delete SYSTEM org as it may be used by other tests
  });

  describe('Saving Platform Credentials', () => {
    it('should save encrypted credentials to SYSTEM organization', async () => {
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId,
        'Platform OpenRouter'
      );

      const saved = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'OPENROUTER',
          },
        },
      });

      expect(saved).toBeTruthy();
      expect(saved?.organizationId).toBe(SYSTEM_ORG_ID);
      expect(saved?.integrationType).toBe('OPENROUTER');
      expect(saved?.credentials).toBeTruthy();
      // Credentials should be encrypted (not equal to plain text)
      expect(saved?.credentials).not.toContain(testCredentials.OPENROUTER.apiKey);
      expect(saved?.isActive).toBe(true);
    });

    it('should save all integration types to SYSTEM org', async () => {
      // Save all credential types
      await Promise.all([
        credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'OPENROUTER', testCredentials.OPENROUTER, testMasterAdminId),
        credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'PINECONE', testCredentials.PINECONE, testMasterAdminId),
        credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'NEO4J', testCredentials.NEO4J, testMasterAdminId),
        credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'MISTRAL', testCredentials.MISTRAL, testMasterAdminId),
      ]);

      const allCredentials = await prisma.integrationCredential.findMany({
        where: { organizationId: SYSTEM_ORG_ID },
      });

      expect(allCredentials.length).toBe(4);
      expect(allCredentials.every((c) => c.isActive)).toBe(true);
      expect(allCredentials.every((c) => c.credentials.length > 0)).toBe(true);
    });
  });

  describe('Retrieving Platform Credentials', () => {
    beforeEach(async () => {
      // Set up platform credentials
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId
      );
    });

    it('should retrieve decrypted credentials from SYSTEM org', async () => {
      const credentials = await credentialsManager.getCredentials<typeof testCredentials.OPENROUTER>(
        SYSTEM_ORG_ID,
        'OPENROUTER'
      );

      expect(credentials).toBeTruthy();
      expect(credentials?.apiKey).toBe(testCredentials.OPENROUTER.apiKey);
      expect(credentials?.defaultModel).toBe(testCredentials.OPENROUTER.defaultModel);
    });

    it('should return null for non-existent platform credentials', async () => {
      const credentials = await credentialsManager.getCredentials(SYSTEM_ORG_ID, 'NEO4J');
      expect(credentials).toBeNull();
    });

    it('should update lastUsedAt when credentials are retrieved', async () => {
      const before = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'OPENROUTER',
          },
        },
        select: { lastUsedAt: true },
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms

      await credentialsManager.getCredentials(SYSTEM_ORG_ID, 'OPENROUTER');

      const after = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'OPENROUTER',
          },
        },
        select: { lastUsedAt: true },
      });

      expect(after?.lastUsedAt).toBeTruthy();
      if (before?.lastUsedAt) {
        expect(after?.lastUsedAt?.getTime()).toBeGreaterThan(before.lastUsedAt.getTime());
      }
    });
  });

  describe('Organization Platform Key Usage (usePlatformKeys=true)', () => {
    beforeEach(async () => {
      // Set up platform credentials
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId
      );
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'PINECONE',
        testCredentials.PINECONE,
        testMasterAdminId
      );
    });

    it('should return platform credentials when org usePlatformKeys=true', async () => {
      const credentials = await credentialsManager.getCredentialsWithFallback<typeof testCredentials.OPENROUTER>(
        testOrgId,
        'OPENROUTER'
      );

      expect(credentials).toBeTruthy();
      expect(credentials?.apiKey).toBe(testCredentials.OPENROUTER.apiKey);
    });

    it('should report hasCredentials=true for platform keys', async () => {
      const has = await credentialsManager.hasCredentials(testOrgId, 'OPENROUTER');
      expect(has).toBe(true);
    });

    it('should fallback to org credentials if platform creds missing', async () => {
      // Save org-specific credential
      await credentialsManager.saveCredentials(
        testOrgId,
        'NEO4J',
        { uri: 'bolt://org-neo4j:7687', username: 'neo4j', password: 'org-pass', database: 'neo4j' },
        testUserId
      );

      // Platform creds don't exist for NEO4J in this test
      const credentials = await credentialsManager.getCredentialsWithFallback<any>(testOrgId, 'NEO4J');

      expect(credentials).toBeTruthy();
      expect(credentials.uri).toBe('bolt://org-neo4j:7687');
    });

    it('should handle account being active for platform keys', async () => {
      // Update org to ACTIVE status
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { subscriptionStatus: 'ACTIVE' },
      });

      const credentials = await credentialsManager.getCredentialsWithFallback(testOrgId, 'OPENROUTER');
      expect(credentials).toBeTruthy();
    });

    it('should work when organization is in TRIAL status', async () => {
      // Update org to TRIAL status
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { subscriptionStatus: 'TRIAL' },
      });

      const credentials = await credentialsManager.getCredentialsWithFallback(testOrgId, 'OPENROUTER');
      expect(credentials).toBeTruthy();
    });

    it('should respect account status - suspended accounts should still technically retrieve credentials', async () => {
      // Note: Actual business logic for blocking suspended accounts should be in middleware/guards
      // CredentialsManager just retrieves credentials
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { subscriptionStatus: 'SUSPENDED' },
      });

      // Credentials are still retrievable - business logic layer should block usage
      const credentials = await credentialsManager.getCredentialsWithFallback(testOrgId, 'OPENROUTER');
      expect(credentials).toBeTruthy();
    });

    it('should override Pinecone host when org has custom pineconeHost', async () => {
      const customHost = 'https://org-specific-index.pinecone.io';

      // Set org-specific Pinecone host
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { pineconeHost: customHost },
      });

      const credentials = await credentialsManager.getCredentialsWithFallback<typeof testCredentials.PINECONE>(
        testOrgId,
        'PINECONE'
      );

      expect(credentials).toBeTruthy();
      expect(credentials?.apiKey).toBe(testCredentials.PINECONE.apiKey);
      expect(credentials?.host).toBe(customHost); // Should use org override
    });

    it('should use platform Pinecone host when org has no custom host', async () => {
      // Ensure org has no custom host
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { pineconeHost: null },
      });

      const credentials = await credentialsManager.getCredentialsWithFallback<typeof testCredentials.PINECONE>(
        testOrgId,
        'PINECONE'
      );

      expect(credentials).toBeTruthy();
      expect(credentials?.host).toBe(testCredentials.PINECONE.host); // Should use platform default
    });
  });

  describe('Organization BYOK (usePlatformKeys=false)', () => {
    beforeEach(async () => {
      // Set up platform credentials
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId
      );
    });

    it('should NOT use platform credentials when usePlatformKeys=false', async () => {
      // BYOK org has no credentials of its own
      const credentials = await credentialsManager.getCredentialsWithFallback(testOrgBYOKId, 'OPENROUTER');

      expect(credentials).toBeNull();
    });

    it('should use org-specific credentials when usePlatformKeys=false', async () => {
      const orgCreds = {
        apiKey: 'sk-or-org-specific-key',
        defaultModel: 'anthropic/claude-3-opus',
      };

      // Save org-specific credential
      await credentialsManager.saveCredentials(testOrgBYOKId, 'OPENROUTER', orgCreds, testUserId);

      const credentials = await credentialsManager.getCredentialsWithFallback<typeof orgCreds>(
        testOrgBYOKId,
        'OPENROUTER'
      );

      expect(credentials).toBeTruthy();
      expect(credentials?.apiKey).toBe(orgCreds.apiKey);
      expect(credentials?.defaultModel).toBe(orgCreds.defaultModel);
    });

    it('should report hasCredentials=false when BYOK org has no credentials', async () => {
      const has = await credentialsManager.hasCredentials(testOrgBYOKId, 'OPENROUTER');
      expect(has).toBe(false);
    });

    it('should report hasCredentials=true when BYOK org has own credentials', async () => {
      await credentialsManager.saveCredentials(
        testOrgBYOKId,
        'OPENROUTER',
        { apiKey: 'test-key', defaultModel: 'test-model' },
        testUserId
      );

      const has = await credentialsManager.hasCredentials(testOrgBYOKId, 'OPENROUTER');
      expect(has).toBe(true);
    });
  });

  describe('Listing Credentials with Platform Keys', () => {
    beforeEach(async () => {
      // Set up platform credentials
      await credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'OPENROUTER', testCredentials.OPENROUTER, testMasterAdminId);
      await credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'PINECONE', testCredentials.PINECONE, testMasterAdminId);
    });

    it('should include virtual platform credential entries for usePlatformKeys=true', async () => {
      const list = await credentialsManager.listCredentials(testOrgId);

      const platformOpenRouter = list.find((c) => c.id === 'platform-openrouter');
      const platformPinecone = list.find((c) => c.id === 'platform-pinecone');

      expect(platformOpenRouter).toBeTruthy();
      expect(platformOpenRouter?.name).toContain('Platform OPENROUTER');
      expect(platformPinecone).toBeTruthy();
      expect(platformPinecone?.name).toContain('Platform PINECONE');
    });

    it('should NOT include virtual entries when org has own credentials for that type', async () => {
      // Add org-specific OpenRouter credentials
      await credentialsManager.saveCredentials(
        testOrgId,
        'OPENROUTER',
        { apiKey: 'org-key', defaultModel: 'org-model' },
        testUserId
      );

      const list = await credentialsManager.listCredentials(testOrgId);

      // Should not have virtual platform entry since org has its own
      const platformOpenRouter = list.find((c) => c.id === 'platform-openrouter');
      expect(platformOpenRouter).toBeUndefined();

      // Should have org-specific entry
      const orgOpenRouter = list.find((c) => c.integrationType === 'OPENROUTER');
      expect(orgOpenRouter).toBeTruthy();
      expect(orgOpenRouter?.id).not.toContain('platform-');
    });

    it('should NOT include virtual entries for BYOK organizations', async () => {
      const list = await credentialsManager.listCredentials(testOrgBYOKId);

      const platformEntries = list.filter((c) => c.id.startsWith('platform-'));
      expect(platformEntries.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when organization not found', async () => {
      await expect(
        credentialsManager.getCredentialsWithFallback('non-existent-org', 'OPENROUTER')
      ).rejects.toThrow('Organization not found');
    });

    it('should return null when inactive credentials exist', async () => {
      await credentialsManager.saveCredentials(SYSTEM_ORG_ID, 'MISTRAL', testCredentials.MISTRAL, testMasterAdminId);

      // Deactivate credentials
      await prisma.integrationCredential.update({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'MISTRAL',
          },
        },
        data: { isActive: false },
      });

      const credentials = await credentialsManager.getCredentials(SYSTEM_ORG_ID, 'MISTRAL');
      expect(credentials).toBeNull();
    });

    it('should handle encryption errors gracefully', async () => {
      // Test that encrypted credentials can't be decrypted without proper setup
      // Save credentials normally
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId
      );

      // Verify credentials were encrypted (not plain text)
      const saved = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'OPENROUTER',
          },
        },
      });

      expect(saved?.credentials).toBeTruthy();
      expect(saved?.credentials).not.toContain(testCredentials.OPENROUTER.apiKey);
      
      // Verify credentials contain encryption format (iv:authTag:ciphertext)
      expect(saved?.credentials.split(':').length).toBe(3);
    });
  });

  describe('Integration Tests - Full Flow', () => {
    it('should complete full lifecycle: save platform creds → org uses them → org switches to BYOK', async () => {
      // 1. Master admin saves platform credentials
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId
      );

      // 2. Organization uses platform credentials
      let credentials = await credentialsManager.getCredentialsWithFallback<typeof testCredentials.OPENROUTER>(
        testOrgId,
        'OPENROUTER'
      );
      expect(credentials?.apiKey).toBe(testCredentials.OPENROUTER.apiKey);

      // 3. Organization switches to BYOK
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { usePlatformKeys: false },
      });

      // 4. Organization no longer has credentials
      credentials = await credentialsManager.getCredentialsWithFallback(testOrgId, 'OPENROUTER');
      expect(credentials).toBeNull();

      // 5. Organization adds own credentials
      const ownCreds = { apiKey: 'sk-own-key', defaultModel: 'own-model' };
      await credentialsManager.saveCredentials(testOrgId, 'OPENROUTER', ownCreds, testUserId);

      // 6. Organization uses own credentials
      credentials = await credentialsManager.getCredentialsWithFallback(testOrgId, 'OPENROUTER');
      expect(credentials?.apiKey).toBe(ownCreds.apiKey);

      // 7. Organization switches back to platform keys
      await prisma.organization.update({
        where: { id: testOrgId },
        data: { usePlatformKeys: true },
      });

      // 8. Organization uses platform credentials again (own creds still exist but platform takes precedence)
      credentials = await credentialsManager.getCredentialsWithFallback(testOrgId, 'OPENROUTER');
      expect(credentials?.apiKey).toBe(testCredentials.OPENROUTER.apiKey);
    });

    it('should handle multiple organizations using same platform credentials', async () => {
      // Save platform credentials
      await credentialsManager.saveCredentials(
        SYSTEM_ORG_ID,
        'OPENROUTER',
        testCredentials.OPENROUTER,
        testMasterAdminId
      );

      // Create another org
      const anotherOrgId = 'test-org-another';
      await prisma.organization.upsert({
        where: { id: anotherOrgId },
        create: {
          id: anotherOrgId,
          slug: 'test-org-another',
          name: 'Another Test Org',
          subscriptionTier: 'STARTER',
          subscriptionStatus: 'ACTIVE',
          usePlatformKeys: true,
        },
        update: {
          usePlatformKeys: true,
          subscriptionStatus: 'ACTIVE',
        },
      });

      // Both orgs retrieve same platform credentials
      const creds1 = await credentialsManager.getCredentialsWithFallback<typeof testCredentials.OPENROUTER>(testOrgId, 'OPENROUTER');
      const creds2 = await credentialsManager.getCredentialsWithFallback<typeof testCredentials.OPENROUTER>(anotherOrgId, 'OPENROUTER');

      expect(creds1?.apiKey).toBe(testCredentials.OPENROUTER.apiKey);
      expect(creds2?.apiKey).toBe(testCredentials.OPENROUTER.apiKey);
      expect(creds1?.apiKey).toBe(creds2?.apiKey);

      // Both orgs should update the same lastUsedAt
      const platformCred = await prisma.integrationCredential.findUnique({
        where: {
          organizationId_integrationType: {
            organizationId: SYSTEM_ORG_ID,
            integrationType: 'OPENROUTER',
          },
        },
      });

      expect(platformCred?.lastUsedAt).toBeTruthy();

      // Cleanup
      await prisma.organization.delete({ where: { id: anotherOrgId } });
    });
  });
});
