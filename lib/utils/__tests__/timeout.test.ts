import { describe, it, expect } from 'vitest';
import { withTimeout, TimeoutError } from '../timeout';

describe('withTimeout', () => {
  it('should return result when function completes within timeout', async () => {
    const result = await withTimeout(() => Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('should throw TimeoutError when function exceeds timeout', async () => {
    const slowFn = () => new Promise(resolve => setTimeout(resolve, 5000));
    await expect(withTimeout(slowFn, 50, 'test op')).rejects.toThrow(TimeoutError);
    await expect(withTimeout(slowFn, 50, 'test op')).rejects.toThrow('test op timed out after 50ms');
  });

  it('should propagate function errors (not wrap in TimeoutError)', async () => {
    const failFn = () => Promise.reject(new Error('boom'));
    await expect(withTimeout(failFn, 1000)).rejects.toThrow('boom');
  });
});
