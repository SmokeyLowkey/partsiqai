import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Each test uses a unique identifier to avoid cross-test interference
  });

  it('should allow requests under the limit', () => {
    const id = `test-${Date.now()}-allow`;
    const config = { limit: 3, windowSeconds: 60 };

    expect(checkRateLimit(id, config).success).toBe(true);
    expect(checkRateLimit(id, config).success).toBe(true);
    expect(checkRateLimit(id, config).success).toBe(true);
  });

  it('should block requests over the limit', () => {
    const id = `test-${Date.now()}-block`;
    const config = { limit: 2, windowSeconds: 60 };

    expect(checkRateLimit(id, config).success).toBe(true);
    expect(checkRateLimit(id, config).success).toBe(true);

    const result = checkRateLimit(id, config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(429);
    }
  });

  it('should track different identifiers independently', () => {
    const id1 = `test-${Date.now()}-a`;
    const id2 = `test-${Date.now()}-b`;
    const config = { limit: 1, windowSeconds: 60 };

    expect(checkRateLimit(id1, config).success).toBe(true);
    expect(checkRateLimit(id2, config).success).toBe(true);

    expect(checkRateLimit(id1, config).success).toBe(false);
    expect(checkRateLimit(id2, config).success).toBe(false);
  });
});
