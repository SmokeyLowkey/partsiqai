import { credentialsManager } from '../credentials/credentials-manager';
import type { PartIngestionRecord, PhaseResult, ValidationError } from './types';
import type { Logger } from 'pino';

const EMBED_BATCH_SIZE = 20; // Pinecone embed API batch limit
const UPSERT_BATCH_SIZE = 100; // Pinecone upsert batch limit
const API_VERSION = '2025-04';

interface EmbedResponse {
  data: Array<{
    values?: number[];
    sparse_indices?: number[];
    sparse_values?: number[];
  }>;
}

/**
 * Generate embeddings and upsert vectors into Pinecone.
 * Uses the same REST API and models as the search agent for consistency.
 */
export async function ingestToPinecone(
  records: PartIngestionRecord[],
  organizationId: string,
  onProgress: (processed: number) => void,
  logger: Logger
): Promise<PhaseResult> {
  const credentials = await credentialsManager.getCredentials<{
    apiKey: string;
    host: string;
  }>(organizationId, 'PINECONE');

  if (!credentials || !credentials.host) {
    throw new Error('Pinecone credentials not configured for this organization');
  }

  const apiKey = credentials.apiKey;
  const host = credentials.host.startsWith('https://') ? credentials.host : `https://${credentials.host}`;

  let success = 0;
  let failed = 0;
  const errors: ValidationError[] = [];

  // Process in embedding batch sizes
  for (let i = 0; i < records.length; i += EMBED_BATCH_SIZE) {
    const batch = records.slice(i, i + EMBED_BATCH_SIZE);

    try {
      // Build text for embedding (same composition used by search agent)
      const texts = batch.map((r) =>
        [r.partTitle, r.manufacturer, r.machineModel, r.categoryBreadcrumb, r.diagramTitle, r.remarks]
          .filter(Boolean)
          .join(' ')
      );

      // Generate dense embeddings (input_type: 'passage' for indexing)
      const denseResponse = await fetchEmbed(apiKey, 'llama-text-embed-v2', texts, 'passage');
      if (!denseResponse?.data || denseResponse.data.length !== texts.length) {
        throw new Error(`Dense embedding returned ${denseResponse?.data?.length ?? 0} results for ${texts.length} inputs`);
      }

      // Generate sparse embeddings
      const sparseResponse = await fetchEmbed(apiKey, 'pinecone-sparse-english-v0', texts, 'passage');

      // Build upsert vectors
      const vectors: any[] = [];
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const dense = denseResponse.data[j];

        if (!dense?.values || dense.values.length === 0) {
          errors.push({
            row: i + j + 1,
            field: 'pinecone',
            message: 'Failed to generate dense embedding',
            value: record.partNumber,
          });
          failed++;
          continue;
        }

        const namespace = record.namespace || 'default';
        const vectorId = `${namespace}_${record.partNumber}`.replace(/[^a-zA-Z0-9_-]/g, '_');

        const vector: any = {
          id: vectorId,
          values: dense.values,
          metadata: {
            part_number: record.partNumber,
            part_title: record.partTitle,
            machine_model: record.machineModel,
            manufacturer: record.manufacturer,
            namespace: record.namespace || undefined,
            category_breadcrumb: record.categoryBreadcrumb || undefined,
            diagram_title: record.diagramTitle || undefined,
            serial_number_range: record.serialNumberRange || undefined,
            technical_domain: record.technicalDomain || undefined,
            quantity: record.quantity || undefined,
            remarks: record.remarks || undefined,
            source_url: record.sourceUrl || undefined,
            part_key: record.partKey || undefined,
            text: texts[j],
          },
        };

        // Add sparse vector if available
        const sparse = sparseResponse?.data?.[j];
        if (sparse?.sparse_indices && sparse?.sparse_values) {
          vector.sparseValues = {
            indices: sparse.sparse_indices,
            values: sparse.sparse_values,
          };
        }

        // Remove undefined metadata values (Pinecone doesn't accept them)
        for (const key of Object.keys(vector.metadata)) {
          if (vector.metadata[key] === undefined) {
            delete vector.metadata[key];
          }
        }

        vectors.push(vector);
      }

      // Upsert vectors in sub-batches
      for (let k = 0; k < vectors.length; k += UPSERT_BATCH_SIZE) {
        const upsertBatch = vectors.slice(k, k + UPSERT_BATCH_SIZE);
        const namespace = batch[0].namespace || '';

        const response = await fetch(`${host}/vectors/upsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': apiKey,
            'X-Pinecone-API-Version': API_VERSION,
          },
          body: JSON.stringify({
            vectors: upsertBatch,
            namespace,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Pinecone upsert failed: ${response.status} ${errorText}`);
        }

        success += upsertBatch.length;
      }
    } catch (error: any) {
      // If the entire batch fails, mark all records as failed
      for (let j = 0; j < batch.length; j++) {
        errors.push({
          row: i + j + 1,
          field: 'pinecone',
          message: error.message,
          value: batch[j].partNumber,
        });
      }
      failed += batch.length;
      logger.error({ err: error, batchStart: i }, 'Pinecone batch ingestion failed');
    }

    onProgress(i + batch.length);
  }

  logger.info({ success, failed }, 'Pinecone ingestion complete');
  return { success, failed, errors };
}

async function fetchEmbed(
  apiKey: string,
  model: string,
  texts: string[],
  inputType: 'passage' | 'query'
): Promise<EmbedResponse> {
  const response = await fetch('https://api.pinecone.io/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'X-Pinecone-API-Version': API_VERSION,
    },
    body: JSON.stringify({
      model,
      parameters: {
        input_type: inputType,
        truncate: 'END',
      },
      inputs: texts.map((text) => ({ text })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinecone embed API failed (${model}): ${response.status} ${errorText}`);
  }

  return response.json();
}
