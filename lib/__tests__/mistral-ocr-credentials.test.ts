import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../prisma';
import { SYSTEM_ORG_ID, credentialsManager } from '../services/credentials/credentials-manager';
import { parsePdfFromS3, extractPdfTextFromS3 } from '../services/document/pdf-parser';

/**
 * Test Suite: Mistral OCR with Platform Credentials
 * 
 * Purpose: Verify that Mistral OCR PDF parsing correctly uses platform credentials
 * fallback logic to support both BYOK and platform-provided API keys.
 * 
 * Key Scenarios:
 * 1. Organizations with usePlatformKeys=true use SYSTEM_ORG_ID Mistral credentials
 * 2. Organizations with usePlatformKeys=false use their own Mistral credentials (BYOK)
 * 3. Credential retrieval errors are properly handled
 * 4. Both parsePdfFromS3 and extractPdfTextFromS3 respect credential routing
 */
describe('Mistral OCR with Platform Credentials', () => {
  const testOrgPlatformKeys = 'test-org-mistral-platform';
  const testOrgBYOK = 'test-org-mistral-byok';
  const testMasterAdminId = 'test-mistral-master-admin';
  const testUserId = 'test-mistral-user';

  const platformMistralKey = 'test-platform-mistral-api-key-abc123';
  const byokMistralKey = 'test-byok-mistral-api-key-xyz789';

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
        email: 'mistral-master@example.com',
        name: 'Mistral Master Admin',
        role: 'MASTER_ADMIN',
        organizationId: SYSTEM_ORG_ID,
      },
      update: {},
    });

    // Create test user
    await prisma.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: 'mistral-test@example.com',
        name: 'Mistral Test User',
        role: 'ADMIN',
        organizationId: SYSTEM_ORG_ID,
      },
      update: {},
    });

    // Create test org that uses platform keys
    await prisma.organization.upsert({
      where: { id: testOrgPlatformKeys },
      create: {
        id: testOrgPlatformKeys,
        slug: 'test-org-mistral-platform',
        name: 'Test Org - Platform Mistral Keys',
        subscriptionTier: 'STARTER',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: true,
      },
      update: {
        usePlatformKeys: true,
        subscriptionStatus: 'ACTIVE',
      },
    });

    // Create BYOK test org
    await prisma.organization.upsert({
      where: { id: testOrgBYOK },
      create: {
        id: testOrgBYOK,
        slug: 'test-org-mistral-byok',
        name: 'Test Org - BYOK Mistral Keys',
        subscriptionTier: 'GROWTH',
        subscriptionStatus: 'ACTIVE',
        usePlatformKeys: false,
      },
      update: {
        usePlatformKeys: false,
        subscriptionStatus: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data - only delete Mistral credentials from SYSTEM org
    await prisma.integrationCredential.deleteMany({
      where: {
        OR: [
          { organizationId: SYSTEM_ORG_ID, integrationType: 'MISTRAL' },
          { organizationId: testOrgPlatformKeys },
          { organizationId: testOrgBYOK },
        ],
      },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrgPlatformKeys, testOrgBYOK] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testMasterAdminId, testUserId] } },
    });
  });

  beforeEach(async () => {
    // Clean up ONLY Mistral credentials before each test for isolation
    // Don't delete other integration types to avoid interfering with parallel tests
    await prisma.integrationCredential.deleteMany({
      where: {
        OR: [
          { organizationId: SYSTEM_ORG_ID, integrationType: 'MISTRAL' },
          { organizationId: testOrgPlatformKeys },
          { organizationId: testOrgBYOK },
        ],
      },
    });

    // Save platform Mistral credentials to SYSTEM org (fresh for each test)
    await credentialsManager.saveCredentials(
      SYSTEM_ORG_ID,
      'MISTRAL',
      { apiKey: platformMistralKey },
      testMasterAdminId
    );

    // Save BYOK Mistral credentials (fresh for each test)
    await credentialsManager.saveCredentials(
      testOrgBYOK,
      'MISTRAL',
      { apiKey: byokMistralKey },
      testUserId
    );
  });

  describe('Platform Credentials Routing', () => {
    it('should use platform Mistral credentials when usePlatformKeys=true', async () => {
      // Get credentials for org with platform keys enabled
      const credentials = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
        testOrgPlatformKeys,
        'MISTRAL'
      );

      expect(credentials).toBeDefined();
      expect(credentials?.apiKey).toBe(platformMistralKey);
    });

    it('should use BYOK Mistral credentials when usePlatformKeys=false', async () => {
      // Get credentials for BYOK org
      const credentials = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
        testOrgBYOK,
        'MISTRAL'
      );

      expect(credentials).toBeDefined();
      expect(credentials?.apiKey).toBe(byokMistralKey);
    });

    it('should return null when no credentials are configured', async () => {
      // Create org with no credentials
      const testOrgNoCredentials = 'test-org-mistral-no-credentials';
      await prisma.organization.upsert({
        where: { id: testOrgNoCredentials },
        create: {
          id: testOrgNoCredentials,
          slug: 'test-org-mistral-no-credentials',
          name: 'Test Org - No Mistral Credentials',
          subscriptionTier: 'STARTER',
          subscriptionStatus: 'ACTIVE',
          usePlatformKeys: false, // BYOK but no credentials saved
        },
        update: {},
      });

      try {
        const credentials = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
          testOrgNoCredentials,
          'MISTRAL'
        );

        expect(credentials).toBeNull();
      } finally {
        await prisma.organization.delete({ where: { id: testOrgNoCredentials } });
      }
    });
  });

  describe('PDF Parser Integration', () => {
    it('should throw error when Mistral credentials are not configured', async () => {
      // Create org with no credentials
      const testOrgNoCredentials = 'test-org-mistral-parser-no-creds';
      await prisma.organization.upsert({
        where: { id: testOrgNoCredentials },
        create: {
          id: testOrgNoCredentials,
          slug: 'test-org-mistral-parser-no-creds',
          name: 'Test Org - No Parser Credentials',
          subscriptionTier: 'STARTER',
          subscriptionStatus: 'ACTIVE',
          usePlatformKeys: false,
        },
        update: {},
      });

      try {
        await expect(
          extractPdfTextFromS3(testOrgNoCredentials, 'fake-s3-key.pdf')
        ).rejects.toThrow('Mistral API credentials not configured');
      } finally {
        await prisma.organization.delete({ where: { id: testOrgNoCredentials } });
      }
    });

    it('should accept organizationId parameter in pdf-parser functions', async () => {
      // Verify function signatures accept organizationId
      // This test validates the refactoring was successful
      const mockS3Key = 'test-invoice.pdf';

      // Test that the function signature is correct (won't actually call Mistral API)
      try {
        await extractPdfTextFromS3(testOrgPlatformKeys, mockS3Key);
      } catch (error: any) {
        // Expected to fail due to invalid S3 key, but should not fail due to missing organizationId
        expect(error.message).not.toContain('organizationId');
      }

      try {
        await parsePdfFromS3(testOrgPlatformKeys, mockS3Key);
      } catch (error: any) {
        // Expected to fail due to invalid S3 key, but should not fail due to missing organizationId
        expect(error.message).not.toContain('organizationId');
      }
    });
  });

  describe('Credential Metadata Tracking', () => {
    it('should track lastUsedAt when retrieving Mistral credentials', async () => {
      // Get credentials
      await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
        testOrgPlatformKeys,
        'MISTRAL'
      );

      // Verify lastUsedAt was updated
      const credential = await prisma.integrationCredential.findFirst({
        where: {
          organizationId: SYSTEM_ORG_ID,
          integrationType: 'MISTRAL',
        },
      });

      expect(credential).toBeDefined();
      expect(credential?.lastUsedAt).toBeDefined();
      expect(credential?.lastUsedAt?.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    });

    it('should track BYOK credential usage', async () => {
      // Get BYOK credentials
      await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
        testOrgBYOK,
        'MISTRAL'
      );

      // Verify lastUsedAt was updated for org-specific credentials
      const credential = await prisma.integrationCredential.findFirst({
        where: {
          organizationId: testOrgBYOK,
          integrationType: 'MISTRAL',
        },
      });

      expect(credential).toBeDefined();
      expect(credential?.lastUsedAt).toBeDefined();
      expect(credential?.lastUsedAt?.getTime()).toBeGreaterThan(Date.now() - 5000);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support maintenance PDF worker flow', async () => {
      // Simulate maintenance-pdf-worker calling extractPdfTextFromS3
      // with platform credentials
      const mockS3Key = 'maintenance-manual.pdf';

      try {
        await extractPdfTextFromS3(testOrgPlatformKeys, mockS3Key);
      } catch (error: any) {
        // Expected to fail due to invalid S3 key or missing Mistral mock
        // But should not fail due to credential routing issues
        expect(error.message).toContain('Failed to parse PDF');
        expect(error.message).not.toContain('credentials not configured');
      }
    });

    it('should support quote extraction worker flow', async () => {
      // Simulate quote-extraction-worker calling extractPdfTextFromS3
      // with BYOK credentials
      const mockS3Key = 'supplier-quote.pdf';

      try {
        await extractPdfTextFromS3(testOrgBYOK, mockS3Key);
      } catch (error: any) {
        // Expected to fail due to invalid S3 key or missing Mistral mock
        // But should not fail due to credential routing issues
        expect(error.message).toContain('Failed to parse PDF');
        expect(error.message).not.toContain('credentials not configured');
      }
    });

    it('should support API route flow with parsePdfFromS3', async () => {
      // Simulate extract-prices route calling parsePdfFromS3
      // with platform credentials
      const mockS3Key = 'email-attachment.pdf';

      try {
        await parsePdfFromS3(testOrgPlatformKeys, mockS3Key);
      } catch (error: any) {
        // Expected to fail due to invalid S3 key or missing Mistral mock
        // But should not fail due to credential routing issues
        expect(error.message).toContain('Failed to parse PDF');
        expect(error.message).not.toContain('credentials not configured');
      }
    });
  });
});
