/**
 * Test Setup for EnvSync Angular Application
 *
 * This file configures the testing environment for Vitest with Angular.
 * It sets up JSDOM, mocks for Tauri APIs, and common test utilities.
 */

import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import 'zone.js';
import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize Angular testing environment only once
const testBed = getTestBed();
if (!testBed.platform) {
  testBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
    { teardown: { destroyAfterEach: true } }
  );
}

// Mock window.matchMedia for components using media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
(globalThis as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(),
}));

// Mock Tauri API for desktop app testing
const mockTauriInvoke = vi.fn();
const mockTauriListen = vi.fn().mockReturnValue(Promise.resolve(() => {}));
const mockTauriEmit = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockTauriInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockTauriListen,
  emit: mockTauriEmit,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock crypto API for encryption testing
// Create a fake CryptoKey object
const mockCryptoKey = {
  algorithm: { name: 'AES-GCM', length: 256 },
  extractable: false,
  type: 'secret' as KeyType,
  usages: ['encrypt', 'decrypt'] as KeyUsage[],
};

const mockCrypto = {
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    generateKey: vi.fn().mockResolvedValue(mockCryptoKey),
    encrypt: vi.fn().mockImplementation(async (_algorithm: any, _key: any, data: ArrayBuffer) => {
      // Return encrypted data (just pass through for mock)
      return new Uint8Array(data).buffer;
    }),
    decrypt: vi.fn().mockImplementation(async (_algorithm: any, _key: any, data: ArrayBuffer) => {
      // Return decrypted data (just pass through for mock)
      return new Uint8Array(data).buffer;
    }),
    deriveKey: vi.fn().mockResolvedValue(mockCryptoKey),
    deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue(mockCryptoKey),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    digest: vi.fn().mockImplementation(async (_algorithm: string, data: ArrayBuffer) => {
      // Return a mock hash
      return new Uint8Array(32).buffer;
    }),
    sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
    verify: vi.fn().mockResolvedValue(true),
  },
  randomUUID: vi.fn(() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  })),
};
Object.defineProperty(window, 'crypto', { value: mockCrypto });
Object.defineProperty(globalThis, 'crypto', { value: mockCrypto });

// Export mocks for test access
export const mocks = {
  tauriInvoke: mockTauriInvoke,
  tauriListen: mockTauriListen,
  tauriEmit: mockTauriEmit,
  localStorage: localStorageMock,
  sessionStorage: sessionStorageMock,
  crypto: mockCrypto,
  cryptoKey: mockCryptoKey,
};

// Reset mocks and TestBed before each test
beforeEach(() => {
  TestBed.resetTestingModule();
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
