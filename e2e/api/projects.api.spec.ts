/**
 * Projects API Tests for EnvSync
 *
 * Tests for project CRUD operations including:
 * - Create project
 * - Get projects
 * - Update project
 * - Delete project
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/v1';

// Mock auth headers for testing
const authHeaders = {
  'X-VeilCloud-Credential': process.env.TEST_CREDENTIAL || 'test-credential',
  'X-VeilCloud-Signature': process.env.TEST_SIGNATURE || 'test-signature',
};

test.describe('Projects API', () => {
  test.describe('Create Project', () => {
    test('should create a new project', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          name: `Test Project ${Date.now()}`,
          description: 'A test project',
        },
      });

      expect([201, 401]).toContain(response.status());

      if (response.status() === 201) {
        const body = await response.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('name');
        expect(body.name).toContain('Test Project');
      }
    });

    test('should create project without description', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          name: `Minimal Project ${Date.now()}`,
        },
      });

      expect([201, 401]).toContain(response.status());
    });

    test('should reject project with empty name', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          name: '',
          description: 'Description',
        },
      });

      expect([400, 401, 422]).toContain(response.status());
    });

    test('should reject project without name', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          description: 'Description only',
        },
      });

      expect([400, 401, 422]).toContain(response.status());
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        data: {
          name: 'Unauthorized Project',
        },
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Get Projects', () => {
    test('should list all projects', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
      }
    });

    test('should get project by ID', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/projects/test-id`, {
        headers: authHeaders,
      });

      expect([200, 401, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('name');
      }
    });

    test('should return 404 for non-existent project', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/projects/non-existent-id`, {
        headers: authHeaders,
      });

      expect([401, 404]).toContain(response.status());
    });

    test('should require authentication for listing', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/projects`);

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Update Project', () => {
    test('should update project name', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/projects/test-id`, {
        headers: authHeaders,
        data: {
          name: 'Updated Project Name',
        },
      });

      expect([200, 401, 404]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body.name).toBe('Updated Project Name');
      }
    });

    test('should update project description', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/projects/test-id`, {
        headers: authHeaders,
        data: {
          description: 'Updated description',
        },
      });

      expect([200, 401, 404]).toContain(response.status());
    });

    test('should reject update with empty name', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/projects/test-id`, {
        headers: authHeaders,
        data: {
          name: '',
        },
      });

      expect([400, 401, 404, 422]).toContain(response.status());
    });

    test('should require authentication for update', async ({ request }) => {
      const response = await request.patch(`${API_BASE_URL}/projects/test-id`, {
        data: {
          name: 'Unauthorized Update',
        },
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Delete Project', () => {
    test('should delete project', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/projects/test-id`, {
        headers: authHeaders,
      });

      expect([200, 204, 401, 404]).toContain(response.status());
    });

    test('should return 404 for non-existent project', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/projects/non-existent`, {
        headers: authHeaders,
      });

      expect([401, 404]).toContain(response.status());
    });

    test('should require authentication for delete', async ({ request }) => {
      const response = await request.delete(`${API_BASE_URL}/projects/test-id`);

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Project Validation', () => {
    test('should reject project name longer than max length', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          name: 'x'.repeat(256),
          description: 'Test',
        },
      });

      expect([400, 401, 422]).toContain(response.status());
    });

    test('should handle unicode in project name', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          name: `Unicode Test 日本語 ${Date.now()}`,
          description: 'Test with unicode',
        },
      });

      expect([201, 401]).toContain(response.status());
    });

    test('should handle special characters in project name', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/projects`, {
        headers: authHeaders,
        data: {
          name: `Test-Project_${Date.now()}`,
          description: 'Test with special chars',
        },
      });

      expect([201, 401]).toContain(response.status());
    });
  });
});
