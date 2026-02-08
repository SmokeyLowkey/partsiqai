import { prisma } from '@/lib/prisma';
import { encryptCredentials, decryptCredentials } from './encryption';
import { IntegrationType } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';
import neo4j from 'neo4j-driver';
import { google } from 'googleapis';
import OpenAI from 'openai';

export class CredentialsManager {
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

    // Update last used timestamp
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });

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
    return await prisma.integrationCredential.findMany({
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
  }

  async hasCredentials(organizationId: string, type: IntegrationType): Promise<boolean> {
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
