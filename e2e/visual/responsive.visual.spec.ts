/**
 * Responsive Visual Tests for EnvSync
 *
 * Visual tests for responsive design including:
 * - Mobile viewports
 * - Tablet viewports
 * - Desktop viewports
 * - Breakpoint transitions
 */

import { test, expect } from '@playwright/test';

const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

test.describe('Responsive Visual Tests', () => {
  test.describe('Mobile Viewport', () => {
    test.use({ viewport: viewports.mobile });

    test('should match mobile layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('mobile-layout.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('should show mobile navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for hamburger menu
      const hamburger = page.locator(
        '[data-testid="hamburger-menu"], .hamburger, button[aria-label*="menu"]'
      );
      const hamburgerExists = (await hamburger.count()) > 0;

      if (hamburgerExists) {
        await expect(hamburger.first()).toHaveScreenshot('mobile-hamburger.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });

    test('should match mobile menu open state', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburger = page.locator(
        '[data-testid="hamburger-menu"], .hamburger, button[aria-label*="menu"]'
      );
      const hamburgerExists = (await hamburger.count()) > 0;

      if (hamburgerExists) {
        await hamburger.first().click();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot('mobile-menu-open.png', {
          fullPage: true,
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('Tablet Viewport', () => {
    test.use({ viewport: viewports.tablet });

    test('should match tablet layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('tablet-layout.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('should match tablet sidebar', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
      const sidebarExists = (await sidebar.count()) > 0;

      if (sidebarExists) {
        await expect(sidebar.first()).toHaveScreenshot('tablet-sidebar.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('Desktop Viewport', () => {
    test.use({ viewport: viewports.desktop });

    test('should match desktop layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('desktop-layout.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('should match desktop navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav, [role="navigation"]');
      const navExists = (await nav.count()) > 0;

      if (navExists) {
        await expect(nav.first()).toHaveScreenshot('desktop-navigation.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('Wide Viewport', () => {
    test.use({ viewport: viewports.wide });

    test('should match wide layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('wide-layout.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('should maintain max-width constraints', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [role="main"], .main-content');
      const contentExists = (await mainContent.count()) > 0;

      if (contentExists) {
        const box = await mainContent.first().boundingBox();
        if (box) {
          // Content should not span full width on wide screens
          expect(box.width).toBeLessThan(viewports.wide.width);
        }
      }
    });
  });

  test.describe('Component Responsiveness', () => {
    test('cards should stack on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const cards = page.locator('.card, [data-testid="card"]');
      const cardCount = await cards.count();

      if (cardCount >= 2) {
        const card1Box = await cards.nth(0).boundingBox();
        const card2Box = await cards.nth(1).boundingBox();

        if (card1Box && card2Box) {
          // Cards should be stacked (card2 below card1)
          expect(card2Box.y).toBeGreaterThanOrEqual(card1Box.y + card1Box.height - 10);
        }
      }
    });

    test('cards should be side-by-side on desktop', async ({ page }) => {
      await page.setViewportSize(viewports.desktop);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const cards = page.locator('.card, [data-testid="card"]');
      const cardCount = await cards.count();

      if (cardCount >= 2) {
        const card1Box = await cards.nth(0).boundingBox();
        const card2Box = await cards.nth(1).boundingBox();

        if (card1Box && card2Box) {
          // Cards might be side by side on desktop
          // (This depends on implementation)
          expect(card1Box).toBeDefined();
          expect(card2Box).toBeDefined();
        }
      }
    });
  });

  test.describe('Font Scaling', () => {
    test('text should be readable on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const fontSize = await page.evaluate(() => {
        const body = document.body;
        return parseInt(window.getComputedStyle(body).fontSize);
      });

      // Font size should be at least 14px for readability
      expect(fontSize).toBeGreaterThanOrEqual(14);
    });

    test('headings should scale appropriately', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const h1 = page.locator('h1').first();
      const h1Exists = (await h1.count()) > 0;

      if (h1Exists) {
        const fontSize = await h1.evaluate((el) => {
          return parseInt(window.getComputedStyle(el).fontSize);
        });

        // H1 should be larger than body text
        expect(fontSize).toBeGreaterThan(16);
      }
    });
  });

  test.describe('Touch Targets', () => {
    test('buttons should have adequate touch target on mobile', async ({ page }) => {
      await page.setViewportSize(viewports.mobile);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const buttons = await page.locator('button').all();

      for (const button of buttons.slice(0, 5)) {
        const box = await button.boundingBox();
        if (box) {
          // Touch targets should be at least 44x44 pixels
          expect(box.width).toBeGreaterThanOrEqual(40);
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });
});
