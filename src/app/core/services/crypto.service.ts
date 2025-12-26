/**
 * EnvSync Crypto Service
 * Client-side encryption/decryption using Web Crypto API
 */
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private masterKey: CryptoKey | null = null;
  private salt: Uint8Array | null = null;

  /**
   * Initialize encryption with a master password
   */
  async initialize(password: string, saltBase64?: string): Promise<string> {
    // Generate or decode salt
    if (saltBase64) {
      this.salt = this.base64ToBytes(saltBase64);
    } else {
      this.salt = crypto.getRandomValues(new Uint8Array(16));
    }

    // Derive key from password
    this.masterKey = await this.deriveKey(password, this.salt);

    return this.bytesToBase64(this.salt);
  }

  /**
   * Check if crypto is initialized
   */
  isInitialized(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Clear the master key (lock the vault)
   */
  lock(): void {
    this.masterKey = null;
    this.salt = null;
  }

  /**
   * Derive an AES-GCM key from password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a string value
   * Returns { ciphertext, nonce } both as base64
   */
  async encrypt(plaintext: string): Promise<{ ciphertext: string; nonce: string }> {
    if (!this.masterKey) {
      throw new Error('Crypto not initialized');
    }

    // Generate random nonce (96 bits for GCM)
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
      },
      this.masterKey,
      new TextEncoder().encode(plaintext)
    );

    return {
      ciphertext: this.bytesToBase64(new Uint8Array(ciphertext)),
      nonce: this.bytesToBase64(nonce),
    };
  }

  /**
   * Decrypt a value
   */
  async decrypt(ciphertextBase64: string, nonceBase64: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Crypto not initialized');
    }

    const ciphertext = this.base64ToBytes(ciphertextBase64);
    const nonce = this.base64ToBytes(nonceBase64);

    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
        },
        this.masterKey,
        ciphertext
      );

      return new TextDecoder().decode(plaintext);
    } catch (error) {
      throw new Error('Decryption failed - incorrect password or corrupted data');
    }
  }

  /**
   * Encrypt multiple values
   */
  async encryptBatch(values: { key: string; value: string }[]): Promise<
    { key: string; ciphertext: string; nonce: string }[]
  > {
    const results = [];
    for (const item of values) {
      const { ciphertext, nonce } = await this.encrypt(item.value);
      results.push({ key: item.key, ciphertext, nonce });
    }
    return results;
  }

  /**
   * Generate a random salt as base64
   */
  generateSalt(): string {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return this.bytesToBase64(salt);
  }

  /**
   * Hash a password for verification (not for storage)
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.bytesToBase64(new Uint8Array(hash));
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
