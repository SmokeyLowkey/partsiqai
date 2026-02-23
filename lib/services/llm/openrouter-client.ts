import OpenAI from 'openai';
import { credentialsManager } from '../credentials/credentials-manager';
import { withRetry } from '@/lib/utils/retry';
import { withTimeout } from '@/lib/utils/timeout';

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export class OpenRouterClient {
  private client: OpenAI;
  private defaultModel: string;
  private voiceModel: string;
  private overseerModel: string;

  private constructor(apiKey: string, defaultModel?: string, voiceModel?: string, overseerModel?: string) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'PartsIQ',
      },
    });
    this.defaultModel = defaultModel || 'anthropic/claude-3.5-sonnet';
    this.voiceModel = voiceModel || 'openai/gpt-4o';
    this.overseerModel = overseerModel || this.defaultModel;
  }

  /**
   * Get the configured voice model (sub-300ms inference for real-time calls).
   * Per procurement architecture: GPT-4o recommended for unpredictable supplier conversations.
   */
  getVoiceModel(): string {
    return this.voiceModel;
  }

  /**
   * Get the configured overseer model (async analysis, no latency constraint).
   * Falls back to defaultModel when not explicitly configured.
   */
  getOverseerModel(): string {
    return this.overseerModel;
  }

  /**
   * Create OpenRouterClient from organization's stored credentials
   */
  static async fromOrganization(organizationId: string): Promise<OpenRouterClient> {
    const credentials = await credentialsManager.getCredentialsWithFallback<{
      apiKey: string;
      defaultModel?: string;
      voiceModel?: string;
      overseerModel?: string;
    }>(organizationId, 'OPENROUTER');

    if (!credentials) {
      throw new Error('OpenRouter credentials not configured for this organization');
    }

    return new OpenRouterClient(credentials.apiKey, credentials.defaultModel, credentials.voiceModel, credentials.overseerModel);
  }

  async generateCompletion(
    prompt: string,
    options?: CompletionOptions & { model?: string }
  ): Promise<string> {
    return withRetry(
      () => withTimeout(async () => {
        const response = await this.client.chat.completions.create({
          model: options?.model || this.defaultModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2000,
          stop: options?.stop,
          top_p: options?.topP,
          frequency_penalty: options?.frequencyPenalty,
          presence_penalty: options?.presencePenalty,
        });

        return response.choices[0].message.content || '';
      }, 10_000, 'generateCompletion'),
      { maxRetries: 2 }
    );
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    options?: CompletionOptions & { model?: string }
  ): Promise<T> {
    return withRetry(
      () => withTimeout(async () => {
        const response = await this.client.chat.completions.create({
          model: options?.model || this.defaultModel,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that extracts structured data from text and outputs valid JSON. Always respond with valid JSON that can be parsed. If you cannot find certain information, use null for that field.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 4000,
          response_format: { type: 'json_object' } as any,
        });

        const content = response.choices[0].message.content || '{}';
        console.log('LLM response length:', content.length);

        const parsed = JSON.parse(content);

        if (schema && typeof schema.safeParse === 'function') {
          const result = schema.safeParse(parsed);
          if (!result.success) {
            console.warn('Schema validation warning:', result.error.message);
          } else {
            return result.data as T;
          }
        }

        return parsed as T;
      }, 15_000, 'generateStructuredOutput'),
      { maxRetries: 2 }
    );
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: CompletionOptions & { model?: string }
  ): Promise<string> {
    return withRetry(
      () => withTimeout(async () => {
        const response = await this.client.chat.completions.create({
          model: options?.model || this.defaultModel,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2000,
          stop: options?.stop,
          top_p: options?.topP,
          frequency_penalty: options?.frequencyPenalty,
          presence_penalty: options?.presencePenalty,
        });

        return response.choices[0].message.content || '';
      }, 10_000, 'chat'),
      { maxRetries: 2 }
    );
  }

  /**
   * Stream a completion (useful for real-time chat interfaces)
   */
  async *streamCompletion(
    prompt: string,
    options?: CompletionOptions & { model?: string }
  ): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      console.error('OpenRouter streaming error:', error);
      throw new Error(`Streaming completion failed: ${error.message}`);
    }
  }

  /**
   * Stream a chat completion with full messages array (for voice agent streaming).
   * Yields tokens as they arrive from the LLM.
   */
  async *streamChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: CompletionOptions & { model?: string }
  ): AsyncGenerator<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
        stream: true,
        stop: options?.stop,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      console.error('OpenRouter streaming chat error:', error);
      throw new Error(`Streaming chat failed: ${error.message}`);
    }
  }
}
