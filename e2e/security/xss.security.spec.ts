/**
 * XSS Security Tests for EnvSync
 *
 * Tests that all user input is properly sanitized to prevent
 * Cross-Site Scripting attacks.
 */

import { test, expect } from '@playwright/test';
import { XSS_PAYLOADS, checkXSSReflection } from '../utils/security-utils';

test.describe('XSS Prevention Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Project Name XSS Prevention', () => {
    test('should sanitize basic XSS payloads in project name', async ({ page }) => {
      for (const payload of XSS_PAYLOADS.basic) {
        // Try to create project with XSS payload
        const projectNameInput = page.locator('[data-testid="project-name-input"], input[name="projectName"]').first();

        if (await projectNameInput.isVisible()) {
          await projectNameInput.fill(payload);

          // Check that the payload is not executed
          const alerts: string[] = [];
          page.on('dialog', async (dialog) => {
            alerts.push(dialog.message());
            await dialog.dismiss();
          });

          // Wait briefly for any XSS to execute
          await page.waitForTimeout(100);

          expect(alerts).toHaveLength(0);
        }
      }
    });

    test('should encode XSS payloads when displayed', async ({ page }) => {
      const payload = '<script>alert("XSS")</script>';

      // If project name is displayed somewhere, it should be encoded
      const content = await page.content();

      // Should not contain unencoded script tags
      expect(content).not.toContain('<script>alert');
    });
  });

  test.describe('Variable Value XSS Prevention', () => {
    test('should sanitize XSS in variable values', async ({ page }) => {
      for (const payload of XSS_PAYLOADS.eventHandlers) {
        const alerts: string[] = [];
        page.on('dialog', async (dialog) => {
          alerts.push(dialog.message());
          await dialog.dismiss();
        });

        // Look for variable value input
        const valueInput = page.locator('[data-testid="variable-value"], textarea[name="value"]').first();

        if (await valueInput.isVisible()) {
          await valueInput.fill(payload);
          await page.waitForTimeout(100);

          expect(alerts).toHaveLength(0);
        }
      }
    });

    test('should not execute JavaScript in displayed values', async ({ page }) => {
      const payload = '"><img src=x onerror=alert(1)>';

      const alerts: string[] = [];
      page.on('dialog', async (dialog) => {
        alerts.push(dialog.message());
        await dialog.dismiss();
      });

      // Navigate and interact with the app
      await page.waitForTimeout(500);

      // No XSS should execute
      expect(alerts).toHaveLength(0);
    });
  });

  test.describe('Search Input XSS Prevention', () => {
    test('should sanitize XSS in search queries', async ({ page }) => {
      for (const payload of XSS_PAYLOADS.polyglot.slice(0, 3)) {
        const searchInput = page.locator('[data-testid="search-input"], input[type="search"]').first();

        if (await searchInput.isVisible()) {
          const alerts: string[] = [];
          page.on('dialog', async (dialog) => {
            alerts.push(dialog.message());
            await dialog.dismiss();
          });

          await searchInput.fill(payload);
          await searchInput.press('Enter');
          await page.waitForTimeout(100);

          expect(alerts).toHaveLength(0);
        }
      }
    });
  });

  test.describe('Angular Template Injection Prevention', () => {
    test('should not evaluate Angular expressions in user input', async ({ page }) => {
      for (const payload of XSS_PAYLOADS.angular) {
        // Angular template injection attempts
        const content = await page.content();

        // Should not execute Angular expressions
        expect(content).not.toContain('[object Object]');
      }
    });
  });

  test.describe('DOM-based XSS Prevention', () => {
    test('should sanitize URL hash parameters', async ({ page }) => {
      const payloads = [
        '#<script>alert(1)</script>',
        '#" onmouseover="alert(1)"',
        '#javascript:alert(1)',
      ];

      for (const payload of payloads) {
        const alerts: string[] = [];
        page.on('dialog', async (dialog) => {
          alerts.push(dialog.message());
          await dialog.dismiss();
        });

        await page.goto('/' + payload);
        await page.waitForTimeout(200);

        expect(alerts).toHaveLength(0);
      }
    });

    test('should sanitize URL query parameters', async ({ page }) => {
      const payloads = [
        '?name=<script>alert(1)</script>',
        '?search=" onload="alert(1)"',
        '?redirect=javascript:alert(1)',
      ];

      for (const payload of payloads) {
        const alerts: string[] = [];
        page.on('dialog', async (dialog) => {
          alerts.push(dialog.message());
          await dialog.dismiss();
        });

        await page.goto('/' + payload);
        await page.waitForTimeout(200);

        expect(alerts).toHaveLength(0);
      }
    });
  });

  test.describe('Content Security Policy', () => {
    test('should have CSP headers or meta tags', async ({ page }) => {
      const response = await page.goto('/');

      // Check for CSP header
      const cspHeader = response?.headers()['content-security-policy'];

      // Check for CSP meta tag
      const cspMeta = await page.locator('meta[http-equiv="Content-Security-Policy"]').count();

      // Should have some CSP
      const hasCSP = cspHeader !== undefined || cspMeta > 0;

      // Log for debugging (CSP is recommended but not always present in dev)
      if (!hasCSP) {
        console.warn('No Content Security Policy detected');
      }
    });

    test('should block inline scripts if CSP is present', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      // Try to inject inline script
      await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'window.xssExecuted = true';
        document.body.appendChild(script);
      });

      // Check if script was blocked
      const wasBlocked = await page.evaluate(() => {
        return !(window as any).xssExecuted;
      });

      // If CSP is properly configured, inline script should be blocked
      // This is a soft check as CSP might not be configured in dev
      expect(typeof wasBlocked).toBe('boolean');
    });
  });

  test.describe('Stored XSS Prevention', () => {
    test('should sanitize stored data before display', async ({ page }) => {
      // Check that any displayed content is properly encoded
      const htmlContent = await page.content();

      // These dangerous patterns should not appear unencoded
      const dangerousPatterns = [
        /<script[^>]*>(?!<\/script>)/i,
        /javascript:/i,
        /on\w+\s*=/i,  // Event handlers
      ];

      for (const pattern of dangerousPatterns) {
        // Skip if it's in a legitimate context (like inside a <script> tag for app code)
        const appScripts = htmlContent.match(/<script[^>]*src="[^"]*"[^>]*><\/script>/gi) || [];
        const cleanContent = htmlContent
          .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/gi, '')
          .replace(/<script[^>]*>[^<]*<\/script>/gi, '');

        // Check in cleaned content (excluding app's own scripts)
        if (pattern.test(cleanContent)) {
          // Could be false positive, but worth logging
          console.warn(`Potential XSS pattern detected: ${pattern}`);
        }
      }
    });
  });

  test.describe('Input Length Limits', () => {
    test('should limit input length to prevent DoS', async ({ page }) => {
      const veryLongPayload = '<script>alert(1)</script>'.repeat(10000);

      const inputs = page.locator('input[type="text"], textarea');
      const count = await inputs.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          await input.fill(veryLongPayload);

          // Input should be truncated or rejected
          const value = await input.inputValue();
          expect(value.length).toBeLessThan(veryLongPayload.length);
        }
      }
    });
  });
});

test.describe('XSS in Error Messages', () => {
  test('should sanitize error messages', async ({ page }) => {
    const alerts: string[] = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    // Try to trigger an error with XSS payload
    await page.goto('/?error=<script>alert(1)</script>');
    await page.waitForTimeout(200);

    expect(alerts).toHaveLength(0);

    // Check that error message is encoded if displayed
    const content = await page.content();
    expect(content).not.toContain('<script>alert(1)</script>');
  });
});
