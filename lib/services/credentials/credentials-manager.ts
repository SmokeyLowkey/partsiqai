import { prisma } from '@/lib/prisma';
import { encryptCredentials, decryptCredentials } from './encryption';
import { IntegrationType } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';
import neo4j from 'neo4j-driver';
import { google } from 'googleapis';
import OpenAI from 'openai';

// Special organization ID for platform-wide credentials
export const SYSTEM_ORG_ID = 'system-platform-credentials';

export class CredentialsManager {
  /**
   * Get credentials with platform key fallback
   * Checks usePlatformKeys flag - if true, returns platform-wide keys from SystemSettings
   * If false or platform keys not available, returns organization-specific keys
   */
  async getCredentialsWithFallback<T>(organizationId: string, type: IntegrationType): Promise<T | null> {
    // Get organization to check usePlatformKeys flag
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        usePlatformKeys: true,
        pineconeHost: true,
      },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    console.log(`[CredentialsManager] Getting credentials for ${type}:`, {
      organizationId,
      usePlatformKeys: organization.usePlatformKeys,
    });

    // If using platform keys, try to get from SystemSettings
    if (organization.usePlatformKeys) {
      console.log(`[CredentialsManager] Organization using platform keys, fetching from SystemSettings...`);
      const platformCreds = await this.getPlatformCredentials<T>(type, organization);
      if (platformCreds) {
        console.log(`[CredentialsManager] Platform credentials found for ${type}`);
        return platformCreds;
      }
      console.warn(`[CredentialsManager] Platform credentials NOT found for ${type}, falling back to org-specific`);
      // If platform creds not available, fall through to org-specific creds
    }

    // Fall back to organization-specific credentials
    console.log(`[CredentialsManager] Fetching org-specific credentials for ${type}`);
    const orgCreds = await this.getCredentials<T>(organizationId, type);
    if (!orgCreds) {
      console.error(`[CredentialsManager] No credentials found for ${type} (neither platform nor org-specific)`);
    }
    return orgCreds;
  }

  /**
   * Get platform-wide credentials from IntegrationCredential with SYSTEM_ORG_ID
   * Non-sensitive config (host URLs, model names) still come from SystemSettings
   */
  private async getPlatformCredentials<T>(type: IntegrationType, organization?: { pineconeHost?: string | null }): Promise<T | null> {
    console.log(`[CredentialsManager] Getting platform credentials for ${type}`);

    // Get encrypted credentials from IntegrationCredential table (SYSTEM org)
    const platformCred = await this.getCredentials<any>(SYSTEM_ORG_ID, type);
    
    if (!platformCred) {
      console.warn(`[CredentialsManager] No platform credentials found for ${type}`);
      return null;
    }

    console.log(`[CredentialsManager] Found platform credentials for ${type}`);

    // For Pinecone, check if org has a custom host override
    if (type === 'PINECONE' && organization?.pineconeHost) {
      platformCred.host = organization.pineconeHost;
      console.log(`[CredentialsManager] Using org-specific Pinecone host: ${organization.pineconeHost}`);
    }

    return platformCred as T;
  }

  async getCredentials<T>(organizationId: string, type: IntegrationType): Promise<T | null> {
    const credential = await prisma.integrationCredential.findUnique({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: type,
        },
      },
    });

    if (!credential || !credential.isActive) {
      return null;
    }

    // Update last used timestamp (safe for parallel test execution)
    try {
      await prisma.integrationCredential.update({
        where: { id: credential.id },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      // If the record was deleted between find and update (e.g., during parallel tests),
      // we can safely ignore this error and still return the credentials we found.
      console.warn(`[CredentialsManager] Failed to update lastUsedAt for credential ${credential.id}:`, error);
    }

    return decryptCredentials<T>(credential.credentials);
  }

  /**
   * Get credentials for a specific user (per-user credentials)
   */
  async getUserCredentials<T>(userId: string, type: IntegrationType): Promise<T | null> {
    const credential = await prisma.integrationCredential.findFirst({
      where: {
        createdBy: userId,
        integrationType: type,
        isActive: true,
      },
    });

    if (!credential) {
      return null;
    }

    // Update last used timestamp
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });

    return decryptCredentials<T>(credential.credentials);
  }

  /**
   * Store credentials for a specific user (per-user credentials)
   */
  async storeUserCredentials(
    userId: string,
    type: IntegrationType,
    credentials: any,
    name?: string,
    config?: any
  ) {
    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const encrypted = encryptCredentials(credentials);
    const encryptedConfig = config ? encryptCredentials(config) : undefined;

    // Check if user already has credentials of this type
    const existing = await prisma.integrationCredential.findFirst({
      where: {
        createdBy: userId,
        integrationType: type,
      },
    });

    if (existing) {
      return await prisma.integrationCredential.update({
        where: { id: existing.id },
        data: {
          credentials: encrypted,
          config: encryptedConfig,
          name: name || type,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      return await prisma.integrationCredential.create({
        data: {
          organizationId: user.organizationId,
          integrationType: type,
          name: name || type,
          credentials: encrypted,
          config: encryptedConfig,
          createdBy: userId,
        },
      });
    }
  }

  async listCredentials(organizationId: string) {
    // Get organization to check usePlatformKeys flag
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        usePlatformKeys: true,
        pineconeHost: true,
      },
    });

    // Get org-specific credentials
    const orgCredentials = await prisma.integrationCredential.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        integrationType: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        lastTestedAt: true,
        testStatus: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If not using platform keys, return only org credentials
    if (!organization?.usePlatformKeys) {
      return orgCredentials;
    }

    // If using platform keys, add virtual entries for platform integrations
    const platformTypes: IntegrationType[] = ['OPENROUTER', 'PINECONE', 'NEO4J', 'MISTRAL'];
    const platformCredentialsEntries = [];

    for (const type of platformTypes) {
      // Skip if org already has this integration configured
      if (orgCredentials.some((c) => c.integrationType === type)) {
        continue;
      }

      // Check if platform credentials exist for this type
      const hasPlatformCreds = await this.getPlatformCredentials(type, organization);
      if (hasPlatformCreds) {
        // Add virtual entry for platform credentials
        platformCredentialsEntries.push({
          id: `platform-${type.toLowerCase()}`,
          integrationType: type,
          name: `Platform ${type} (System-Wide)`,
          isActive: true,
          lastUsedAt: null,
          lastTestedAt: null,
          testStatus: 'PENDING' as const,
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return [...orgCredentials, ...platformCredentialsEntries];
  }

  async hasCredentials(organizationId: string, type: IntegrationType): Promise<boolean> {
    // Check if organization uses platform keys
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        usePlatformKeys: true,
        pineconeHost: true,
      },
    });

    if (!organization) {
      return false;
    }

    // If using platform keys, check SYSTEM org credentials
    if (organization.usePlatformKeys) {
      const platformCreds = await this.getCredentials(SYSTEM_ORG_ID, type);
      if (platformCreds) {
        return true;
      }
      // Fall through to check org-specific credentials
    }

    // Check org-specific credentials
    const credential = await prisma.integrationCredential.findUnique({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: type,
        },
      },
    });

    return credential !== null && credential.isActive;
  }

  async saveCredentials(
    organizationId: string,
    type: IntegrationType,
    credentials: any,
    userId: string,
    name?: string,
    config?: any
  ) {
    const encrypted = encryptCredentials(credentials);
    const encryptedConfig = config ? encryptCredentials(config) : undefined;

    return await prisma.integrationCredential.upsert({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: type,
        },
      },
      create: {
        organizationId,
        integrationType: type,
        name: name || type,
        credentials: encrypted,
        config: encryptedConfig,
        createdBy: userId,
      },
      update: {
        credentials: encrypted,
        config: encryptedConfig,
        name: name || type,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  async deleteCredentials(organizationId: string, type: IntegrationType) {
    return await prisma.integrationCredential.delete({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: type,
        },
      },
    });
  }

  async setCredentials(
    organizationId: string,
    type: IntegrationType,
    credentials: any,
    userId: string,
    name?: string
  ) {
    const encrypted = encryptCredentials(credentials);

    return await prisma.integrationCredential.upsert({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: type,
        },
      },
      create: {
        organizationId,
        integrationType: type,
        name: name || type,
        credentials: encrypted,
        createdBy: userId,
      },
      update: {
        credentials: encrypted,
        name: name || type,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  async testCredentials(organizationId: string, type: IntegrationType): Promise<boolean> {
    const credentials = await this.getCredentials(organizationId, type);
    if (!credentials) return false;

    try {
      // Test based on integration type
      switch (type) {
        case 'OPENROUTER':
          await this.testOpenRouter(credentials as any);
          break;
        case 'GMAIL':
          await this.testGmail(credentials as any);
          break;
        case 'PINECONE':
          await this.testPinecone(credentials as any);
          break;
        case 'NEO4J':
          await this.testNeo4j(credentials as any);
          break;
        case 'MISTRAL':
          await this.testMistral(credentials as any);
          break;
      }

      // Update test status
      await prisma.integrationCredential.update({
        where: {
          organizationId_integrationType: {
            organizationId,
            integrationType: type,
          },
        },
        data: {
          lastTestedAt: new Date(),
          testStatus: 'SUCCESS',
          errorMessage: null,
        },
      });

      return true;
    } catch (error: any) {
      await prisma.integrationCredential.update({
        where: {
          organizationId_integrationType: {
            organizationId,
            integrationType: type,
          },
        },
        data: {
          lastTestedAt: new Date(),
          testStatus: 'FAILED',
          errorMessage: error.message,
        },
      });
      return false;
    }
  }

  private async testOpenRouter(creds: { apiKey: string; defaultModel?: string }) {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: creds.apiKey,
    });

    // Test with a simple completion
    await client.chat.completions.create({
      model: creds.defaultModel || 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });
  }

  private async testGmail(creds: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accessToken?: string;
  }) {
    const oauth2Client = new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      process.env.GMAIL_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: creds.refreshToken,
      access_token: creds.accessToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Test by getting profile
    await gmail.users.getProfile({ userId: 'me' });
  }

  private async testPinecone(creds: { apiKey: string; host: string }) {
    const client = new Pinecone({
      apiKey: creds.apiKey,
    });

    // Test by listing indexes to verify API key
    await client.listIndexes();
  }

  private async testNeo4j(creds: { uri: string; username: string; password: string; database?: string }) {
    const driver = neo4j.driver(
      creds.uri,
      neo4j.auth.basic(creds.username, creds.password)
    );

    try {
      // Test connection
      const session = driver.session({
        database: creds.database || 'neo4j',
      });

      await session.run('RETURN 1');
      await session.close();
    } finally {
      await driver.close();
    }
  }

  private async testMistral(creds: { apiKey: string }) {
    // Use OpenAI-compatible SDK with Mistral's base URL
    const client = new OpenAI({
      baseURL: 'https://api.mistral.ai/v1',
      apiKey: creds.apiKey,
    });

    // Test by listing models to verify API key
    await client.models.list();
  }
}

export const credentialsManager = new CredentialsManager();
