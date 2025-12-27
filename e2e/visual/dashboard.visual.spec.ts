/**
 * Dashboard Visual Regression Tests for EnvSync
 *
 * Visual tests for dashboard components including:
 * - Layout consistency
 * - Component rendering
 * - Theme consistency
 * - Responsive design
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Visual Tests', () => {
  test.describe('Layout Screenshots', () => {
    test('should match dashboard layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for animations to complete
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('dashboard-layout.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('should match sidebar layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const sidebar = page.locator('[data-testid="sidebar"], .sidebar, aside');
      const sidebarExists = (await sidebar.count()) > 0;

      if (sidebarExists) {
        await expect(sidebar.first()).toHaveScreenshot('sidebar.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });

    test('should match header layout', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const header = page.locator('header, [data-testid="header"]');
      const headerExists = (await header.count()) > 0;

      if (headerExists) {
        await expect(header.first()).toHaveScreenshot('header.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('Component Screenshots', () => {
    test('should match project card', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const projectCard = page.locator('[data-testid="project-card"], .project-card').first();
      const cardExists = (await projectCard.count()) > 0;

      if (cardExists) {
        await expect(projectCard).toHaveScreenshot('project-card.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });

    test('should match empty state', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('[data-testid="empty-state"], .empty-state');
      const emptyExists = (await emptyState.count()) > 0;

      if (emptyExists) {
        await expect(emptyState.first()).toHaveScreenshot('empty-state.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('State Screenshots', () => {
    test('should match loading state', async ({ page }) => {
      // Intercept API to delay response
      await page.route('**/api/**', async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.continue();
      });

      await page.goto('/');

      const loadingState = page.locator('[data-testid="loading"], .loading, .spinner');
      const loadingExists = (await loadingState.count()) > 0;

      if (loadingExists) {
        await expect(loadingState.first()).toHaveScreenshot('loading-state.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });

    test('should match error state', async ({ page }) => {
      // Force an error
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server Error' }),
        });
      });

      await page.goto('/');
      await page.waitForTimeout(1000);

      const errorState = page.locator('[data-testid="error"], .error-message');
      const errorExists = (await errorState.count()) > 0;

      if (errorExists) {
        await expect(errorState.first()).toHaveScreenshot('error-state.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('Interactive State Screenshots', () => {
    test('should match button hover state', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const button = page.locator('button').first();
      const buttonExists = (await button.count()) > 0;

      if (buttonExists) {
        await button.hover();
        await page.waitForTimeout(200);

        await expect(button).toHaveScreenshot('button-hover.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });

    test('should match input focus state', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const input = page.locator('input').first();
      const inputExists = (await input.count()) > 0;

      if (inputExists) {
        await input.focus();
        await page.waitForTimeout(200);

        await expect(input).toHaveScreenshot('input-focus.png', {
          maxDiffPixelRatio: 0.1,
        });
      }
    });
  });

  test.describe('Modal Screenshots', () => {
    test('should match modal dialog', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Try to open a modal
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add")');
      const buttonExists = (await createButton.count()) > 0;

      if (buttonExists) {
        await createButton.first().click();
        await page.waitForTimeout(300);

        const modal = page.locator('[role="dialog"], .modal');
        const modalExists = (await modal.count()) > 0;

        if (modalExists) {
          await expect(modal.first()).toHaveScreenshot('modal-dialog.png', {
            maxDiffPixelRatio: 0.1,
          });
        }
      }
    });
  });
});
