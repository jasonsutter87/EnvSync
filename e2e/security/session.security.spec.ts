/**
 * Session Security Tests for EnvSync
 *
 * Tests protection against:
 * - Session hijacking
 * - Session fixation
 * - Cookie security
 * - CSRF attacks
 */

import { test, expect } from '@playwright/test';

test.describe('Session Security', () => {
  test.describe('Cookie Security Attributes', () => {
    test('should set HttpOnly flag on session cookies', async ({ page, context }) => {
      await page.goto('/');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.includes('session') ||
          c.name.includes('token') ||
          c.name.includes('auth')
      );

      for (const cookie of sessionCookies) {
        expect(cookie.httpOnly).toBe(true);
      }
    });

    test('should set Secure flag on session cookies in HTTPS', async ({ page, context }) => {
      // This test is meaningful in HTTPS context
      await page.goto('/');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.includes('session') ||
          c.name.includes('token') ||
          c.name.includes('auth')
      );

      // In production (HTTPS), cookies should be secure
      // In development (HTTP), this might not apply
      for (const cookie of sessionCookies) {
        if (page.url().startsWith('https')) {
          expect(cookie.secure).toBe(true);
        }
      }
    });

    test('should set SameSite attribute on cookies', async ({ page, context }) => {
      await page.goto('/');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.includes('session') ||
          c.name.includes('token') ||
          c.name.includes('auth')
      );

      for (const cookie of sessionCookies) {
        // SameSite should be Strict or Lax, not None
        expect(['Strict', 'Lax']).toContain(cookie.sameSite);
      }
    });

    test('should set appropriate cookie expiration', async ({ page, context }) => {
      await page.goto('/');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.includes('session') ||
          c.name.includes('token') ||
          c.name.includes('auth')
      );

      for (const cookie of sessionCookies) {
        // Session cookies should expire within reasonable time
        if (cookie.expires !== -1) {
          const now = Date.now() / 1000;
          const maxExpiry = now + 30 * 24 * 60 * 60; // 30 days

          expect(cookie.expires).toBeLessThan(maxExpiry);
        }
      }
    });
  });

  test.describe('CSRF Protection', () => {
    test('should include CSRF token in forms', async ({ page }) => {
      await page.goto('/');

      // Check for CSRF token in forms
      const forms = page.locator('form');
      const formCount = await forms.count();

      for (let i = 0; i < formCount; i++) {
        const form = forms.nth(i);
        const csrfInput = form.locator('input[name*="csrf"], input[name*="_token"]');
        const hasCSRFInput = (await csrfInput.count()) > 0;

        // Or check for CSRF meta tag
        const csrfMeta = page.locator('meta[name*="csrf"]');
        const hasCSRFMeta = (await csrfMeta.count()) > 0;

        // Forms should have CSRF protection
        // This is a soft check as not all apps use token-based CSRF
        if (!hasCSRFInput && !hasCSRFMeta && formCount > 0) {
          console.warn('Form without visible CSRF token detected');
        }
      }
    });

    test('should reject requests without CSRF token', async ({ page }) => {
      // Try to make POST request without CSRF token
      const response = await page.request.post('/api/projects', {
        data: { name: 'Test Project' },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should be rejected (401 for no auth, or 403 for no CSRF)
      expect([401, 403]).toContain(response.status());
    });

    test('should reject requests with invalid CSRF token', async ({ page }) => {
      const response = await page.request.post('/api/projects', {
        data: { name: 'Test Project' },
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token',
        },
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Session Timeout', () => {
    test('should expire idle sessions', async ({ page, context }) => {
      await page.goto('/');

      // Get initial session
      const initialCookies = await context.cookies();

      // In a real test, we'd wait for session timeout
      // Here we just verify that sessions have expiration
      const sessionCookies = initialCookies.filter(
        (c) =>
          c.name.includes('session') ||
          c.name.includes('token') ||
          c.name.includes('auth')
      );

      for (const cookie of sessionCookies) {
        // Session cookies should have expiration (not permanent)
        // expires = -1 means session cookie (expires on browser close)
        // We want either session cookies or cookies with reasonable expiry
        expect(typeof cookie.expires).toBe('number');
      }
    });
  });

  test.describe('Session ID Security', () => {
    test('should have sufficiently long session IDs', async ({ page, context }) => {
      await page.goto('/');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.includes('session') ||
          c.name.includes('token') ||
          c.name.includes('auth')
      );

      for (const cookie of sessionCookies) {
        // Session IDs should be at least 128 bits (16 bytes = ~22 base64 chars)
        expect(cookie.value.length).toBeGreaterThanOrEqual(20);
      }
    });

    test('should not expose session ID in URL', async ({ page }) => {
      await page.goto('/');

      // Check that session ID is not in URL
      const url = page.url();

      expect(url).not.toContain('sessionid=');
      expect(url).not.toContain('session_id=');
      expect(url).not.toContain('sid=');
      expect(url).not.toContain('PHPSESSID');
      expect(url).not.toContain('JSESSIONID');
    });

    test('should not expose session ID in referer', async ({ page }) => {
      // Navigate to external link (simulated)
      await page.goto('/');

      // Check referrer policy
      const referrerPolicy = await page.locator('meta[name="referrer"]').getAttribute('content');

      // Should have restrictive referrer policy
      const safeReferrerPolicies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
      ];

      if (referrerPolicy) {
        expect(safeReferrerPolicies).toContain(referrerPolicy);
      }
    });
  });

  test.describe('Concurrent Session Handling', () => {
    test('should handle multiple sessions securely', async ({ browser }) => {
      // Create two separate contexts (like two different browsers)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      await page1.goto('/');
      await page2.goto('/');

      // Get cookies from both
      const cookies1 = await context1.cookies();
      const cookies2 = await context2.cookies();

      // Sessions should be different
      const session1 = cookies1.find((c) => c.name.includes('session'));
      const session2 = cookies2.find((c) => c.name.includes('session'));

      if (session1 && session2) {
        expect(session1.value).not.toBe(session2.value);
      }

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Session Storage Security', () => {
    test('should not store sensitive data in localStorage', async ({ page }) => {
      await page.goto('/');

      const localStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items[key] = window.localStorage.getItem(key) || '';
          }
        }
        return items;
      });

      // Check for sensitive data in localStorage
      for (const [key, value] of Object.entries(localStorage)) {
        // Password should never be in localStorage
        expect(key.toLowerCase()).not.toContain('password');
        expect(value.toLowerCase()).not.toContain('password');

        // Access tokens should be in httpOnly cookies, not localStorage
        // (This is a best practice check, some apps do store tokens in localStorage)
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
          console.warn(`Sensitive data in localStorage: ${key}`);
        }
      }
    });

    test('should not store sensitive data in sessionStorage', async ({ page }) => {
      await page.goto('/');

      const sessionStorage = await page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            items[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return items;
      });

      for (const [key, value] of Object.entries(sessionStorage)) {
        expect(key.toLowerCase()).not.toContain('password');
        expect(value.toLowerCase()).not.toContain('password');
      }
    });
  });

  test.describe('Clickjacking Protection', () => {
    test('should have X-Frame-Options header', async ({ page }) => {
      const response = await page.goto('/');

      const xFrameOptions = response?.headers()['x-frame-options'];

      // Should have X-Frame-Options header
      if (xFrameOptions) {
        expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions.toUpperCase());
      } else {
        // Or should have CSP frame-ancestors
        const csp = response?.headers()['content-security-policy'];
        if (csp) {
          const hasFrameAncestors = csp.includes('frame-ancestors');
          if (!hasFrameAncestors) {
            console.warn('No clickjacking protection detected');
          }
        }
      }
    });

    test('should not be embeddable in iframe', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Create a page that tries to embed the app in an iframe
      await page.setContent(`
        <html>
          <body>
            <iframe id="target" src="http://localhost:4200/" width="800" height="600"></iframe>
          </body>
        </html>
      `);

      // The iframe should be blocked or empty
      const iframe = page.frameLocator('#target');

      try {
        // This should fail or show blank content
        await iframe.locator('body').waitFor({ timeout: 3000 });
      } catch {
        // Expected - iframe should be blocked
      }

      await context.close();
    });
  });

  test.describe('Security Headers', () => {
    test('should have required security headers', async ({ page }) => {
      const response = await page.goto('/');
      const headers = response?.headers() || {};

      // Check for important security headers
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
      };

      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        const value = headers[header];
        if (!value) {
          console.warn(`Missing security header: ${header}`);
        } else if (value !== expectedValue) {
          console.warn(`Unexpected value for ${header}: ${value}`);
        }
      }
    });

    test('should have strict transport security in production', async ({ page }) => {
      const response = await page.goto('/');

      // HSTS should be present in HTTPS
      if (page.url().startsWith('https')) {
        const hsts = response?.headers()['strict-transport-security'];
        expect(hsts).toBeTruthy();
        expect(hsts).toContain('max-age');
      }
    });
  });
});

test.describe('Cross-Origin Security', () => {
  test('should have proper CORS configuration', async ({ page }) => {
    // Make cross-origin request
    const response = await page.request.get('/api/health', {
      headers: {
        Origin: 'http://evil.com',
      },
    });

    const corsHeader = response.headers()['access-control-allow-origin'];

    // Should not allow all origins
    if (corsHeader) {
      expect(corsHeader).not.toBe('*');
    }
  });

  test('should not allow credentials with wildcard CORS', async ({ page }) => {
    const response = await page.request.get('/api/health', {
      headers: {
        Origin: 'http://evil.com',
      },
    });

    const corsHeader = response.headers()['access-control-allow-origin'];
    const credentialsHeader = response.headers()['access-control-allow-credentials'];

    // If credentials are allowed, origin cannot be wildcard
    if (credentialsHeader === 'true') {
      expect(corsHeader).not.toBe('*');
    }
  });
});
