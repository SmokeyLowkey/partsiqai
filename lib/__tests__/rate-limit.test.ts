import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  it('should allow requests under the limit', async () => {
    const id = `test-${Date.now()}-allow`;
    const config = { limit: 3, windowSeconds: 60 };

    expect((await checkRateLimit(id, config)).success).toBe(true);
    expect((await checkRateLimit(id, config)).success).toBe(true);
    expect((await checkRateLimit(id, config)).success).toBe(true);
  });

  it('should block requests over the limit', async () => {
    const id = `test-${Date.now()}-block`;
    const config = { limit: 2, windowSeconds: 60 };

    expect((await checkRateLimit(id, config)).success).toBe(true);
    expect((await checkRateLimit(id, config)).success).toBe(true);

    const result = await checkRateLimit(id, config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(429);
    }
  });

  it('should track different identifiers independently', async () => {
    const id1 = `test-${Date.now()}-a`;
    const id2 = `test-${Date.now()}-b`;
    const config = { limit: 1, windowSeconds: 60 };

    expect((await checkRateLimit(id1, config)).success).toBe(true);
    expect((await checkRateLimit(id2, config)).success).toBe(true);

    expect((await checkRateLimit(id1, config)).success).toBe(false);
    expect((await checkRateLimit(id2, config)).success).toBe(false);
  });
});
