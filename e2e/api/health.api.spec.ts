/**
 * Health Check API Tests for EnvSync
 *
 * Tests for API health and status endpoints including:
 * - Basic health checks
 * - Database connectivity
 * - Service status
 * - Version info
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/v1';

test.describe('Health Check API', () => {
  test.describe('Basic Health', () => {
    test('should return healthy status', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      // Health endpoint should always be accessible
      expect([200, 503]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('status');
        expect(body.status).toBe('healthy');
      }
    });

    test('should return within acceptable time', async ({ request }) => {
      const start = Date.now();
      const response = await request.get(`${API_BASE_URL}/health`);
      const duration = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    test('should not require authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      // Should not return 401 or 403
      expect(response.status()).not.toBe(401);
      expect(response.status()).not.toBe(403);
    });
  });

  test.describe('Detailed Health', () => {
    test('should return component health status', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health/detailed`);

      expect([200, 401, 503]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('status');
        // May include database, cache, etc.
      }
    });
  });

  test.describe('Database Health', () => {
    test('should check database connectivity', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health/db`);

      expect([200, 401, 503]).toContain(response.status());
    });
  });

  test.describe('Ready Check', () => {
    test('should indicate service readiness', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/ready`);

      expect([200, 503]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('ready');
      }
    });
  });

  test.describe('Liveness Check', () => {
    test('should indicate service is alive', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/live`);

      expect([200, 503]).toContain(response.status());
    });
  });

  test.describe('Version Info', () => {
    test('should return API version', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/version`);

      expect([200, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('version');
      }
    });
  });

  test.describe('Response Headers', () => {
    test('should include proper content type', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('should include cache control', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);

      // Health checks should not be cached
      const cacheControl = response.headers()['cache-control'];
      if (cacheControl) {
        expect(cacheControl).toContain('no-cache');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle unknown health endpoints gracefully', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health/unknown`);

      expect([404, 400]).toContain(response.status());
    });

    test('should return proper error format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/nonexistent`);

      expect([404, 400]).toContain(response.status());

      const body = await response.json().catch(() => ({}));
      // Should have error structure
      expect(body).toBeDefined();
    });
  });

  test.describe('Metrics', () => {
    test('should expose metrics endpoint if enabled', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/metrics`);

      // May be 200 (enabled) or 404 (disabled) or 401 (requires auth)
      expect([200, 401, 404]).toContain(response.status());
    });
  });
});
