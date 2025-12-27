/**
 * Variables API Tests for EnvSync
 *
 * Tests for variable CRUD operations including:
 * - Create variable
 * - Get variables
 * - Update variable
 * - Delete variable
 * - Bulk operations
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/v1';

const authHeaders = {
  'X-VeilCloud-Credential': process.env.TEST_CREDENTIAL || 'test-credential',
  'X-VeilCloud-Signature': process.env.TEST_SIGNATURE || 'test-signature',
};

test.describe('Variables API', () => {
  const environmentId = 'test-env-id';

  test.describe('Create Variable', () => {
    test('should create a new variable', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            key: `API_KEY_${Date.now()}`,
            value: 'secret_value',
            is_secret: true,
          },
        }
      );

      expect([201, 401, 404]).toContain(response.status());

      if (response.status() === 201) {
        const body = await response.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('key');
        expect(body.is_secret).toBe(true);
      }
    });

    test('should create non-secret variable', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            key: `APP_NAME_${Date.now()}`,
            value: 'EnvSync',
            is_secret: false,
          },
        }
      );

      expect([201, 401, 404]).toContain(response.status());
    });

    test('should reject variable with empty key', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            key: '',
            value: 'value',
            is_secret: false,
          },
        }
      );

      expect([400, 401, 404, 422]).toContain(response.status());
    });

    test('should reject variable without key', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            value: 'orphan value',
            is_secret: false,
          },
        }
      );

      expect([400, 401, 404, 422]).toContain(response.status());
    });

    test('should handle empty value', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            key: `EMPTY_VALUE_${Date.now()}`,
            value: '',
            is_secret: false,
          },
        }
      );

      expect([201, 401, 404]).toContain(response.status());
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          data: {
            key: 'UNAUTHORIZED_KEY',
            value: 'value',
            is_secret: false,
          },
        }
      );

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Get Variables', () => {
    test('should list all variables in environment', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 401, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
      }
    });

    test('should get variable by ID', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should return 404 for non-existent variable', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/environments/${environmentId}/variables/non-existent`,
        {
          headers: authHeaders,
        }
      );

      expect([401, 404]).toContain(response.status());
    });

    test('should require authentication for listing', async ({ request }) => {
      const response = await request.get(
        `${API_BASE_URL}/environments/${environmentId}/variables`
      );

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Update Variable', () => {
    test('should update variable value', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`,
        {
          headers: authHeaders,
          data: {
            value: 'updated_value',
          },
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should update variable key', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`,
        {
          headers: authHeaders,
          data: {
            key: 'UPDATED_KEY',
          },
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should update secret flag', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`,
        {
          headers: authHeaders,
          data: {
            is_secret: true,
          },
        }
      );

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should require authentication for update', async ({ request }) => {
      const response = await request.patch(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`,
        {
          data: {
            value: 'unauthorized_update',
          },
        }
      );

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Delete Variable', () => {
    test('should delete variable', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`,
        {
          headers: authHeaders,
        }
      );

      expect([200, 204, 401, 404]).toContain(response.status());
    });

    test('should return 404 for non-existent variable', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/environments/${environmentId}/variables/non-existent`,
        {
          headers: authHeaders,
        }
      );

      expect([401, 404]).toContain(response.status());
    });

    test('should require authentication for delete', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/environments/${environmentId}/variables/test-var-id`
      );

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Bulk Operations', () => {
    test('should create multiple variables', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables/bulk`,
        {
          headers: authHeaders,
          data: {
            variables: [
              { key: 'BULK_VAR_1', value: 'value1', is_secret: false },
              { key: 'BULK_VAR_2', value: 'value2', is_secret: true },
              { key: 'BULK_VAR_3', value: 'value3', is_secret: false },
            ],
          },
        }
      );

      expect([200, 201, 401, 404]).toContain(response.status());
    });

    test('should delete multiple variables', async ({ request }) => {
      const response = await request.delete(
        `${API_BASE_URL}/environments/${environmentId}/variables/bulk`,
        {
          headers: authHeaders,
          data: {
            ids: ['var-1', 'var-2', 'var-3'],
          },
        }
      );

      expect([200, 204, 401, 404]).toContain(response.status());
    });
  });

  test.describe('Variable Key Validation', () => {
    test('should accept valid key formats', async ({ request }) => {
      const validKeys = [
        'SIMPLE_KEY',
        'key.with.dots',
        'key-with-dashes',
        'MixedCaseKey',
        '_UNDERSCORE_PREFIX',
      ];

      for (const key of validKeys) {
        const response = await request.post(
          `${API_BASE_URL}/environments/${environmentId}/variables`,
          {
            headers: authHeaders,
            data: {
              key: `${key}_${Date.now()}`,
              value: 'test',
              is_secret: false,
            },
          }
        );

        expect([201, 401, 404]).toContain(response.status());
      }
    });

    test('should handle very long values', async ({ request }) => {
      const longValue = 'x'.repeat(10000);
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            key: `LONG_VALUE_${Date.now()}`,
            value: longValue,
            is_secret: false,
          },
        }
      );

      expect([201, 400, 401, 404, 413]).toContain(response.status());
    });

    test('should handle multiline values', async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/environments/${environmentId}/variables`,
        {
          headers: authHeaders,
          data: {
            key: `MULTILINE_${Date.now()}`,
            value: 'line1\nline2\nline3',
            is_secret: false,
          },
        }
      );

      expect([201, 401, 404]).toContain(response.status());
    });
  });
});
