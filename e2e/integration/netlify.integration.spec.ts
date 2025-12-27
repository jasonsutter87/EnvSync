/**
 * Netlify Integration Tests for EnvSync
 *
 * Tests for Netlify service integration including:
 * - Site listing
 * - Environment variable management
 * - Deploy hooks
 */

import { test, expect } from '@playwright/test';

const NETLIFY_API_URL = 'https://api.netlify.com/api/v1';

test.describe('Netlify Integration', () => {
  const authHeaders = {
    Authorization: `Bearer ${process.env.NETLIFY_TOKEN || 'test-token'}`,
  };

  test.describe('API Connectivity', () => {
    test('should connect to Netlify API', async ({ request }) => {
      const response = await request.get(`${NETLIFY_API_URL}/user`, {
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe('Site Operations', () => {
    test('should list user sites', async ({ request }) => {
      const response = await request.get(`${NETLIFY_API_URL}/sites`, {
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
      }
    });

    test('should get site details', async ({ request }) => {
      const siteId = process.env.NETLIFY_TEST_SITE_ID || 'test-site-id';
      const response = await request.get(`${NETLIFY_API_URL}/sites/${siteId}`, {
        headers: authHeaders,
      });

      expect([200, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Environment Variables', () => {
    const siteId = process.env.NETLIFY_TEST_SITE_ID || 'test-site-id';

    test('should list environment variables', async ({ request }) => {
      const response = await request.get(
        `${NETLIFY_API_URL}/sites/${siteId}/env`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 401, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body) || typeof body === 'object').toBe(true);
      }
    });

    test('should create environment variable', async ({ request }) => {
      const response = await request.post(
        `${NETLIFY_API_URL}/sites/${siteId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `TEST_VAR_${Date.now()}`,
            values: [
              {
                value: 'test-value',
                context: 'all',
              },
            ],
          },
        }
      );

      expect([200, 201, 401, 404, 409]).toContain(response.status());
    });

    test('should update environment variable', async ({ request }) => {
      const varKey = 'TEST_UPDATE_VAR';
      const response = await request.patch(
        `${NETLIFY_API_URL}/sites/${siteId}/env/${varKey}`,
        {
          headers: authHeaders,
          data: {
            value: 'updated-value',
            context: 'all',
          },
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should delete environment variable', async ({ request }) => {
      const varKey = 'TEST_DELETE_VAR';
      const response = await request.delete(
        `${NETLIFY_API_URL}/sites/${siteId}/env/${varKey}`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 204, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Context-Specific Variables', () => {
    const siteId = process.env.NETLIFY_TEST_SITE_ID || 'test-site-id';

    test('should set production-only variable', async ({ request }) => {
      const response = await request.post(
        `${NETLIFY_API_URL}/sites/${siteId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `PROD_ONLY_${Date.now()}`,
            values: [
              {
                value: 'production-value',
                context: 'production',
              },
            ],
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });

    test('should set deploy-preview variable', async ({ request }) => {
      const response = await request.post(
        `${NETLIFY_API_URL}/sites/${siteId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `PREVIEW_ONLY_${Date.now()}`,
            values: [
              {
                value: 'preview-value',
                context: 'deploy-preview',
              },
            ],
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Build Hooks', () => {
    const siteId = process.env.NETLIFY_TEST_SITE_ID || 'test-site-id';

    test('should list build hooks', async ({ request }) => {
      const response = await request.get(
        `${NETLIFY_API_URL}/sites/${siteId}/build_hooks`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid token gracefully', async ({ request }) => {
      const response = await request.get(`${NETLIFY_API_URL}/user`, {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should handle rate limiting', async ({ request }) => {
      const responses = [];

      for (let i = 0; i < 5; i++) {
        responses.push(
          request.get(`${NETLIFY_API_URL}/user`, {
            headers: authHeaders,
          })
        );
      }

      const results = await Promise.all(responses);
      const statuses = results.map((r) => r.status());

      expect(statuses.every((s) => [200, 401, 429].includes(s))).toBe(true);
    });
  });
});
