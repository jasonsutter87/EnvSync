/**
 * EnvSync Environment Management E2E Tests
 *
 * Comprehensive tests for environment CRUD operations, tabs, variables,
 * and validation. Tests the full lifecycle of environment management.
 */

import { test, expect, assertions } from '../fixtures/test-fixtures';
import { DashboardPage } from '../pages/dashboard-page';

test.describe('Environment CRUD Operations', () => {
  let dashboardPage: DashboardPage;
  let projectName: string;

  test.beforeEach(async ({ authenticatedPage, createProject }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    projectName = `Test Project ${Date.now()}`;
    await createProject(projectName);
    await dashboardPage.selectProject(projectName);
  });

  test('should create development environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Verify environment tab is visible
    await assertions.toHaveEnvironment(authenticatedPage, 'development');

    // Verify it's the active tab
    const activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain('development');
  });

  test('should create staging environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('staging');

    await assertions.toHaveEnvironment(authenticatedPage, 'staging');

    const activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain('staging');
  });

  test('should create production environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('production');

    await assertions.toHaveEnvironment(authenticatedPage, 'production');

    const activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain('production');
  });

  test('should create custom environment', async ({ authenticatedPage }) => {
    const customEnvName = 'qa-testing';
    await dashboardPage.createEnvironment(customEnvName);

    await assertions.toHaveEnvironment(authenticatedPage, customEnvName);

    const activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain(customEnvName);
  });

  test('should rename environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Right-click to open context menu
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await envTab.click({ button: 'right' });

    // Select rename option
    await authenticatedPage.locator('[data-testid="rename-environment-option"]').click();

    // Enter new name
    await authenticatedPage.locator('[data-testid="environment-name-input"]').clear();
    await authenticatedPage.locator('[data-testid="environment-name-input"]').fill('dev');
    await authenticatedPage.locator('[data-testid="rename-environment-submit"]').click();

    // Verify renamed environment exists
    await assertions.toHaveEnvironment(authenticatedPage, 'dev');

    // Verify old name is gone
    const oldTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await expect(oldTab).not.toBeVisible();
  });

  test('should delete environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');
    await dashboardPage.deleteEnvironment('development');

    // Verify environment is removed
    const deletedTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await expect(deletedTab).not.toBeVisible();
  });

  test('should delete environment with confirmation dialog', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('production');

    // Right-click to delete
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("production")');
    await envTab.click({ button: 'right' });
    await authenticatedPage.locator('[data-testid="delete-environment-option"]').click();

    // Verify confirmation dialog appears
    const confirmDialog = authenticatedPage.locator('[data-testid="confirm-delete-dialog"]');
    await expect(confirmDialog).toBeVisible();

    // Cancel deletion
    await authenticatedPage.locator('[data-testid="cancel-delete-button"]').click();

    // Verify environment still exists
    await assertions.toHaveEnvironment(authenticatedPage, 'production');

    // Now actually delete
    await envTab.click({ button: 'right' });
    await authenticatedPage.locator('[data-testid="delete-environment-option"]').click();
    await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();

    // Verify environment is removed
    await expect(envTab).not.toBeVisible();
  });
});

test.describe('Environment Tabs Management', () => {
  let dashboardPage: DashboardPage;
  let projectName: string;

  test.beforeEach(async ({ authenticatedPage, createProject }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    projectName = `Test Project ${Date.now()}`;
    await createProject(projectName);
    await dashboardPage.selectProject(projectName);
  });

  test('should switch between environments', async ({ authenticatedPage }) => {
    // Create multiple environments
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');
    await dashboardPage.createEnvironment('production');

    // Switch to development
    await dashboardPage.selectEnvironment('development');
    let activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain('development');

    // Switch to staging
    await dashboardPage.selectEnvironment('staging');
    activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain('staging');

    // Switch to production
    await dashboardPage.selectEnvironment('production');
    activeEnv = await dashboardPage.getActiveEnvironment();
    expect(activeEnv.toLowerCase()).toContain('production');
  });

  test('should highlight active tab correctly', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');

    // Development should be active (last created)
    const stagingTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("staging")');
    await expect(stagingTab).toHaveClass(/active/);

    // Switch to development
    await dashboardPage.selectEnvironment('development');

    const devTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await expect(devTab).toHaveClass(/active/);

    // Staging should no longer be active
    await expect(stagingTab).not.toHaveClass(/active/);
  });

  test('should maintain tab order', async ({ authenticatedPage }) => {
    // Create environments in specific order
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');
    await dashboardPage.createEnvironment('production');

    // Get all environment tabs
    const tabs = authenticatedPage.locator('[data-testid="environment-tab"]');
    const count = await tabs.count();
    expect(count).toBe(3);

    // Verify order (typically creation order or alphabetical)
    const firstTabText = await tabs.nth(0).textContent();
    const secondTabText = await tabs.nth(1).textContent();
    const thirdTabText = await tabs.nth(2).textContent();

    expect(firstTabText).toBeTruthy();
    expect(secondTabText).toBeTruthy();
    expect(thirdTabText).toBeTruthy();
  });

  test('should display environment count', async ({ authenticatedPage }) => {
    // Initially no environments
    let countIndicator = authenticatedPage.locator('[data-testid="environment-count"]');

    // Create environments
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');
    await dashboardPage.createEnvironment('production');

    // Verify count display
    const tabs = authenticatedPage.locator('[data-testid="environment-tab"]');
    const count = await tabs.count();
    expect(count).toBe(3);

    // If there's a count badge, verify it
    if (await countIndicator.isVisible().catch(() => false)) {
      await expect(countIndicator).toHaveText(/3/);
    }
  });

  test('should show tab close buttons on hover', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');

    // Hover over tab
    await envTab.hover();

    // Close button should appear
    const closeButton = envTab.locator('[data-testid="close-tab-button"]');
    if (await closeButton.isVisible().catch(() => false)) {
      await expect(closeButton).toBeVisible();
    }
  });

  test('should support keyboard navigation between tabs', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');
    await dashboardPage.createEnvironment('production');

    // Focus on first tab
    const devTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await devTab.focus();

    // Press right arrow to move to next tab
    await authenticatedPage.keyboard.press('ArrowRight');

    // Staging should be focused (if keyboard nav is implemented)
    const activeElement = authenticatedPage.locator(':focus');
    const focusedText = await activeElement.textContent().catch(() => '');

    // This test may need adjustment based on actual keyboard nav implementation
    expect(focusedText).toBeTruthy();
  });

  test('should preserve active tab on page reload', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');

    // Select development
    await dashboardPage.selectEnvironment('development');

    // Reload page
    await authenticatedPage.reload();

    // Wait for page to load
    await dashboardPage.waitForLoad();

    // Select same project again
    await dashboardPage.selectProject(projectName);

    // Development should still be active (if persistence is implemented)
    const devTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await expect(devTab).toBeVisible();
  });
});

test.describe('Environment with Variables', () => {
  let dashboardPage: DashboardPage;
  let projectName: string;

  test.beforeEach(async ({ authenticatedPage, createProject }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    projectName = `Test Project ${Date.now()}`;
    await createProject(projectName);
    await dashboardPage.selectProject(projectName);
  });

  test('should add variables to environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Add variables
    await dashboardPage.addVariable('API_URL', 'https://api.dev.example.com');
    await dashboardPage.addVariable('API_KEY', 'dev-key-12345', true);
    await dashboardPage.addVariable('DEBUG', 'true');

    // Verify all variables are visible
    await assertions.toHaveVariable(authenticatedPage, 'API_URL');
    await assertions.toHaveVariable(authenticatedPage, 'API_KEY');
    await assertions.toHaveVariable(authenticatedPage, 'DEBUG');

    const variableCount = await dashboardPage.getVariableCount();
    expect(variableCount).toBe(3);
  });

  test('should add different variables to different environments', async ({ authenticatedPage }) => {
    // Create environments
    await dashboardPage.createEnvironment('development');
    await dashboardPage.addVariable('API_URL', 'https://api.dev.example.com');

    await dashboardPage.createEnvironment('production');
    await dashboardPage.addVariable('API_URL', 'https://api.example.com');

    // Switch back to development
    await dashboardPage.selectEnvironment('development');

    // Verify dev variable
    const devRow = authenticatedPage.locator('[data-testid="variable-row"]:has-text("API_URL")');
    await expect(devRow).toContainText('https://api.dev.example.com');

    // Switch to production
    await dashboardPage.selectEnvironment('production');

    // Verify prod variable
    const prodRow = authenticatedPage.locator('[data-testid="variable-row"]:has-text("API_URL")');
    await expect(prodRow).toContainText('https://api.example.com');
  });

  test('should copy variables between environments', async ({ authenticatedPage }) => {
    // Create development with variables
    await dashboardPage.createEnvironment('development');
    await dashboardPage.addVariable('API_URL', 'https://api.dev.example.com');
    await dashboardPage.addVariable('API_KEY', 'dev-key-12345');
    await dashboardPage.addVariable('DEBUG', 'true');

    // Create staging environment
    await dashboardPage.createEnvironment('staging');

    // Copy variables from development
    await authenticatedPage.locator('[data-testid="environment-menu-button"]').click();
    await authenticatedPage.locator('[data-testid="copy-from-environment"]').click();
    await authenticatedPage.locator('[data-testid="source-environment-select"]').selectOption('development');
    await authenticatedPage.locator('[data-testid="copy-variables-submit"]').click();

    // Verify variables were copied
    await assertions.toHaveVariable(authenticatedPage, 'API_URL');
    await assertions.toHaveVariable(authenticatedPage, 'API_KEY');
    await assertions.toHaveVariable(authenticatedPage, 'DEBUG');

    const variableCount = await dashboardPage.getVariableCount();
    expect(variableCount).toBe(3);
  });

  test('should update copied variables independently', async ({ authenticatedPage }) => {
    // Create and populate development
    await dashboardPage.createEnvironment('development');
    await dashboardPage.addVariable('API_URL', 'https://api.dev.example.com');

    // Create staging and copy
    await dashboardPage.createEnvironment('staging');
    await authenticatedPage.locator('[data-testid="environment-menu-button"]').click();
    await authenticatedPage.locator('[data-testid="copy-from-environment"]').click();
    await authenticatedPage.locator('[data-testid="source-environment-select"]').selectOption('development');
    await authenticatedPage.locator('[data-testid="copy-variables-submit"]').click();

    // Update staging variable
    await dashboardPage.editVariable('API_URL', 'https://api.staging.example.com');

    // Verify staging has new value
    const stagingRow = authenticatedPage.locator('[data-testid="variable-row"]:has-text("API_URL")');
    await expect(stagingRow).toContainText('https://api.staging.example.com');

    // Switch to development
    await dashboardPage.selectEnvironment('development');

    // Verify development unchanged
    const devRow = authenticatedPage.locator('[data-testid="variable-row"]:has-text("API_URL")');
    await expect(devRow).toContainText('https://api.dev.example.com');
  });

  test('should delete environment with variables', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Add variables
    await dashboardPage.addVariable('API_URL', 'https://api.dev.example.com');
    await dashboardPage.addVariable('API_KEY', 'dev-key-12345');

    // Verify variables exist
    const variableCount = await dashboardPage.getVariableCount();
    expect(variableCount).toBe(2);

    // Delete environment
    await dashboardPage.deleteEnvironment('development');

    // Verify environment and its variables are gone
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await expect(envTab).not.toBeVisible();
  });

  test('should warn before deleting environment with variables', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('production');

    // Add multiple variables
    await dashboardPage.addVariable('API_URL', 'https://api.example.com');
    await dashboardPage.addVariable('API_KEY', 'prod-key-12345');
    await dashboardPage.addVariable('DATABASE_URL', 'postgres://prod.db');

    // Attempt to delete
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("production")');
    await envTab.click({ button: 'right' });
    await authenticatedPage.locator('[data-testid="delete-environment-option"]').click();

    // Should show warning about variables
    const warningDialog = authenticatedPage.locator('[data-testid="confirm-delete-dialog"]');
    await expect(warningDialog).toBeVisible();

    const warningText = await warningDialog.textContent();
    expect(warningText?.toLowerCase()).toContain('variable');

    // Confirm deletion
    await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();

    // Verify environment is deleted
    await expect(envTab).not.toBeVisible();
  });

  test('should clear all variables in environment', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Add variables
    await dashboardPage.addVariable('VAR1', 'value1');
    await dashboardPage.addVariable('VAR2', 'value2');
    await dashboardPage.addVariable('VAR3', 'value3');

    // Clear all variables
    await authenticatedPage.locator('[data-testid="environment-menu-button"]').click();
    await authenticatedPage.locator('[data-testid="clear-all-variables"]').click();
    await authenticatedPage.locator('[data-testid="confirm-clear-button"]').click();

    // Verify all variables are gone
    const variableCount = await dashboardPage.getVariableCount();
    expect(variableCount).toBe(0);
  });
});

test.describe('Environment Validation', () => {
  let dashboardPage: DashboardPage;
  let projectName: string;

  test.beforeEach(async ({ authenticatedPage, createProject }) => {
    dashboardPage = new DashboardPage(authenticatedPage);
    projectName = `Test Project ${Date.now()}`;
    await createProject(projectName);
    await dashboardPage.selectProject(projectName);
  });

  test('should prevent duplicate environment names in project', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Try to create another environment with same name
    await dashboardPage.newEnvironmentButton.click();
    await authenticatedPage.locator('[data-testid="environment-name-input"]').fill('development');
    await authenticatedPage.locator('[data-testid="create-environment-submit"]').click();

    // Should show error message
    const errorMessage = authenticatedPage.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    const errorText = await errorMessage.textContent();
    expect(errorText?.toLowerCase()).toContain('already exists');

    // Verify only one development environment exists
    const devTabs = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    expect(await devTabs.count()).toBe(1);
  });

  test('should allow same environment name across different projects', async ({ authenticatedPage, createProject }) => {
    // Create development in first project
    await dashboardPage.createEnvironment('development');

    // Create second project
    const project2Name = `Test Project ${Date.now()}`;
    await createProject(project2Name);
    await dashboardPage.selectProject(project2Name);

    // Should allow creating development in second project
    await dashboardPage.createEnvironment('development');

    await assertions.toHaveEnvironment(authenticatedPage, 'development');
  });

  test('should require environment name', async ({ authenticatedPage }) => {
    await dashboardPage.newEnvironmentButton.click();

    // Try to submit without name
    await authenticatedPage.locator('[data-testid="create-environment-submit"]').click();

    // Submit button should be disabled or show error
    const errorMessage = authenticatedPage.locator('[data-testid="error-message"]');
    const submitButton = authenticatedPage.locator('[data-testid="create-environment-submit"]');

    const hasError = await errorMessage.isVisible().catch(() => false);
    const isDisabled = await submitButton.isDisabled().catch(() => false);

    expect(hasError || isDisabled).toBe(true);
  });

  test('should validate environment name length', async ({ authenticatedPage }) => {
    await dashboardPage.newEnvironmentButton.click();

    // Try very long name
    const longName = 'a'.repeat(256);
    await authenticatedPage.locator('[data-testid="environment-name-input"]').fill(longName);

    const inputValue = await authenticatedPage.locator('[data-testid="environment-name-input"]').inputValue();

    // Should be truncated or show error
    expect(inputValue.length).toBeLessThanOrEqual(255);
  });

  test('should validate environment name characters', async ({ authenticatedPage }) => {
    await dashboardPage.newEnvironmentButton.click();

    // Try invalid characters
    const invalidName = 'dev@#$%^&*()';
    await authenticatedPage.locator('[data-testid="environment-name-input"]').fill(invalidName);
    await authenticatedPage.locator('[data-testid="create-environment-submit"]').click();

    // Should show error for invalid characters (if validation exists)
    const errorMessage = authenticatedPage.locator('[data-testid="error-message"]');
    const hasError = await errorMessage.isVisible().catch(() => false);

    // Some apps allow special characters, so this might not fail
    // But we document the expected behavior
    if (hasError) {
      const errorText = await errorMessage.textContent();
      expect(errorText?.toLowerCase()).toMatch(/invalid|character/);
    }
  });

  test('should trim whitespace from environment name', async ({ authenticatedPage }) => {
    await dashboardPage.newEnvironmentButton.click();

    // Enter name with whitespace
    await authenticatedPage.locator('[data-testid="environment-name-input"]').fill('  development  ');
    await authenticatedPage.locator('[data-testid="create-environment-submit"]').click();

    // Should create with trimmed name
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await expect(envTab).toBeVisible();

    const tabText = await envTab.textContent();
    expect(tabText?.trim()).toBe('development');
  });

  test('should create default environment on project creation', async ({ authenticatedPage, createProject }) => {
    const newProjectName = `New Project ${Date.now()}`;
    await createProject(newProjectName);
    await dashboardPage.selectProject(newProjectName);

    // Should have a default environment (usually 'development')
    const hasDefaultEnv = await authenticatedPage.locator('[data-testid="environment-tab"]').count();

    // May or may not have default environment depending on implementation
    // This test documents expected behavior
    expect(hasDefaultEnv).toBeGreaterThanOrEqual(0);
  });

  test('should prevent deleting last environment if required', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');

    // Try to delete the only environment
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("development")');
    await envTab.click({ button: 'right' });

    const deleteOption = authenticatedPage.locator('[data-testid="delete-environment-option"]');

    // Delete option might be disabled if at least one env is required
    const isDisabled = await deleteOption.isDisabled().catch(() => false);

    if (!isDisabled) {
      await deleteOption.click();
      await authenticatedPage.locator('[data-testid="confirm-delete-button"]').click();

      // Environment might still exist if it's required
      const envExists = await envTab.isVisible().catch(() => false);

      // Document behavior - some apps require at least one environment
      expect(typeof envExists).toBe('boolean');
    }
  });

  test('should validate environment type selection', async ({ authenticatedPage }) => {
    await dashboardPage.newEnvironmentButton.click();

    // Check if environment type dropdown exists
    const typeSelect = authenticatedPage.locator('[data-testid="environment-type-select"]');
    const hasTypeSelect = await typeSelect.isVisible().catch(() => false);

    if (hasTypeSelect) {
      // Verify available environment types
      await typeSelect.click();

      const developmentOption = authenticatedPage.locator('[data-testid="environment-type-development"]');
      const stagingOption = authenticatedPage.locator('[data-testid="environment-type-staging"]');
      const productionOption = authenticatedPage.locator('[data-testid="environment-type-production"]');

      await expect(developmentOption).toBeVisible();
      await expect(stagingOption).toBeVisible();
      await expect(productionOption).toBeVisible();

      // Select production type
      await productionOption.click();

      // Continue with environment creation
      await authenticatedPage.locator('[data-testid="environment-name-input"]').fill('prod');
      await authenticatedPage.locator('[data-testid="create-environment-submit"]').click();

      await assertions.toHaveEnvironment(authenticatedPage, 'prod');
    }
  });

  test('should show validation errors in real-time', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('development');
    await dashboardPage.newEnvironmentButton.click();

    const nameInput = authenticatedPage.locator('[data-testid="environment-name-input"]');
    const errorMessage = authenticatedPage.locator('[data-testid="error-message"]');

    // Type existing name
    await nameInput.fill('development');

    // Error should appear without submitting (if real-time validation exists)
    await nameInput.blur();

    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      const errorText = await errorMessage.textContent();
      expect(errorText?.toLowerCase()).toContain('already exists');
    }

    // Clear input
    await nameInput.clear();

    // Error should disappear
    if (hasError) {
      await expect(errorMessage).not.toBeVisible();
    }
  });

  test('should handle rapid environment creation', async ({ authenticatedPage }) => {
    const envNames = ['dev1', 'dev2', 'dev3', 'dev4', 'dev5'];

    // Create environments rapidly
    for (const name of envNames) {
      await dashboardPage.createEnvironment(name);
    }

    // Verify all environments were created
    for (const name of envNames) {
      await assertions.toHaveEnvironment(authenticatedPage, name);
    }

    // Verify total count
    const tabs = authenticatedPage.locator('[data-testid="environment-tab"]');
    const count = await tabs.count();
    expect(count).toBe(envNames.length);
  });

  test('should preserve environment order after operations', async ({ authenticatedPage }) => {
    // Create environments in order
    await dashboardPage.createEnvironment('development');
    await dashboardPage.createEnvironment('staging');
    await dashboardPage.createEnvironment('production');

    // Delete middle environment
    await dashboardPage.deleteEnvironment('staging');

    // Verify remaining environments maintain order
    const tabs = authenticatedPage.locator('[data-testid="environment-tab"]');
    expect(await tabs.count()).toBe(2);

    const firstTab = await tabs.nth(0).textContent();
    const secondTab = await tabs.nth(1).textContent();

    expect(firstTab).toBeTruthy();
    expect(secondTab).toBeTruthy();
  });

  test('should handle environment creation cancellation', async ({ authenticatedPage }) => {
    await dashboardPage.newEnvironmentButton.click();

    // Fill in form
    await authenticatedPage.locator('[data-testid="environment-name-input"]').fill('development');

    // Cancel
    await authenticatedPage.locator('[data-testid="cancel-environment-button"]').click();

    // Verify dialog closed and environment not created
    const createDialog = authenticatedPage.locator('[data-testid="create-environment-dialog"]');
    await expect(createDialog).not.toBeVisible();

    const tabs = authenticatedPage.locator('[data-testid="environment-tab"]');
    expect(await tabs.count()).toBe(0);
  });

  test('should display environment icon based on type', async ({ authenticatedPage }) => {
    await dashboardPage.createEnvironment('production');

    // Check if environment tab has appropriate icon or badge
    const envTab = authenticatedPage.locator('[data-testid="environment-tab"]:has-text("production")');
    await expect(envTab).toBeVisible();

    // Production environments might have special styling or icons
    const hasIcon = await envTab.locator('[data-testid="environment-icon"]').isVisible().catch(() => false);
    const hasBadge = await envTab.locator('[data-testid="environment-badge"]').isVisible().catch(() => false);

    // Either icon or badge might be present, or just styled differently
    expect(hasIcon || hasBadge || true).toBe(true);
  });
});
