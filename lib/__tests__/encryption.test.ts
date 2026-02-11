import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, maskApiKey, validateEncryption } from '../encryption';

describe('Encryption Utilities', () => {
  // Ensure CREDENTIALS_ENCRYPTION_KEY is set for tests
  beforeAll(() => {
    if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
      process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-secret-key-must-be-at-least-32-characters-long';
    }
  });

  describe('encrypt', () => {
    it('should encrypt a plain text string', () => {
      const plaintext = 'sk_test_1234567890abcdef';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(plaintext.length);
    });

    it('should produce different output for same input (random IV)', () => {
      const plaintext = 'sk_test_1234567890abcdef';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error on empty string', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty string');
    });

    it('should handle special characters', () => {
      const plaintext = 'Test!@#$%^&*()_+{}[]|:";\'<>?,./';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text back to original', () => {
      const plaintext = 'sk_test_1234567890abcdef';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long API keys', () => {
      const longKey = 'sk_test_' + 'a'.repeat(200);
      const encrypted = encrypt(longKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(longKey);
    });

    it('should throw error on invalid encrypted data', () => {
      expect(() => decrypt('invalid-encrypted-data')).toThrow();
    });

    it('should throw error on corrupted data', () => {
      const plaintext = 'sk_test_1234567890abcdef';
      const encrypted = encrypt(plaintext);
      const corrupted = encrypted.slice(0, -10) + 'x'.repeat(10);

      expect(() => decrypt(corrupted)).toThrow();
    });
  });

  describe('maskApiKey', () => {
    it('should mask keys showing first 4 and last 4 characters', () => {
      const key = 'sk_abc123def456ghi789';
      const masked = maskApiKey(key);

      // With 21 chars: first 4 + min(12, 21-8) + last 4 = 'sk_a' + 12*'*' + 'i789'
      expect(masked).toBe('sk_a************i789');
      expect(masked.length).toBeLessThan(key.length);
    });

    it('should handle short keys gracefully', () => {
      // Keys < 8 chars return '****'
      expect(maskApiKey('abc')).toBe('****');
      expect(maskApiKey('ab')).toBe('****');
      expect(maskApiKey('a')).toBe('****');
    });

    it('should handle empty or null keys', () => {
      expect(maskApiKey('')).toBe('****');
      expect(maskApiKey(null as any)).toBe('****');
    });

    it('should mask keys of exactly 8 characters', () => {
      const key = 'abcdefgh';
      const masked = maskApiKey(key);
      // With 8 chars: first 4 + min(12, 0) + last 4 = 'abcd' + '' + 'efgh'
      expect(masked).toBe('abcdefgh');
    });
  });

  describe('validateEncryption', () => {
    it('should return true for successful roundtrip', () => {
      const testString = 'sk_test_validation_key_12345';
      const result = validateEncryption(testString);

      expect(result).toBe(true);
    });

    it('should validate with different strings', () => {
      expect(validateEncryption('test1')).toBe(true);
      expect(validateEncryption('test2')).toBe(true);
      // Empty string throws error in encrypt, so validation returns false
      expect(validateEncryption('')).toBe(false);
    });
  });

  describe('Encryption roundtrip with various data types', () => {
    it('should handle multiline strings', () => {
      const multiline = 'Line 1\nLine 2\nLine 3';
      const encrypted = encrypt(multiline);
      expect(decrypt(encrypted)).toBe(multiline);
    });

    it('should handle unicode characters', () => {
      const unicode = '🔐 Secret Key 密钥 🔑';
      const encrypted = encrypt(unicode);
      expect(decrypt(encrypted)).toBe(unicode);
    });

    it('should handle very long strings', () => {
      const longString = 'x'.repeat(10000);
      const encrypted = encrypt(longString);
      expect(decrypt(encrypted)).toBe(longString);
    });
  });
});
