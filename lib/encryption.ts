/**
 * Encryption Utility for API Keys
 * 
 * Uses AES-256-GCM encryption for storing sensitive API keys
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  
  if (!secret) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY environment variable is not set');
  }
  
  if (secret.length < 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters long');
  }
  
  // Derive a key from the secret using PBKDF2
  const salt = Buffer.from('partsiq-api-key-salt'); // Static salt for key derivation
  return crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext string (e.g., API key)
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine iv + encrypted + authTag and encode as base64
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt an encrypted string back to plaintext
 * @param encryptedData - base64-encoded encrypted data with IV and auth tag
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty string');
  }
  
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract iv, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Validate that an API key can be encrypted and decrypted properly
 */
export function validateEncryption(plaintext: string): boolean {
  try {
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    return decrypted === plaintext;
  } catch (error) {
    return false;
  }
}

/**
 * Mask an API key for display (shows first 4 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '****';
  }
  
  const first = apiKey.substring(0, 4);
  const last = apiKey.substring(apiKey.length - 4);
  const masked = '*'.repeat(Math.min(12, apiKey.length - 8));
  
  return `${first}${masked}${last}`;
}
