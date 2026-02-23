import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../retry';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable errors (4xx)', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 404 });
    await expect(withRetry(fn, { maxRetries: 3, initialDelayMs: 10 }))
      .rejects.toMatchObject({ status: 404 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 500 });
    await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10 }))
      .rejects.toMatchObject({ status: 500 });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should call onRetry hook with attempt info', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok');
    await withRetry(fn, { maxRetries: 2, initialDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.anything(), expect.any(Number));
  });

  it('should retry on network errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 2, initialDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use custom shouldRetry predicate', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ custom: true })
      .mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 10,
      shouldRetry: (err) => err.custom === true,
    });
    expect(result).toBe('ok');
  });
});
