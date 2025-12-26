/**
 * EnvSync E2E Test Utilities
 *
 * Common helper functions for E2E testing.
 */

import { Page, BrowserContext, expect } from '@playwright/test';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Wait for network to be idle (no pending requests)
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for all animations to complete
 */
export async function waitForAnimations(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const checkAnimations = () => {
        const animations = document.getAnimations();
        if (animations.length === 0) {
          resolve();
        } else {
          requestAnimationFrame(checkAnimations);
        }
      };
      checkAnimations();
    });
  });
}

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Create a temporary .env file for testing
 */
export async function createTempEnvFile(variables: Record<string, string>): Promise<string> {
  const content = Object.entries(variables)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const filePath = join(tmpdir(), `envsync_test_${Date.now()}.env`);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Clean up temporary file
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist
  }
}

/**
 * Read downloaded file content
 */
export async function readDownloadedFile(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf-8');
}

/**
 * Parse .env file content into key-value pairs
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        result[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  return result;
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  url: string | RegExp,
  response: object,
  status = 200
) {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock API error response
 */
export async function mockApiError(
  page: Page,
  url: string | RegExp,
  message: string,
  status = 500
) {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    });
  });
}

/**
 * Capture console logs during test
 */
export function captureConsoleLogs(page: Page): { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else {
      logs.push(msg.text());
    }
  });

  return { logs, errors };
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, message: string, type?: 'success' | 'error' | 'info') {
  const selector = type
    ? `[data-testid="toast"][data-type="${type}"]:has-text("${message}")`
    : `[data-testid="toast"]:has-text("${message}")`;

  await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
}

/**
 * Dismiss toast notification
 */
export async function dismissToast(page: Page) {
  const closeButton = page.locator('[data-testid="toast-close"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}

/**
 * Clear all browser storage
 */
export async function clearStorage(context: BrowserContext) {
  await context.clearCookies();
  const pages = context.pages();
  for (const page of pages) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

/**
 * Take a full page screenshot
 */
export async function takeFullPageScreenshot(page: Page, name: string): Promise<Buffer> {
  return await page.screenshot({
    fullPage: true,
    path: `test-results/screenshots/${name}.png`,
  });
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Wait for element to be stable (no layout shifts)
 */
export async function waitForStable(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector);
  let lastBox = await element.boundingBox();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(100);
    const currentBox = await element.boundingBox();

    if (
      lastBox &&
      currentBox &&
      lastBox.x === currentBox.x &&
      lastBox.y === currentBox.y &&
      lastBox.width === currentBox.width &&
      lastBox.height === currentBox.height
    ) {
      return;
    }

    lastBox = currentBox;
  }
}

/**
 * Retry action with exponential backoff
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

/**
 * Check if element has focus
 */
export async function hasFocus(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    return element === document.activeElement;
  }, selector);
}

/**
 * Get computed style property
 */
export async function getComputedStyle(
  page: Page,
  selector: string,
  property: string
): Promise<string> {
  return await page.evaluate(
    ({ sel, prop }) => {
      const element = document.querySelector(sel);
      if (!element) return '';
      return window.getComputedStyle(element).getPropertyValue(prop);
    },
    { sel: selector, prop: property }
  );
}

/**
 * Simulate slow network
 */
export async function simulateSlowNetwork(page: Page, latency = 500) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 50 * 1024,
    latency,
  });
}

/**
 * Simulate offline mode
 */
export async function simulateOffline(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  });
}

/**
 * Restore network
 */
export async function restoreNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}

/**
 * Measure performance metrics
 */
export async function measurePerformance(page: Page): Promise<{
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
}> {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    return {
      loadTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
      firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
    };
  });

  return metrics;
}

/**
 * Generate random string
 */
export function randomString(length = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `test_${randomString(8)}@envsync.test`;
}

/**
 * Generate strong password
 */
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()';

  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  const all = upper + lower + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
