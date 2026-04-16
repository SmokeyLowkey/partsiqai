import { Pinecone } from '@pinecone-database/pinecone';
import { prisma } from '@/lib/prisma';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';

interface PineconeCredentials {
  apiKey: string;
  host?: string;
}

interface PineconeProvisionConfig {
  cloud: string;
  region: string;
  metric: string;
  dimension: number;
}

const DEFAULTS: PineconeProvisionConfig = {
  cloud: 'aws',
  region: 'us-east-1',
  metric: 'cosine',
  dimension: 1024, // llama-text-embed-v2
};

async function getProvisionConfig(): Promise<PineconeProvisionConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'PINECONE_INDEX_CLOUD',
          'PINECONE_INDEX_REGION',
          'PINECONE_INDEX_METRIC',
          'PINECONE_INDEX_DIMENSION',
        ],
      },
    },
    select: { key: true, value: true },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    cloud: map.get('PINECONE_INDEX_CLOUD') || DEFAULTS.cloud,
    region: map.get('PINECONE_INDEX_REGION') || DEFAULTS.region,
    metric: map.get('PINECONE_INDEX_METRIC') || DEFAULTS.metric,
    dimension: parseInt(map.get('PINECONE_INDEX_DIMENSION') || String(DEFAULTS.dimension), 10),
  };
}

async function getPineconeClient(): Promise<Pinecone> {
  const credentialsManager = new CredentialsManager();
  const creds = await credentialsManager.getCredentialsWithFallback<PineconeCredentials>(
    'system-platform-credentials',
    'PINECONE'
  );

  if (!creds?.apiKey) {
    throw new Error('Pinecone API key not configured. Add it in Admin → Platform Credentials.');
  }

  return new Pinecone({ apiKey: creds.apiKey });
}

/**
 * Generate a valid Pinecone index name from an org slug.
 * Pinecone index names: lowercase alphanumeric + hyphens, max 45 chars, must start with letter.
 */
function indexNameFromSlug(slug: string): string {
  const sanitized = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const name = `org-${sanitized}`;
  return name.slice(0, 45);
}

/**
 * Create a new Pinecone serverless index for a tenant.
 * Returns the index host URL.
 */
export async function createTenantIndex(orgSlug: string): Promise<string> {
  const pc = await getPineconeClient();
  const config = await getProvisionConfig();
  const indexName = indexNameFromSlug(orgSlug);

  await pc.createIndex({
    name: indexName,
    dimension: config.dimension,
    metric: config.metric as 'cosine' | 'euclidean' | 'dotproduct',
    spec: {
      serverless: {
        cloud: config.cloud as 'aws' | 'gcp' | 'azure',
        region: config.region,
      },
    },
    waitUntilReady: true,
  });

  // Get the host URL for the newly created index
  const indexDescription = await pc.describeIndex(indexName);
  const host = indexDescription.host;

  if (!host) {
    throw new Error(`Index ${indexName} created but no host URL returned`);
  }

  return host;
}

/**
 * Provision a Pinecone index for an organization and store the host URL.
 * Idempotent — skips if org already has a pineconeHost.
 */
export async function provisionIndexForOrg(orgId: string, orgSlug: string): Promise<string | null> {
  // Check if org already has a Pinecone host
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { pineconeHost: true },
  });

  if (org?.pineconeHost) {
    return org.pineconeHost; // Already provisioned
  }

  const host = await createTenantIndex(orgSlug);

  // Store on the organization
  await prisma.organization.update({
    where: { id: orgId },
    data: { pineconeHost: host },
  });

  return host;
}

/**
 * Delete a tenant's Pinecone index (cleanup on org deletion).
 */
export async function deleteTenantIndex(orgSlug: string): Promise<void> {
  const pc = await getPineconeClient();
  const indexName = indexNameFromSlug(orgSlug);

  try {
    await pc.deleteIndex(indexName);
  } catch (error: any) {
    // Index may not exist (never provisioned or already deleted)
    if (error?.status === 404 || error?.message?.includes('not found')) {
      return;
    }
    throw error;
  }
}

/**
 * Get the host URL for an existing tenant index.
 */
export async function getTenantIndexHost(orgSlug: string): Promise<string | null> {
  const pc = await getPineconeClient();
  const indexName = indexNameFromSlug(orgSlug);

  try {
    const description = await pc.describeIndex(indexName);
    return description.host || null;
  } catch {
    return null;
  }
}
