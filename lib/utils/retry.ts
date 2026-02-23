export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Default shouldRetry: retry on network errors, 429, 500, 502, 503, 504.
 * Do NOT retry on 400, 401, 403, 404 (client errors).
 */
function defaultShouldRetry(error: any): boolean {
  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    error.message?.includes('fetch failed')
  ) {
    return true;
  }

  const status = error.status || error.statusCode || error.response?.status;
  if (status) {
    return [429, 500, 502, 503, 504].includes(status);
  }

  if (error.type === 'server_error' || error.type === 'rate_limit_error') {
    return true;
  }

  return false;
}

/**
 * Execute an async function with exponential backoff retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry || defaultShouldRetry;

  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const baseDelay = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt);
      const jitter = Math.random() * opts.initialDelayMs * 0.5;
      const delayMs = Math.min(baseDelay + jitter, opts.maxDelayMs);

      opts.onRetry?.(attempt + 1, error, delayMs);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
