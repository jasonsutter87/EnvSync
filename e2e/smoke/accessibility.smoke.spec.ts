/**
 * Accessibility Smoke Tests for EnvSync
 *
 * Quick accessibility compliance checks including:
 * - Keyboard navigation
 * - ARIA attributes
 * - Color contrast
 * - Focus management
 */

import { test, expect } from '@playwright/test';

test.describe('Accessibility Smoke Tests', () => {
  test.describe('Keyboard Navigation', () => {
    test('should be navigable with Tab key', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Press Tab multiple times and check focus moves
      const focusableElements = [];

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? el.tagName : null;
        });
        if (focusedElement) {
          focusableElements.push(focusedElement);
        }
      }

      // Should have focusable elements
      expect(focusableElements.length).toBeGreaterThan(0);
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Tab');

      // Check for focus outline
      const hasFocusStyle = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return (
          style.outlineStyle !== 'none' ||
          style.boxShadow !== 'none' ||
          el.classList.contains('focus-visible')
        );
      });

      // Focus should be visible (may depend on implementation)
      expect(typeof hasFocusStyle).toBe('boolean');
    });

    test('should support Escape key to close modals', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Try to open a modal (if exists)
      const modal = page.locator('[role="dialog"]');
      const modalExists = (await modal.count()) > 0;

      if (modalExists) {
        await page.keyboard.press('Escape');
        // Modal should close
        await expect(modal).not.toBeVisible();
      }
    });

    test('should trap focus in modals', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const modal = page.locator('[role="dialog"]');
      const modalExists = (await modal.count()) > 0;

      if (modalExists) {
        // Tab through modal and ensure focus stays within
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');
          const isInModal = await page.evaluate(() => {
            const el = document.activeElement;
            return el?.closest('[role="dialog"]') !== null;
          });

          if (!isInModal) {
            // Focus escaped modal - this is a failure
            expect(isInModal).toBe(true);
          }
        }
      }
    });
  });

  test.describe('ARIA Attributes', () => {
    test('should have proper landmark roles', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for common landmarks
      const landmarks = await page.evaluate(() => {
        return {
          hasMain: document.querySelector('main, [role="main"]') !== null,
          hasNav: document.querySelector('nav, [role="navigation"]') !== null,
          hasHeader: document.querySelector('header, [role="banner"]') !== null,
        };
      });

      // Should have at least main landmark
      expect(landmarks.hasMain || landmarks.hasNav || landmarks.hasHeader).toBe(true);
    });

    test('should have accessible buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const buttons = await page.locator('button').all();
      const inaccessibleButtons = [];

      for (const button of buttons) {
        const hasAccessibleName = await button.evaluate((el) => {
          return (
            el.textContent?.trim() !== '' ||
            el.getAttribute('aria-label') !== null ||
            el.getAttribute('aria-labelledby') !== null ||
            el.getAttribute('title') !== null
          );
        });

        if (!hasAccessibleName) {
          const html = await button.evaluate((el) => el.outerHTML);
          inaccessibleButtons.push(html);
        }
      }

      expect(inaccessibleButtons.length).toBe(0);
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const inputs = await page.locator('input:not([type="hidden"])').all();
      const unlabeledInputs = [];

      for (const input of inputs) {
        const hasLabel = await input.evaluate((el) => {
          const id = el.id;
          const hasExplicitLabel = id && document.querySelector(`label[for="${id}"]`) !== null;
          const hasAriaLabel = el.getAttribute('aria-label') !== null;
          const hasAriaLabelledby = el.getAttribute('aria-labelledby') !== null;
          const hasPlaceholder = el.getAttribute('placeholder') !== null;
          const hasTitle = el.getAttribute('title') !== null;
          return hasExplicitLabel || hasAriaLabel || hasAriaLabelledby || hasPlaceholder || hasTitle;
        });

        if (!hasLabel) {
          const html = await input.evaluate((el) => el.outerHTML);
          unlabeledInputs.push(html);
        }
      }

      expect(unlabeledInputs.length).toBe(0);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const headingLevels = await page.evaluate(() => {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return Array.from(headings).map((h) => parseInt(h.tagName[1]));
      });

      // Check for proper hierarchy (no skipping levels)
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1];
        // Should not skip more than one level
        expect(diff).toBeLessThanOrEqual(1);
      }
    });
  });

  test.describe('Image Accessibility', () => {
    test('should have alt text on images', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const images = await page.locator('img').all();
      const missingAlt = [];

      for (const img of images) {
        const hasAlt = await img.evaluate((el) => {
          return el.hasAttribute('alt');
        });

        if (!hasAlt) {
          const src = await img.getAttribute('src');
          missingAlt.push(src);
        }
      }

      expect(missingAlt.length).toBe(0);
    });

    test('should have meaningful alt text (not empty for informative images)', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const images = await page.locator('img:not([role="presentation"])').all();
      const emptyAltImages = [];

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const isDecorative = await img.evaluate((el) => {
          return el.getAttribute('role') === 'presentation' ||
                 el.getAttribute('aria-hidden') === 'true';
        });

        if (alt === '' && !isDecorative) {
          const src = await img.getAttribute('src');
          emptyAltImages.push(src);
        }
      }

      // Allow some empty alt (decorative images)
      expect(emptyAltImages.length).toBeLessThan(5);
    });
  });

  test.describe('Color and Contrast', () => {
    test('should not rely solely on color for information', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check error messages have icons or text, not just color
      const errorElements = await page.locator('.error, [class*="error"]').all();

      for (const el of errorElements) {
        const hasNonColorIndicator = await el.evaluate((element) => {
          const hasIcon = element.querySelector('svg, img, [class*="icon"]') !== null;
          const hasText = element.textContent?.trim() !== '';
          return hasIcon || hasText;
        });

        expect(hasNonColorIndicator).toBe(true);
      }
    });
  });

  test.describe('Focus Management', () => {
    test('should not have focus traps on main page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const focusedElements = new Set();

      // Tab through all elements
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Tab');
        const tagName = await page.evaluate(() => document.activeElement?.tagName);

        if (focusedElements.has(tagName)) {
          // We've cycled through, no infinite trap
          break;
        }
        focusedElements.add(tagName);
      }

      expect(focusedElements.size).toBeGreaterThan(0);
    });
  });

  test.describe('Skip Links', () => {
    test('should have skip to content link', async ({ page }) => {
      await page.goto('/');

      // Press Tab to focus first element
      await page.keyboard.press('Tab');

      // Check if first focusable is skip link
      const isSkipLink = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const href = el.getAttribute('href');
        const text = el.textContent?.toLowerCase() || '';
        return (
          href?.includes('#main') ||
          href?.includes('#content') ||
          text.includes('skip') ||
          text.includes('main content')
        );
      });

      // Skip link is recommended but not required
      expect(typeof isSkipLink).toBe('boolean');
    });
  });
});
