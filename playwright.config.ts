import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for EnvSync
 *
 * Supports multiple test types:
 * - E2E tests for web app
 * - Smoke tests for quick validation
 * - Visual regression tests
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    // Smoke tests - quick validation
    {
      name: 'smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
      timeout: 30000,
    },

    // E2E tests - full feature testing
    {
      name: 'e2e-chromium',
      testMatch: /.*\.e2e\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'e2e-firefox',
      testMatch: /.*\.e2e\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'e2e-webkit',
      testMatch: /.*\.e2e\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
      },
    },

    // Mobile E2E tests
    {
      name: 'mobile-chrome',
      testMatch: /.*\.mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'mobile-safari',
      testMatch: /.*\.mobile\.spec\.ts/,
      use: {
        ...devices['iPhone 12'],
      },
    },

    // Visual regression tests
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // API tests
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:8000',
      },
    },

    // Integration tests with backend
    {
      name: 'integration',
      testMatch: /.*\.integration\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4200',
      },
    },
  ],

  // Web server configuration for development
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120000,
    },
    {
      command: 'cd backend && uvicorn app.main:app --port 8000',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env['CI'],
      timeout: 60000,
      ignoreHTTPSErrors: true,
    },
  ],

  // Global timeout
  timeout: 60000,

  // Expect options
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixels: 50,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  // Output options
  outputDir: 'test-results',

  // Metadata
  metadata: {
    project: 'EnvSync',
    environment: process.env['CI'] ? 'ci' : 'local',
  },
});
