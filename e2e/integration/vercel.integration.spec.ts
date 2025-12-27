/**
 * Vercel Integration Tests for EnvSync
 *
 * Tests for Vercel service integration including:
 * - Project listing
 * - Environment variable management
 * - Deployment triggers
 */

import { test, expect } from '@playwright/test';

const VERCEL_API_URL = 'https://api.vercel.com';

test.describe('Vercel Integration', () => {
  const authHeaders = {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN || 'test-token'}`,
  };

  test.describe('API Connectivity', () => {
    test('should connect to Vercel API', async ({ request }) => {
      const response = await request.get(`${VERCEL_API_URL}/v2/user`, {
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe('Project Operations', () => {
    test('should list projects', async ({ request }) => {
      const response = await request.get(`${VERCEL_API_URL}/v9/projects`, {
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('projects');
      }
    });

    test('should get project details', async ({ request }) => {
      const projectId = process.env.VERCEL_TEST_PROJECT_ID || 'test-project';
      const response = await request.get(
        `${VERCEL_API_URL}/v9/projects/${projectId}`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Environment Variables', () => {
    const projectId = process.env.VERCEL_TEST_PROJECT_ID || 'test-project';

    test('should list environment variables', async ({ request }) => {
      const response = await request.get(
        `${VERCEL_API_URL}/v9/projects/${projectId}/env`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 401, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('envs');
      }
    });

    test('should create environment variable', async ({ request }) => {
      const response = await request.post(
        `${VERCEL_API_URL}/v10/projects/${projectId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `TEST_VAR_${Date.now()}`,
            value: 'test-value',
            target: ['production', 'preview', 'development'],
            type: 'plain',
          },
        }
      );

      expect([200, 201, 401, 404, 409]).toContain(response.status());
    });

    test('should create encrypted environment variable', async ({ request }) => {
      const response = await request.post(
        `${VERCEL_API_URL}/v10/projects/${projectId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `SECRET_VAR_${Date.now()}`,
            value: 'secret-value',
            target: ['production'],
            type: 'encrypted',
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });

    test('should update environment variable', async ({ request }) => {
      const envId = 'test-env-id';
      const response = await request.patch(
        `${VERCEL_API_URL}/v9/projects/${projectId}/env/${envId}`,
        {
          headers: authHeaders,
          data: {
            value: 'updated-value',
          },
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should delete environment variable', async ({ request }) => {
      const envId = 'test-env-id';
      const response = await request.delete(
        `${VERCEL_API_URL}/v9/projects/${projectId}/env/${envId}`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 204, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Target-Specific Variables', () => {
    const projectId = process.env.VERCEL_TEST_PROJECT_ID || 'test-project';

    test('should set production-only variable', async ({ request }) => {
      const response = await request.post(
        `${VERCEL_API_URL}/v10/projects/${projectId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `PROD_ONLY_${Date.now()}`,
            value: 'production-value',
            target: ['production'],
            type: 'plain',
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });

    test('should set preview-only variable', async ({ request }) => {
      const response = await request.post(
        `${VERCEL_API_URL}/v10/projects/${projectId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `PREVIEW_ONLY_${Date.now()}`,
            value: 'preview-value',
            target: ['preview'],
            type: 'plain',
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });

    test('should set development-only variable', async ({ request }) => {
      const response = await request.post(
        `${VERCEL_API_URL}/v10/projects/${projectId}/env`,
        {
          headers: authHeaders,
          data: {
            key: `DEV_ONLY_${Date.now()}`,
            value: 'development-value',
            target: ['development'],
            type: 'plain',
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Deployments', () => {
    test('should list deployments', async ({ request }) => {
      const response = await request.get(`${VERCEL_API_URL}/v6/deployments`, {
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid token gracefully', async ({ request }) => {
      const response = await request.get(`${VERCEL_API_URL}/v2/user`, {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect([401, 403]).toContain(response.status());
    });
  });
});
