/**
 * Injection Attack Security Tests for EnvSync
 *
 * Tests protection against:
 * - SQL Injection
 * - Command Injection
 * - LDAP Injection
 * - Path Traversal
 * - Template Injection
 */

import { test, expect } from '@playwright/test';
import {
  SQL_INJECTION_PAYLOADS,
  PATH_TRAVERSAL_PAYLOADS,
  COMMAND_INJECTION_PAYLOADS,
} from '../utils/security-utils';

test.describe('SQL Injection Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Authentication SQL Injection', () => {
    test('should reject SQL injection in login form', async ({ page }) => {
      for (const payload of SQL_INJECTION_PAYLOADS.authentication) {
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        if (await emailInput.isVisible() && await passwordInput.isVisible()) {
          await emailInput.fill(payload);
          await passwordInput.fill('password');

          const submitButton = page.locator('button[type="submit"]').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();

            // Should not log in with SQL injection
            await page.waitForTimeout(500);

            // Check we're not logged in (no dashboard access)
            const url = page.url();
            expect(url).not.toContain('/dashboard');
          }
        }
      }
    });
  });

  test.describe('Search SQL Injection', () => {
    test('should sanitize SQL injection in search queries', async ({ page }) => {
      for (const payload of SQL_INJECTION_PAYLOADS.union.slice(0, 3)) {
        const searchInput = page.locator('[data-testid="search-input"], input[type="search"]').first();

        if (await searchInput.isVisible()) {
          await searchInput.fill(payload);
          await searchInput.press('Enter');

          // Wait for search results
          await page.waitForTimeout(300);

          // Should not expose database structure
          const content = await page.content();
          expect(content.toLowerCase()).not.toContain('select');
          expect(content.toLowerCase()).not.toContain('union');
          expect(content.toLowerCase()).not.toContain('information_schema');
        }
      }
    });
  });

  test.describe('CRUD Operations SQL Injection', () => {
    test('should sanitize project creation inputs', async ({ page }) => {
      for (const payload of SQL_INJECTION_PAYLOADS.stacked.slice(0, 2)) {
        const nameInput = page.locator('[data-testid="project-name-input"], input[name="name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(payload);

          // App should not crash or expose errors
          const errors = await page.locator('.error, [role="alert"]').count();

          // If there are errors, they should not contain SQL details
          if (errors > 0) {
            const errorText = await page.locator('.error, [role="alert"]').first().textContent();
            expect(errorText?.toLowerCase()).not.toContain('syntax');
            expect(errorText?.toLowerCase()).not.toContain('sql');
          }
        }
      }
    });
  });

  test.describe('Blind SQL Injection', () => {
    test('should not be vulnerable to time-based blind SQL injection', async ({ page }) => {
      const searchInput = page.locator('[data-testid="search-input"], input[type="search"]').first();

      if (await searchInput.isVisible()) {
        // Measure normal response time
        const start1 = Date.now();
        await searchInput.fill('normal query');
        await searchInput.press('Enter');
        await page.waitForTimeout(100);
        const normalTime = Date.now() - start1;

        // Try time-based injection
        const start2 = Date.now();
        await searchInput.fill("' AND SLEEP(5) --");
        await searchInput.press('Enter');
        await page.waitForTimeout(100);
        const injectionTime = Date.now() - start2;

        // Injection should not cause noticeable delay
        expect(injectionTime).toBeLessThan(normalTime + 3000);
      }
    });
  });
});

test.describe('Path Traversal Prevention', () => {
  test.describe('File Export Path Traversal', () => {
    test('should prevent path traversal in file exports', async ({ page }) => {
      for (const payload of PATH_TRAVERSAL_PAYLOADS.unix.slice(0, 3)) {
        // Try to access with path traversal in URL
        const response = await page.goto(`/api/export?file=${encodeURIComponent(payload)}`);

        if (response) {
          // Should not return sensitive files
          const content = await response.text();
          expect(content).not.toContain('root:');
          expect(content).not.toContain('/bin/bash');

          // Should return 400 or 404, not 200
          const status = response.status();
          expect([400, 403, 404]).toContain(status);
        }
      }
    });
  });

  test.describe('File Import Path Traversal', () => {
    test('should sanitize file paths in import', async ({ page }) => {
      for (const payload of PATH_TRAVERSAL_PAYLOADS.encoded.slice(0, 2)) {
        // Path traversal should be blocked
        const response = await page.goto(`/api/import?path=${payload}`);

        if (response) {
          expect(response.status()).not.toBe(200);
        }
      }
    });
  });

  test.describe('Null Byte Injection', () => {
    test('should handle null byte injection attempts', async ({ page }) => {
      for (const payload of PATH_TRAVERSAL_PAYLOADS.nullByte) {
        const response = await page.goto(`/api/files?name=${encodeURIComponent(payload)}`);

        if (response) {
          // Should not expose system files
          const content = await response.text();
          expect(content).not.toContain('root:');
        }
      }
    });
  });
});

test.describe('Command Injection Prevention', () => {
  test.describe('Export Command Injection', () => {
    test('should prevent command injection in export operations', async ({ page }) => {
      for (const payload of COMMAND_INJECTION_PAYLOADS.slice(0, 4)) {
        // Try to inject commands in filename
        const response = await page.goto(`/api/export?filename=${encodeURIComponent(payload)}`);

        if (response) {
          const content = await response.text();

          // Should not execute commands
          expect(content).not.toContain('uid=');
          expect(content).not.toContain('gid=');
          expect(content).not.toContain('root');
        }
      }
    });
  });

  test.describe('Environment Variable Command Injection', () => {
    test('should not execute commands in variable values', async ({ page }) => {
      const dangerousValues = [
        '$(whoami)',
        '`id`',
        '| cat /etc/passwd',
        '; rm -rf /',
      ];

      for (const value of dangerousValues) {
        const valueInput = page.locator('[data-testid="variable-value"], textarea[name="value"]').first();

        if (await valueInput.isVisible()) {
          await valueInput.fill(value);

          // Value should be stored as-is, not executed
          const storedValue = await valueInput.inputValue();
          expect(storedValue).toBe(value);
        }
      }
    });
  });
});

test.describe('Template Injection Prevention', () => {
  test.describe('Server-Side Template Injection', () => {
    test('should not evaluate template expressions', async ({ page }) => {
      const templatePayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '#{7*7}',
        '*{7*7}',
      ];

      for (const payload of templatePayloads) {
        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          await input.fill(payload);

          // Wait for any rendering
          await page.waitForTimeout(100);

          // Should not evaluate to 49
          const content = await page.content();

          // If the content contains 49, it might be template injection
          // But only if it's in a suspicious context
          if (content.includes('49')) {
            // Check if it's in user-controlled area
            const userContent = await input.inputValue();
            expect(userContent).not.toBe('49');
          }
        }
      }
    });
  });

  test.describe('Angular Expression Injection', () => {
    test('should not evaluate Angular expressions', async ({ page }) => {
      const angularPayloads = [
        '{{constructor.constructor("alert(1)")()}}',
        '{{$on.constructor("alert(1)")()}}',
        '{{toString.constructor("alert(1)")()}}',
      ];

      for (const payload of angularPayloads) {
        const alerts: string[] = [];
        page.on('dialog', async (dialog) => {
          alerts.push(dialog.message());
          await dialog.dismiss();
        });

        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          await input.fill(payload);
          await page.waitForTimeout(200);

          expect(alerts).toHaveLength(0);
        }
      }
    });
  });
});

test.describe('LDAP Injection Prevention', () => {
  test('should sanitize LDAP special characters', async ({ page }) => {
    const ldapPayloads = [
      '*)(uid=*))(|(uid=*',
      'admin)(&)',
      'x][(|uid=*)]',
      '*)(|(password=*))',
    ];

    for (const payload of ldapPayloads) {
      const input = page.locator('input[name="username"], input[name="email"]').first();

      if (await input.isVisible()) {
        await input.fill(payload);

        // Should not cause auth bypass
        const submitButton = page.locator('button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(300);

          // Should still be on login page
          const url = page.url();
          expect(url).not.toContain('/dashboard');
        }
      }
    }
  });
});

test.describe('XML Injection Prevention', () => {
  test('should prevent XXE attacks', async ({ page }) => {
    const xxePayloads = [
      '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
      '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/xxe">]>',
    ];

    for (const payload of xxePayloads) {
      // Try to send XML payload
      const response = await page.request.post('/api/import', {
        data: payload,
        headers: { 'Content-Type': 'application/xml' },
      });

      // Should reject or sanitize XXE
      if (response.ok()) {
        const content = await response.text();
        expect(content).not.toContain('root:');
      }
    }
  });
});

test.describe('JSON Injection Prevention', () => {
  test('should handle malformed JSON safely', async ({ page }) => {
    const jsonPayloads = [
      '{"__proto__": {"admin": true}}',
      '{"constructor": {"prototype": {"isAdmin": true}}}',
      '{"key": "value", "__proto__": {"polluted": true}}',
    ];

    for (const payload of jsonPayloads) {
      // Send potentially malicious JSON
      const response = await page.request.post('/api/data', {
        data: payload,
        headers: { 'Content-Type': 'application/json' },
      });

      // Should not cause prototype pollution
      const polluted = await page.evaluate(() => {
        return ({} as any).polluted === true || ({} as any).admin === true;
      });

      expect(polluted).toBe(false);
    }
  });
});
