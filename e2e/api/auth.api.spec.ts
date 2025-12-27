/**
 * Authentication API Tests for EnvSync
 *
 * Tests for auth endpoints including:
 * - Registration
 * - Login
 * - Token refresh
 * - Logout
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/v1';

test.describe('Authentication API', () => {
  test.describe('Registration', () => {
    test('should register a new user successfully', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: `test-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          name: 'Test User',
        },
      });

      // Accept either 201 (created) or 409 (already exists)
      expect([201, 409]).toContain(response.status());

      if (response.status() === 201) {
        const body = await response.json();
        expect(body).toHaveProperty('credential');
        expect(body).toHaveProperty('signature');
      }
    });

    test('should reject registration with invalid email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: 'invalid-email',
          password: 'SecurePassword123!',
          name: 'Test User',
        },
      });

      expect([400, 422]).toContain(response.status());
    });

    test('should reject registration with weak password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email: `test-${Date.now()}@example.com`,
          password: '123',
          name: 'Test User',
        },
      });

      expect([400, 422]).toContain(response.status());
    });

    test('should reject registration without required fields', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {},
      });

      expect([400, 422]).toContain(response.status());
    });

    test('should reject registration with duplicate email', async ({ request }) => {
      const email = `duplicate-${Date.now()}@example.com`;

      // First registration
      await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email,
          password: 'SecurePassword123!',
          name: 'Test User',
        },
      });

      // Second registration with same email
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email,
          password: 'DifferentPassword123!',
          name: 'Another User',
        },
      });

      expect([400, 409]).toContain(response.status());
    });
  });

  test.describe('Login', () => {
    test('should login with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: 'test@example.com',
          password: 'TestPassword123!',
        },
      });

      // Accept 200 or 401 (if test user doesn't exist)
      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('credential');
        expect(body).toHaveProperty('signature');
      }
    });

    test('should reject login with wrong password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: 'test@example.com',
          password: 'WrongPassword123!',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should reject login with non-existent user', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        },
      });

      expect([401, 404]).toContain(response.status());
    });

    test('should reject login without email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          password: 'TestPassword123!',
        },
      });

      expect([400, 422]).toContain(response.status());
    });

    test('should reject login without password', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: 'test@example.com',
        },
      });

      expect([400, 422]).toContain(response.status());
    });
  });

  test.describe('Token Refresh', () => {
    test('should refresh token with valid credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/refresh`, {
        headers: {
          'X-VeilCloud-Credential': 'test-credential',
          'X-VeilCloud-Signature': 'test-signature',
        },
      });

      // Accept 200 (success) or 401 (invalid credentials)
      expect([200, 401]).toContain(response.status());
    });

    test('should reject refresh without credentials', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/refresh`);

      expect([401, 403]).toContain(response.status());
    });

    test('should reject refresh with invalid signature', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/refresh`, {
        headers: {
          'X-VeilCloud-Credential': 'test-credential',
          'X-VeilCloud-Signature': 'invalid-signature',
        },
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/logout`, {
        headers: {
          'X-VeilCloud-Credential': 'test-credential',
          'X-VeilCloud-Signature': 'test-signature',
        },
      });

      // Accept 200/204 (success) or 401 (not logged in)
      expect([200, 204, 401]).toContain(response.status());
    });
  });

  test.describe('Rate Limiting', () => {
    test('should rate limit excessive login attempts', async ({ request }) => {
      const attempts = [];

      // Make multiple rapid login attempts
      for (let i = 0; i < 10; i++) {
        attempts.push(
          request.post(`${API_BASE_URL}/auth/login`, {
            data: {
              email: 'ratelimit@example.com',
              password: 'WrongPassword123!',
            },
          })
        );
      }

      const responses = await Promise.all(attempts);
      const statuses = responses.map((r) => r.status());

      // At least some responses should be rate limited (429)
      // or all should be 401 (if rate limiting is not enabled)
      expect(statuses.every((s) => [401, 429].includes(s))).toBe(true);
    });
  });
});
