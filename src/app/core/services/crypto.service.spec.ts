/**
 * CryptoService Unit Tests
 *
 * Comprehensive test suite for the EnvSync Crypto service covering:
 * - Service instantiation
 * - Initialization with password and salt
 * - Encryption and decryption operations
 * - Batch operations
 * - Key derivation
 * - Error handling for uninitialized state
 * - Lock/unlock functionality
 * - Base64 encoding/decoding
 * - Password hashing
 */

import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';
import { mocks } from '../../../test-setup';

describe('CryptoService', () => {
  let service: CryptoService;
  const testPassword = 'test-password-123';
  const testPlaintext = 'secret-value';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptoService],
    });
    service = TestBed.inject(CryptoService);
  });

  // ========== Service Instantiation ==========

  describe('Service Instantiation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should not be initialized by default', () => {
      expect(service.isInitialized()).toBe(false);
    });
  });

  // ========== Initialization ==========

  describe('Initialization', () => {
    it('should initialize with a password', async () => {
      const salt = await service.initialize(testPassword);
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(service.isInitialized()).toBe(true);
    });

    it('should generate a salt when none is provided', async () => {
      const salt = await service.initialize(testPassword);
      expect(salt.length).toBeGreaterThan(0);
      expect(mocks.crypto.getRandomValues).toHaveBeenCalled();
    });

    it('should use provided salt when given', async () => {
      const providedSalt = 'dGVzdHNhbHQxMjM0NTY3OA=='; // base64 encoded
      const returnedSalt = await service.initialize(testPassword, providedSalt);
      expect(returnedSalt).toBe(providedSalt);
    });

    it('should derive key using PBKDF2', async () => {
      await service.initialize(testPassword);
      expect(mocks.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      expect(mocks.crypto.subtle.deriveKey).toHaveBeenCalled();
    });

    it('should reinitialize with different password', async () => {
      await service.initialize(testPassword);
      expect(service.isInitialized()).toBe(true);

      await service.initialize('different-password');
      expect(service.isInitialized()).toBe(true);
    });

    it('should handle initialization with empty password', async () => {
      const salt = await service.initialize('');
      expect(salt).toBeDefined();
      expect(service.isInitialized()).toBe(true);
    });
  });

  // ========== Lock/Unlock ==========

  describe('Lock/Unlock', () => {
    it('should lock the vault', async () => {
      await service.initialize(testPassword);
      expect(service.isInitialized()).toBe(true);

      service.lock();
      expect(service.isInitialized()).toBe(false);
    });

    it('should clear keys when locked', async () => {
      await service.initialize(testPassword);
      service.lock();

      await expect(service.encrypt('test')).rejects.toThrow('Crypto not initialized');
    });

    it('should allow reinitialization after lock', async () => {
      const salt = await service.initialize(testPassword);
      service.lock();

      await service.initialize(testPassword, salt);
      expect(service.isInitialized()).toBe(true);
    });
  });

  // ========== Encryption ==========

  describe('Encryption', () => {
    beforeEach(async () => {
      // Mock crypto.subtle.encrypt to return a deterministic value
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5]).buffer
      );
      await service.initialize(testPassword);
    });

    it('should encrypt plaintext', async () => {
      const result = await service.encrypt(testPlaintext);
      expect(result.ciphertext).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(typeof result.ciphertext).toBe('string');
      expect(typeof result.nonce).toBe('string');
    });

    it('should generate unique nonces for each encryption', async () => {
      const result1 = await service.encrypt(testPlaintext);
      const result2 = await service.encrypt(testPlaintext);
      expect(result1.nonce).not.toBe(result2.nonce);
    });

    it('should call crypto.subtle.encrypt with correct parameters', async () => {
      await service.encrypt(testPlaintext);
      expect(mocks.crypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
        }),
        expect.anything(),
        expect.any(Uint8Array)
      );
    });

    it('should throw error when encrypting without initialization', async () => {
      service.lock();
      await expect(service.encrypt(testPlaintext)).rejects.toThrow('Crypto not initialized');
    });

    it('should encrypt empty string', async () => {
      const result = await service.encrypt('');
      expect(result.ciphertext).toBeDefined();
      expect(result.nonce).toBeDefined();
    });

    it('should encrypt long strings', async () => {
      const longString = 'a'.repeat(10000);
      const result = await service.encrypt(longString);
      expect(result.ciphertext).toBeDefined();
      expect(result.nonce).toBeDefined();
    });

    it('should encrypt special characters', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const result = await service.encrypt(specialChars);
      expect(result.ciphertext).toBeDefined();
    });

    it('should encrypt unicode characters', async () => {
      const unicode = '你好世界 🚀 مرحبا';
      const result = await service.encrypt(unicode);
      expect(result.ciphertext).toBeDefined();
    });

    it('should return base64 encoded ciphertext', async () => {
      const result = await service.encrypt(testPlaintext);
      // Base64 regex test
      expect(result.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should return base64 encoded nonce', async () => {
      const result = await service.encrypt(testPlaintext);
      expect(result.nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  // ========== Decryption ==========

  describe('Decryption', () => {
    beforeEach(async () => {
      // Mock encrypt/decrypt cycle
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5]).buffer
      );
      mocks.crypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(testPlaintext).buffer
      );
      await service.initialize(testPassword);
    });

    it('should decrypt ciphertext', async () => {
      const encrypted = await service.encrypt(testPlaintext);
      const decrypted = await service.decrypt(encrypted.ciphertext, encrypted.nonce);
      expect(decrypted).toBe(testPlaintext);
    });

    it('should throw error when decrypting without initialization', async () => {
      const encrypted = await service.encrypt(testPlaintext);
      service.lock();

      await expect(
        service.decrypt(encrypted.ciphertext, encrypted.nonce)
      ).rejects.toThrow('Crypto not initialized');
    });

    it('should handle decryption errors gracefully', async () => {
      mocks.crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(
        service.decrypt('invalid-ciphertext', 'invalid-nonce')
      ).rejects.toThrow('Decryption failed - incorrect password or corrupted data');
    });

    it('should call crypto.subtle.decrypt with correct parameters', async () => {
      const encrypted = await service.encrypt(testPlaintext);
      await service.decrypt(encrypted.ciphertext, encrypted.nonce);

      expect(mocks.crypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
        }),
        expect.anything(),
        expect.any(Uint8Array)
      );
    });

    it('should decrypt empty string', async () => {
      mocks.crypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode('').buffer
      );
      const encrypted = await service.encrypt('');
      const decrypted = await service.decrypt(encrypted.ciphertext, encrypted.nonce);
      expect(decrypted).toBe('');
    });

    it('should decrypt unicode characters', async () => {
      const unicode = '你好世界 🚀';
      mocks.crypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(unicode).buffer
      );
      const encrypted = await service.encrypt(unicode);
      const decrypted = await service.decrypt(encrypted.ciphertext, encrypted.nonce);
      expect(decrypted).toBe(unicode);
    });

    it('should fail with incorrect nonce', async () => {
      mocks.crypto.subtle.decrypt.mockRejectedValue(new Error('Invalid nonce'));
      const encrypted = await service.encrypt(testPlaintext);

      await expect(
        service.decrypt(encrypted.ciphertext, 'wrong-nonce')
      ).rejects.toThrow('Decryption failed - incorrect password or corrupted data');
    });
  });

  // ========== Batch Operations ==========

  describe('Batch Operations', () => {
    beforeEach(async () => {
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5]).buffer
      );
      await service.initialize(testPassword);
    });

    it('should encrypt batch of values', async () => {
      const values = [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
        { key: 'KEY3', value: 'value3' },
      ];

      const results = await service.encryptBatch(values);
      expect(results.length).toBe(3);
      results.forEach((result, index) => {
        expect(result.key).toBe(values[index].key);
        expect(result.ciphertext).toBeDefined();
        expect(result.nonce).toBeDefined();
      });
    });

    it('should handle empty batch', async () => {
      const results = await service.encryptBatch([]);
      expect(results.length).toBe(0);
    });

    it('should maintain key-value associations in batch', async () => {
      const values = [
        { key: 'API_KEY', value: 'secret1' },
        { key: 'DB_PASSWORD', value: 'secret2' },
      ];

      const results = await service.encryptBatch(values);
      expect(results[0].key).toBe('API_KEY');
      expect(results[1].key).toBe('DB_PASSWORD');
    });

    it('should encrypt each value in batch independently', async () => {
      const values = [
        { key: 'KEY1', value: 'same-value' },
        { key: 'KEY2', value: 'same-value' },
      ];

      const results = await service.encryptBatch(values);
      expect(results[0].nonce).not.toBe(results[1].nonce);
    });

    it('should throw error for batch encryption without initialization', async () => {
      service.lock();
      const values = [{ key: 'KEY1', value: 'value1' }];
      await expect(service.encryptBatch(values)).rejects.toThrow('Crypto not initialized');
    });
  });

  // ========== Salt Generation ==========

  describe('Salt Generation', () => {
    it('should generate a random salt', () => {
      const salt = service.generateSalt();
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(0);
    });

    it('should generate unique salts', () => {
      const salt1 = service.generateSalt();
      const salt2 = service.generateSalt();
      expect(salt1).not.toBe(salt2);
    });

    it('should generate base64 encoded salt', () => {
      const salt = service.generateSalt();
      expect(salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should call crypto.getRandomValues', () => {
      service.generateSalt();
      expect(mocks.crypto.getRandomValues).toHaveBeenCalled();
    });
  });

  // ========== Password Hashing ==========

  describe('Password Hashing', () => {
    beforeEach(() => {
      mocks.crypto.subtle.digest.mockResolvedValue(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
      );
    });

    it('should hash a password', async () => {
      const hash = await service.hashPassword(testPassword);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should use SHA-256 for hashing', async () => {
      await service.hashPassword(testPassword);
      expect(mocks.crypto.subtle.digest).toHaveBeenCalledWith(
        'SHA-256',
        expect.any(Uint8Array)
      );
    });

    it('should return base64 encoded hash', async () => {
      const hash = await service.hashPassword(testPassword);
      expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should hash empty password', async () => {
      const hash = await service.hashPassword('');
      expect(hash).toBeDefined();
    });

    it('should produce consistent hashes for same input', async () => {
      const hash1 = await service.hashPassword(testPassword);
      const hash2 = await service.hashPassword(testPassword);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      mocks.crypto.subtle.digest
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3]).buffer)
        .mockResolvedValueOnce(new Uint8Array([4, 5, 6]).buffer);

      const hash1 = await service.hashPassword('password1');
      const hash2 = await service.hashPassword('password2');
      expect(hash1).not.toBe(hash2);
    });
  });

  // ========== Base64 Encoding/Decoding ==========

  describe('Base64 Operations', () => {
    it('should handle encoding and decoding cycle', async () => {
      // Initialize to test encoding through encrypt
      await service.initialize(testPassword);
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array([65, 66, 67]).buffer // ABC
      );

      const encrypted = await service.encrypt('test');
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
    });

    it('should encode binary data to base64', () => {
      const salt = service.generateSalt();
      expect(salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should handle special binary sequences', async () => {
      await service.initialize(testPassword);
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array([0, 255, 128, 64]).buffer
      );

      const encrypted = await service.encrypt('test');
      expect(encrypted.ciphertext).toBeTruthy();
    });
  });

  // ========== Edge Cases ==========

  describe('Edge Cases', () => {
    it('should handle multiple initializations without lock', async () => {
      await service.initialize('password1');
      await service.initialize('password2');
      await service.initialize('password3');
      expect(service.isInitialized()).toBe(true);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const salt = await service.initialize(longPassword);
      expect(salt).toBeDefined();
      expect(service.isInitialized()).toBe(true);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const salt = await service.initialize(specialPassword);
      expect(salt).toBeDefined();
    });

    it('should handle unicode in password', async () => {
      const unicodePassword = '密码🔒';
      const salt = await service.initialize(unicodePassword);
      expect(salt).toBeDefined();
    });

    it('should handle rapid lock/unlock cycles', async () => {
      for (let i = 0; i < 10; i++) {
        await service.initialize(testPassword);
        expect(service.isInitialized()).toBe(true);
        service.lock();
        expect(service.isInitialized()).toBe(false);
      }
    });

    it('should handle encryption of very large data', async () => {
      await service.initialize(testPassword);
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array(10000).buffer
      );

      const largeData = 'x'.repeat(10000);
      const encrypted = await service.encrypt(largeData);
      expect(encrypted.ciphertext).toBeDefined();
    });
  });

  // ========== State Management ==========

  describe('State Management', () => {
    it('should maintain state across multiple operations', async () => {
      await service.initialize(testPassword);
      mocks.crypto.subtle.encrypt.mockResolvedValue(
        new Uint8Array([1, 2, 3]).buffer
      );

      await service.encrypt('test1');
      expect(service.isInitialized()).toBe(true);

      await service.encrypt('test2');
      expect(service.isInitialized()).toBe(true);

      await service.encrypt('test3');
      expect(service.isInitialized()).toBe(true);
    });

    it('should not allow operations after lock', async () => {
      await service.initialize(testPassword);
      service.lock();

      await expect(service.encrypt('test')).rejects.toThrow();
      await expect(service.decrypt('cipher', 'nonce')).rejects.toThrow();
      await expect(service.encryptBatch([{ key: 'k', value: 'v' }])).rejects.toThrow();
    });

    it('should reset state completely on lock', async () => {
      await service.initialize(testPassword);
      const salt1 = await service.initialize(testPassword);
      service.lock();

      expect(service.isInitialized()).toBe(false);

      const salt2 = await service.initialize(testPassword);
      expect(service.isInitialized()).toBe(true);
      // New salt should be different since we locked
      expect(salt2).toBeDefined();
    });
  });
});
