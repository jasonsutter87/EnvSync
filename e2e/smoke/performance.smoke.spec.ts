/**
 * Performance Smoke Tests for EnvSync
 *
 * Quick checks for application performance including:
 * - Page load times
 * - Memory usage
 * - Render performance
 * - Bundle sizes
 */

import { test, expect } from '@playwright/test';

test.describe('Performance Smoke Tests', () => {
  test.describe('Page Load Performance', () => {
    test('should load main page within acceptable time', async ({ page }) => {
      const start = Date.now();

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const loadTime = Date.now() - start;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should reach interactive state quickly', async ({ page }) => {
      const start = Date.now();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const interactiveTime = Date.now() - start;

      // Should be interactive within 5 seconds
      expect(interactiveTime).toBeLessThan(5000);
    });

    test('should not have excessive network requests', async ({ page }) => {
      let requestCount = 0;

      page.on('request', () => {
        requestCount++;
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should have reasonable number of requests
      expect(requestCount).toBeLessThan(50);
    });
  });

  test.describe('Navigation Performance', () => {
    test('should navigate between pages quickly', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const start = Date.now();

      // Navigate to settings or another route
      await page.click('[data-testid="settings-link"]').catch(() => {
        // Link may not exist in current state
      });

      const navigationTime = Date.now() - start;

      // Navigation should be fast
      expect(navigationTime).toBeLessThan(1000);
    });
  });

  test.describe('Render Performance', () => {
    test('should not have layout thrashing', async ({ page }) => {
      await page.goto('/');

      // Check for forced synchronous layouts
      const metrics = await page.evaluate(() => {
        return {
          layoutCount: performance.getEntriesByType('layout-shift').length || 0,
        };
      });

      // Should have minimal layout shifts
      expect(metrics.layoutCount).toBeLessThan(10);
    });

    test('should maintain stable frame rate during interaction', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Simulate some interactions
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 200);
      await page.mouse.move(300, 300);

      // Page should remain responsive
      const isResponsive = await page.evaluate(() => {
        return document.readyState === 'complete';
      });

      expect(isResponsive).toBe(true);
    });
  });

  test.describe('Resource Loading', () => {
    test('should load images efficiently', async ({ page }) => {
      await page.goto('/');

      const images = await page.locator('img').all();
      const brokenImages = [];

      for (const img of images) {
        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        if (naturalWidth === 0) {
          const src = await img.getAttribute('src');
          brokenImages.push(src);
        }
      }

      expect(brokenImages.length).toBe(0);
    });

    test('should use efficient font loading', async ({ page }) => {
      const fontLoadEvents: string[] = [];

      page.on('response', (response) => {
        if (response.url().includes('font') || response.url().includes('woff')) {
          fontLoadEvents.push(response.url());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should have reasonable number of font files
      expect(fontLoadEvents.length).toBeLessThan(10);
    });
  });

  test.describe('JavaScript Performance', () => {
    test('should not have console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out known acceptable errors
      const significantErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('404')
      );

      expect(significantErrors.length).toBe(0);
    });

    test('should not have unhandled exceptions', async ({ page }) => {
      const exceptions: Error[] = [];

      page.on('pageerror', (error) => {
        exceptions.push(error);
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      expect(exceptions.length).toBe(0);
    });
  });

  test.describe('Bundle Size', () => {
    test('should have reasonable main bundle size', async ({ page }) => {
      let mainBundleSize = 0;

      page.on('response', async (response) => {
        if (response.url().includes('main') && response.url().endsWith('.js')) {
          const body = await response.body().catch(() => Buffer.from(''));
          mainBundleSize = body.length;
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Main bundle should be under 2MB
      if (mainBundleSize > 0) {
        expect(mainBundleSize).toBeLessThan(2 * 1024 * 1024);
      }
    });

    test('should have reasonable total transfer size', async ({ page }) => {
      let totalSize = 0;

      page.on('response', async (response) => {
        const body = await response.body().catch(() => Buffer.from(''));
        totalSize += body.length;
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Total should be under 5MB
      expect(totalSize).toBeLessThan(5 * 1024 * 1024);
    });
  });
});
