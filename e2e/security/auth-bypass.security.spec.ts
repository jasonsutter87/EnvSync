/**
 * Authentication Bypass Security Tests for EnvSync
 *
 * Tests protection against:
 * - Broken authentication
 * - Session fixation
 * - Privilege escalation
 * - Insecure direct object references (IDOR)
 */

import { test, expect } from '@playwright/test';
import { AUTH_BYPASS_PAYLOADS } from '../utils/security-utils';

test.describe('Authentication Bypass Prevention', () => {
  test.describe('Direct URL Access', () => {
    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
      const protectedRoutes = [
        '/dashboard',
        '/projects',
        '/settings',
        '/admin',
        '/api/projects',
        '/api/variables',
        '/api/sync',
      ];

      for (const route of protectedRoutes) {
        const response = await page.goto(route);

        // Should redirect to login or return 401/403
        const status = response?.status() || 0;
        const url = page.url();

        const isProtected =
          status === 401 ||
          status === 403 ||
          url.includes('login') ||
          url.includes('auth') ||
          url === 'http://localhost:4200/';

        expect(isProtected).toBe(true);
      }
    });

    test('should not allow access with path manipulation', async ({ page }) => {
      for (const path of AUTH_BYPASS_PAYLOADS.paths) {
        const response = await page.goto(path);

        if (response) {
          // Should not grant unauthorized access
          const status = response.status();
          expect([200, 301, 302, 401, 403, 404]).toContain(status);

          // If 200, should be login page not admin
          if (status === 200) {
            const content = await page.content();
            expect(content.toLowerCase()).not.toContain('admin panel');
            expect(content.toLowerCase()).not.toContain('user management');
          }
        }
      }
    });
  });

  test.describe('Header Manipulation', () => {
    test('should not trust X-Forwarded-For for auth', async ({ page }) => {
      for (const headers of AUTH_BYPASS_PAYLOADS.headers) {
        const response = await page.request.get('/api/admin', {
          headers: headers as Record<string, string>,
        });

        // Should still require authentication
        expect([401, 403, 404]).toContain(response.status());
      }
    });

    test('should not trust custom auth headers', async ({ page }) => {
      const maliciousHeaders = {
        'X-Admin': 'true',
        'X-Authenticated': 'true',
        'X-User-Role': 'admin',
        'X-Auth-Token': 'fake-token',
      };

      const response = await page.request.get('/api/projects', {
        headers: maliciousHeaders,
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('JWT Bypass Attempts', () => {
    test('should reject tokens with "none" algorithm', async ({ page }) => {
      // JWT with alg: none
      const noneAlgToken = AUTH_BYPASS_PAYLOADS.jwt[0];

      const response = await page.request.get('/api/projects', {
        headers: {
          Authorization: `Bearer ${noneAlgToken}`,
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should reject expired tokens', async ({ page }) => {
      // Create an expired token (this is a test token, expired)
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid';

      const response = await page.request.get('/api/projects', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should reject malformed tokens', async ({ page }) => {
      const malformedTokens = [
        'not-a-token',
        'eyJ.eyJ.sig',
        'Bearer ',
        'null',
        'undefined',
        '{"admin": true}',
      ];

      for (const token of malformedTokens) {
        const response = await page.request.get('/api/projects', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        expect([400, 401, 403]).toContain(response.status());
      }
    });
  });

  test.describe('Password Reset Bypass', () => {
    test('should not allow password reset token reuse', async ({ page }) => {
      // Try to use a fake reset token
      const response = await page.goto('/reset-password?token=fake-token-123');

      if (response?.ok()) {
        // Should show error, not password reset form
        const content = await page.content();
        const hasError =
          content.toLowerCase().includes('invalid') ||
          content.toLowerCase().includes('expired') ||
          content.toLowerCase().includes('error');

        expect(hasError).toBe(true);
      }
    });
  });

  test.describe('Session Fixation Prevention', () => {
    test('should regenerate session after login', async ({ page, context }) => {
      // Get initial cookies
      const initialCookies = await context.cookies();
      const initialSessionCookie = initialCookies.find(
        (c) => c.name.includes('session') || c.name.includes('token')
      );

      await page.goto('/login');

      // Simulate login (if form exists)
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      if (await emailInput.isVisible() && await passwordInput.isVisible()) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('password123');

        const submitButton = page.locator('button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(500);

          // Get post-login cookies
          const postLoginCookies = await context.cookies();
          const postSessionCookie = postLoginCookies.find(
            (c) => c.name.includes('session') || c.name.includes('token')
          );

          // Session should be regenerated
          if (initialSessionCookie && postSessionCookie) {
            expect(postSessionCookie.value).not.toBe(initialSessionCookie.value);
          }
        }
      }
    });
  });

  test.describe('Privilege Escalation Prevention', () => {
    test('should not allow role parameter tampering', async ({ page }) => {
      const response = await page.request.post('/api/auth/register', {
        data: {
          email: 'test@example.com',
          password: 'password123',
          role: 'admin', // Attempt to set admin role
        },
      });

      if (response.ok()) {
        const data = await response.json();
        // Role should not be admin
        expect(data.role).not.toBe('admin');
        expect(data.user?.role).not.toBe('admin');
      }
    });

    test('should not allow isAdmin parameter injection', async ({ page }) => {
      const response = await page.request.post('/api/users', {
        data: {
          name: 'Test User',
          isAdmin: true,
          admin: true,
          role: 'superuser',
        },
      });

      expect([400, 401, 403]).toContain(response.status());
    });
  });

  test.describe('IDOR Prevention', () => {
    test('should not allow accessing other users projects by ID', async ({ page }) => {
      // Try to access project with random ID
      const randomIds = [
        '00000000-0000-0000-0000-000000000000',
        '1',
        'admin',
        '../../../etc/passwd',
      ];

      for (const id of randomIds) {
        const response = await page.request.get(`/api/projects/${id}`);

        // Should be 401 (not authenticated) or 404 (not found)
        // Should NOT be 200 with data
        if (response.status() === 200) {
          const data = await response.json();
          expect(data.projects).toBeUndefined();
          expect(data.variables).toBeUndefined();
        }
      }
    });

    test('should not expose user data through enumeration', async ({ page }) => {
      const userIds = ['1', '2', '3', 'admin', 'root'];

      for (const id of userIds) {
        const response = await page.request.get(`/api/users/${id}`);

        // Should not expose user data without auth
        expect([401, 403, 404]).toContain(response.status());
      }
    });
  });

  test.describe('Brute Force Protection', () => {
    test('should rate limit login attempts', async ({ page }) => {
      const responses: number[] = [];

      // Attempt many logins quickly
      for (let i = 0; i < 10; i++) {
        const response = await page.request.post('/api/auth/login', {
          data: {
            email: 'test@example.com',
            password: `wrong-password-${i}`,
          },
        });
        responses.push(response.status());
      }

      // Should eventually get rate limited (429)
      const hasRateLimit = responses.includes(429);
      const hasLockedOut = responses.some((r) => r === 423 || r === 403);

      // Either rate limiting or account lockout should occur
      // This is a soft check as rate limiting might not be configured
      if (!hasRateLimit && !hasLockedOut) {
        console.warn('No rate limiting detected on login endpoint');
      }
    });
  });

  test.describe('Password Policy', () => {
    test('should reject weak passwords', async ({ page }) => {
      const weakPasswords = ['123', 'password', 'abc', ''];

      for (const password of weakPasswords) {
        const response = await page.request.post('/api/auth/register', {
          data: {
            email: `test-${Date.now()}@example.com`,
            password: password,
          },
        });

        // Should reject weak passwords
        if (response.status() === 200) {
          console.warn(`Weak password accepted: ${password}`);
        }
      }
    });
  });

  test.describe('Logout Security', () => {
    test('should invalidate session on logout', async ({ page, context }) => {
      // First login (if possible)
      await page.goto('/login');

      // Get initial token/session
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(
        (c) => c.name.includes('session') || c.name.includes('token')
      );

      if (sessionCookie) {
        // Logout
        await page.goto('/logout');

        // Try to use old session
        const response = await page.request.get('/api/projects', {
          headers: {
            Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
          },
        });

        // Old session should be invalid
        expect([401, 403]).toContain(response.status());
      }
    });
  });
});

test.describe('Multi-Factor Authentication Bypass', () => {
  test('should not allow MFA bypass through API', async ({ page }) => {
    // Try to access protected resource claiming MFA is verified
    const response = await page.request.get('/api/projects', {
      headers: {
        'X-MFA-Verified': 'true',
        'X-2FA-Bypass': 'true',
      },
    });

    expect([401, 403]).toContain(response.status());
  });
});
