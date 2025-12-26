/**
 * Test Setup for EnvSync Angular Application
 *
 * This file configures the testing environment for Vitest with Angular.
 * It sets up JSDOM, mocks for Tauri APIs, and common test utilities.
 */

import { vi } from 'vitest';
import 'zone.js';
import 'zone.js/testing';

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
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
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
const mockCrypto = {
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    generateKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    deriveKey: vi.fn(),
    deriveBits: vi.fn(),
    importKey: vi.fn(),
    exportKey: vi.fn(),
    digest: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  },
  randomUUID: vi.fn(() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  })),
};
Object.defineProperty(window, 'crypto', { value: mockCrypto });
Object.defineProperty(global, 'crypto', { value: mockCrypto });

// Export mocks for test access
export const mocks = {
  tauriInvoke: mockTauriInvoke,
  tauriListen: mockTauriListen,
  tauriEmit: mockTauriEmit,
  localStorage: localStorageMock,
  sessionStorage: sessionStorageMock,
  crypto: mockCrypto,
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
