import OpenAI from 'openai';
import { credentialsManager } from '../credentials/credentials-manager';

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
    try {
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
    } catch (error: any) {
      console.error('OpenRouter API error:', error);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    options?: CompletionOptions & { model?: string }
  ): Promise<T> {
    try {
      // The prompt should already contain the JSON structure we want
      // Don't try to stringify Zod schemas - they don't serialize properly
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
        temperature: options?.temperature ?? 0.2, // Lower temp for structured output
        max_tokens: options?.maxTokens ?? 4000,
        response_format: { type: 'json_object' } as any,
      });

      const content = response.choices[0].message.content || '{}';
      console.log('LLM response length:', content.length);

      // Parse JSON
      const parsed = JSON.parse(content);

      // If schema has a safeParse method (Zod), use it to validate
      if (schema && typeof schema.safeParse === 'function') {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          console.warn('Schema validation warning:', result.error.message);
          // Return parsed data even if validation fails - we'll handle partial data
        } else {
          return result.data as T;
        }
      }

      return parsed as T;
    } catch (error: any) {
      console.error('OpenRouter structured output error:', error);
      throw new Error(`Structured LLM generation failed: ${error.message}`);
    }
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: CompletionOptions & { model?: string }
  ): Promise<string> {
    try {
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
    } catch (error: any) {
      console.error('OpenRouter chat error:', error);
      throw new Error(`Chat completion failed: ${error.message}`);
    }
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
