/**
 * EnvSync E2E Test Fixtures
 *
 * Custom fixtures that extend Playwright's base test functionality.
 * Provides pre-configured states and utilities for testing.
 */

import { test as base, expect, Page } from '@playwright/test';

// Test data types
export interface TestProject {
  id: string;
  name: string;
  description: string;
}

export interface TestEnvironment {
  id: string;
  name: string;
  projectId: string;
}

export interface TestVariable {
  id: string;
  key: string;
  value: string;
  environmentId: string;
  isSecret: boolean;
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

// Fixture types
interface EnvSyncFixtures {
  // Authenticated page
  authenticatedPage: Page;
  // Test data generators
  testProject: TestProject;
  testEnvironment: TestEnvironment;
  testVariable: TestVariable;
  testUser: TestUser;
  // Utility functions
  createProject: (name: string) => Promise<TestProject>;
  createEnvironment: (projectId: string, name: string) => Promise<TestEnvironment>;
  createVariable: (envId: string, key: string, value: string) => Promise<TestVariable>;
  deleteProject: (projectId: string) => Promise<void>;
  unlockVault: (password: string) => Promise<void>;
}

// Test data generators
function generateTestProject(): TestProject {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return {
    id,
    name: `Test Project ${id.substring(5, 10)}`,
    description: 'Auto-generated test project',
  };
}

function generateTestEnvironment(projectId: string): TestEnvironment {
  const id = `env_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return {
    id,
    name: 'development',
    projectId,
  };
}

function generateTestVariable(environmentId: string): TestVariable {
  const id = `var_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return {
    id,
    key: `TEST_VAR_${Date.now()}`,
    value: `value_${Math.random().toString(36).substring(7)}`,
    environmentId,
    isSecret: false,
  };
}

function generateTestUser(): TestUser {
  return {
    email: `test_${Date.now()}@envsync.test`,
    password: 'TestPassword123!',
    name: 'Test User',
  };
}

// Extended test with EnvSync fixtures
export const test = base.extend<EnvSyncFixtures>({
  // Authenticated page - unlocks vault before test
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/');

    // Check if vault is locked and unlock it
    const vaultLock = page.locator('[data-testid="vault-lock"]');
    if (await vaultLock.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('[data-testid="password-input"]').fill('TestMasterPassword123!');
      await page.locator('[data-testid="unlock-button"]').click();
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 });
    }

    await use(page);
  },

  // Test data generators
  testProject: async ({}, use) => {
    await use(generateTestProject());
  },

  testEnvironment: async ({ testProject }, use) => {
    await use(generateTestEnvironment(testProject.id));
  },

  testVariable: async ({ testEnvironment }, use) => {
    await use(generateTestVariable(testEnvironment.id));
  },

  testUser: async ({}, use) => {
    await use(generateTestUser());
  },

  // Create project utility
  createProject: async ({ authenticatedPage }, use) => {
    const createdProjects: string[] = [];

    const createProject = async (name: string): Promise<TestProject> => {
      await authenticatedPage.locator('[data-testid="new-project-button"]').click();
      await authenticatedPage.locator('[data-testid="project-name-input"]').fill(name);
      await authenticatedPage.locator('[data-testid="create-project-submit"]').click();

      // Wait for project to be created and get its ID
      await expect(authenticatedPage.locator(`[data-testid="project-item"]:has-text("${name}")`)).toBeVisible();

      const projectId = `proj_${Date.now()}`;
      createdProjects.push(projectId);

      return {
        id: projectId,
        name,
        description: '',
      };
    };

    await use(createProject);

    // Cleanup created projects after test
    for (const projectId of createdProjects) {
      try {
        await authenticatedPage.locator(`[data-testid="project-${projectId}-delete"]`).click();
        await authenticatedPage.locator('[data-testid="confirm-delete"]').click();
      } catch {
        // Project may already be deleted
      }
    }
  },

  // Create environment utility
  createEnvironment: async ({ authenticatedPage }, use) => {
    const createEnvironment = async (projectId: string, name: string): Promise<TestEnvironment> => {
      await authenticatedPage.locator(`[data-testid="project-${projectId}"]`).click();
      await authenticatedPage.locator('[data-testid="new-environment-button"]').click();
      await authenticatedPage.locator('[data-testid="environment-name-input"]').fill(name);
      await authenticatedPage.locator('[data-testid="create-environment-submit"]').click();

      await expect(authenticatedPage.locator(`[data-testid="environment-tab"]:has-text("${name}")`)).toBeVisible();

      return {
        id: `env_${Date.now()}`,
        name,
        projectId,
      };
    };

    await use(createEnvironment);
  },

  // Create variable utility
  createVariable: async ({ authenticatedPage }, use) => {
    const createVariable = async (envId: string, key: string, value: string): Promise<TestVariable> => {
      await authenticatedPage.locator('[data-testid="add-variable-button"]').click();
      await authenticatedPage.locator('[data-testid="variable-key-input"]').fill(key);
      await authenticatedPage.locator('[data-testid="variable-value-input"]').fill(value);
      await authenticatedPage.locator('[data-testid="save-variable-button"]').click();

      await expect(authenticatedPage.locator(`[data-testid="variable-row"]:has-text("${key}")`)).toBeVisible();

      return {
        id: `var_${Date.now()}`,
        key,
        value,
        environmentId: envId,
        isSecret: false,
      };
    };

    await use(createVariable);
  },

  // Delete project utility
  deleteProject: async ({ authenticatedPage }, use) => {
    const deleteProject = async (projectId: string): Promise<void> => {
      await authenticatedPage.locator(`[data-testid="project-${projectId}-menu"]`).click();
      await authenticatedPage.locator('[data-testid="delete-project-option"]').click();
      await authenticatedPage.locator('[data-testid="confirm-delete-input"]').fill('DELETE');
      await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();

      await expect(authenticatedPage.locator(`[data-testid="project-${projectId}"]`)).not.toBeVisible();
    };

    await use(deleteProject);
  },

  // Unlock vault utility
  unlockVault: async ({ page }, use) => {
    const unlockVault = async (password: string): Promise<void> => {
      const vaultLock = page.locator('[data-testid="vault-lock"]');
      if (await vaultLock.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.locator('[data-testid="password-input"]').fill(password);
        await page.locator('[data-testid="unlock-button"]').click();
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 });
      }
    };

    await use(unlockVault);
  },
});

export { expect };

// Test tags for filtering
export const tags = {
  smoke: '@smoke',
  e2e: '@e2e',
  critical: '@critical',
  regression: '@regression',
  slow: '@slow',
  flaky: '@flaky',
};

// Common assertions
export const assertions = {
  async toBeAuthenticated(page: Page) {
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="vault-lock"]')).not.toBeVisible();
  },

  async toBeLocked(page: Page) {
    await expect(page.locator('[data-testid="vault-lock"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard"]')).not.toBeVisible();
  },

  async toHaveProject(page: Page, projectName: string) {
    await expect(page.locator(`[data-testid="project-item"]:has-text("${projectName}")`)).toBeVisible();
  },

  async toHaveEnvironment(page: Page, envName: string) {
    await expect(page.locator(`[data-testid="environment-tab"]:has-text("${envName}")`)).toBeVisible();
  },

  async toHaveVariable(page: Page, key: string) {
    await expect(page.locator(`[data-testid="variable-row"]:has-text("${key}")`)).toBeVisible();
  },
};
